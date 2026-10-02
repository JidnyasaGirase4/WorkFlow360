"""Support-ticket business rules (numbering, row-level visibility, status workflow, comments, attachments)."""
from fastapi import UploadFile
from sqlalchemy import ColumnElement, Integer, Select, and_, cast, false, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import Ctx
from app.core.enums import NotificationType, Priority, RoleName, TicketStatus, UserStatus
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, UnprocessableError
from app.database.base import utcnow
from app.models.client import Client
from app.models.role import Role
from app.models.ticket import Ticket, TicketAttachment, TicketComment
from app.models.user import User
from app.schemas.ticket import AttachmentOut, CommentCreate, CommentOut, TicketCreate, TicketDetail, TicketOut, TicketUpdate
from app.services.access import get_visible_project
from app.services.activity import log_activity
from app.services.common import get_referenced
from app.services.notifications import notify
from app.utils.files import delete_stored_file, save_upload
from app.utils.pagination import like_any

OPENISH = {TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_FOR_CLIENT}


# ---- access rules ------------------------------------------------------------

def is_ticket_manager(ctx: Ctx) -> bool:
    """Admins/managers holding manage_tickets. Employees also carry that permission but may never assign/delete/reopen."""
    return (ctx.is_admin or ctx.is_manager) and ctx.can("manage_tickets")


def ticket_visibility_filter(ctx: Ctx) -> ColumnElement[bool]:
    company = Ticket.company_id == ctx.company_id if ctx.company_id is not None else Ticket.id.is_not(None)
    if ctx.is_admin or ctx.is_manager:
        return company
    if ctx.is_client:
        return and_(company, Ticket.client_id == ctx.client_id) if ctx.client_id else false()
    return and_(company, or_(Ticket.assigned_to == ctx.user.id, Ticket.created_by == ctx.user.id))


def get_ticket(db: Session, ctx: Ctx, ticket_id: int) -> Ticket:
    ticket = db.scalars(select(Ticket).where(Ticket.id == ticket_id, ticket_visibility_filter(ctx))).first()
    if ticket is None:
        raise NotFoundError("Ticket not found")
    return ticket


def _assert_open(ticket: Ticket) -> None:
    if ticket.status == TicketStatus.CLOSED:
        raise ConflictError("This ticket is closed and can no longer be changed")


# ---- output ------------------------------------------------------------------

def _comment_scope(ctx: Ctx, stmt: Select) -> Select:
    """Client users never see (or count) internal comments."""
    return stmt.where(TicketComment.is_internal.is_(False)) if ctx.is_client else stmt


def _comment_counts(db: Session, ctx: Ctx, ticket_ids: list[int]) -> dict[int, int]:
    if not ticket_ids:
        return {}
    stmt = _comment_scope(ctx, select(TicketComment.ticket_id, func.count()).where(TicketComment.ticket_id.in_(ticket_ids))).group_by(TicketComment.ticket_id)
    return dict(db.execute(stmt).all())


def _fill(out: TicketOut, ticket: Ticket, comment_count: int) -> None:
    out.client_name = ticket.client.company_name if ticket.client else None
    out.project_name = ticket.project.name if ticket.project else None
    out.assignee_name = ticket.assignee.name if ticket.assignee else None
    out.created_by_name = ticket.creator.name if ticket.creator else None
    out.comment_count = comment_count


def to_out_list(db: Session, ctx: Ctx, tickets: list[Ticket]) -> list[TicketOut]:
    counts = _comment_counts(db, ctx, [t.id for t in tickets])
    result = []
    for ticket in tickets:
        out = TicketOut.model_validate(ticket)
        _fill(out, ticket, counts.get(ticket.id, 0))
        result.append(out)
    return result


def attachment_out(att: TicketAttachment) -> AttachmentOut:
    out = AttachmentOut.model_validate(att)
    out.uploaded_by_name = att.uploader.name if att.uploader else None
    return out


def _attachments(db: Session, ctx: Ctx, ticket_id: int) -> list[TicketAttachment]:
    stmt = select(TicketAttachment).outerjoin(TicketComment, TicketAttachment.comment_id == TicketComment.id).where(TicketAttachment.ticket_id == ticket_id)
    if ctx.is_client:  # attachments follow their comment: internal-comment files are hidden from clients
        stmt = stmt.where(or_(TicketAttachment.comment_id.is_(None), TicketComment.is_internal.is_(False)))
    return list(db.scalars(stmt.order_by(TicketAttachment.id)).all())


def _comments(db: Session, ctx: Ctx, ticket_id: int) -> list[CommentOut]:
    rows = db.scalars(_comment_scope(ctx, select(TicketComment).where(TicketComment.ticket_id == ticket_id)).order_by(TicketComment.id)).all()
    by_comment: dict[int, list[AttachmentOut]] = {}
    for att in _attachments(db, ctx, ticket_id):
        if att.comment_id:
            by_comment.setdefault(att.comment_id, []).append(attachment_out(att))
    return [comment_out(c, by_comment.get(c.id, [])) for c in rows]


def comment_out(comment: TicketComment, attachments: list[AttachmentOut] | None = None) -> CommentOut:
    out = CommentOut.model_validate(comment)
    out.user_name = comment.user.name if comment.user else None
    out.user_role = comment.user.role.name if comment.user else None
    out.attachments = attachments or []
    return out


def ticket_detail(db: Session, ctx: Ctx, ticket: Ticket) -> TicketDetail:
    db.refresh(ticket)  # also reloads the joined name relationships, which are stale after project/assignee changes
    detail = TicketDetail.model_validate(ticket)
    comments = _comments(db, ctx, ticket.id)
    _fill(detail, ticket, len(comments))
    detail.comments = comments
    detail.attachments = [attachment_out(a) for a in _attachments(db, ctx, ticket.id)]
    return detail


# ---- queries -----------------------------------------------------------------

def list_query(
    ctx: Ctx,
    *,
    status: TicketStatus | None = None,
    priority: Priority | None = None,
    client_id: int | None = None,
    project_id: int | None = None,
    assigned_to: int | None = None,
    category: str | None = None,
    mine: bool = False,
    search: str | None = None,
) -> Select:
    stmt = select(Ticket).where(ticket_visibility_filter(ctx))
    for column, value in (
        (Ticket.status, status), (Ticket.priority, priority), (Ticket.client_id, client_id),
        (Ticket.project_id, project_id), (Ticket.assigned_to, assigned_to), (Ticket.category, category),
    ):
        if value is not None:
            stmt = stmt.where(column == value)
    if mine:
        stmt = stmt.where(or_(Ticket.assigned_to == ctx.user.id, Ticket.created_by == ctx.user.id))
    if search:
        stmt = stmt.where(like_any(search, Ticket.ticket_number, Ticket.subject))
    return stmt


def client_tickets_query(db: Session, ctx: Ctx, client_id: int, **filters) -> Select:
    if ctx.is_client and client_id != ctx.client_id:
        raise NotFoundError("Client not found")
    client = get_referenced(db, ctx, Client, client_id, "Client")
    return list_query(ctx, client_id=client.id, **filters)


# ---- recipients --------------------------------------------------------------

def _client_user_ids(db: Session, ticket: Ticket) -> list[int]:
    return list(db.scalars(select(User.id).where(User.client_id == ticket.client_id, User.company_id == ticket.company_id, User.status == UserStatus.ACTIVE)))


def _staff_ids(db: Session, company_id: int) -> list[int]:
    stmt = select(User.id).join(Role, User.role_id == Role.id).where(
        User.company_id == company_id, User.status == UserStatus.ACTIVE,
        Role.name.in_([RoleName.COMPANY_ADMIN.value, RoleName.MANAGER.value]),
    )
    return list(db.scalars(stmt))


def _recipients(db: Session, ticket: Ticket, *, include_clients: bool) -> set[int | None]:
    """People following a ticket. Client users are only included when the event is client-visible."""
    ids: set[int | None] = {ticket.assigned_to}
    creator_is_client = ticket.creator is not None and ticket.creator.role.name == RoleName.CLIENT.value
    if include_clients or not creator_is_client:
        ids.add(ticket.created_by)
    if include_clients:
        ids.update(_client_user_ids(db, ticket))
    return ids


# ---- writes ------------------------------------------------------------------

def _next_number(db: Session, company_id: int) -> str:
    top = db.scalar(select(func.max(cast(func.substr(Ticket.ticket_number, 5), Integer))).where(Ticket.company_id == company_id)) or 0
    return f"TCK-{top + 1:04d}"


def _resolve_project(db: Session, ctx: Ctx, project_id: int | None, client_id: int):
    project = get_visible_project(db, ctx, project_id) if project_id is not None else None
    if project and project.client_id != client_id:
        raise UnprocessableError("Project does not belong to this ticket's client", {"project_id": "Belongs to a different client"})
    return project


def create_ticket(db: Session, ctx: Ctx, data: TicketCreate) -> Ticket:
    company_id = ctx.require_company()
    if ctx.is_client:
        if ctx.client_id is None:
            raise ForbiddenError()
        if data.client_id is not None and data.client_id != ctx.client_id:
            raise UnprocessableError("Client users can only raise tickets for their own client", {"client_id": "Not allowed"})
        client_id = ctx.client_id
    else:
        if data.client_id is None:
            raise UnprocessableError("client_id is required", {"client_id": "Required"})
        client_id = get_referenced(db, ctx, Client, data.client_id, "Client").id
    project = _resolve_project(db, ctx, data.project_id, client_id)

    for attempt in (1, 2):  # a concurrent creator may take the same number: retry once on the unique key
        ticket = Ticket(
            company_id=company_id, ticket_number=_next_number(db, company_id), client_id=client_id,
            project_id=project.id if project else None, subject=data.subject, description=data.description,
            category=data.category, priority=data.priority, status=TicketStatus.OPEN, created_by=ctx.user.id,
        )
        try:
            with db.begin_nested():
                db.add(ticket)
                db.flush()
            break
        except IntegrityError:
            if attempt == 2:
                raise
    log_activity(db, ctx, "created", "ticket", ticket.id, f"Created ticket {ticket.ticket_number}: {ticket.subject}")
    if ctx.is_client:  # nobody is assigned yet: tell the people who triage
        notify(db, _staff_ids(db, company_id), f"New ticket {ticket.ticket_number}", ticket.subject, NotificationType.TICKET, "ticket", ticket.id, exclude_user_id=ctx.user.id)
    db.commit()
    return ticket


def update_ticket(db: Session, ctx: Ctx, ticket_id: int, data: TicketUpdate) -> Ticket:
    ticket = get_ticket(db, ctx, ticket_id)
    _assert_open(ticket)
    if not (is_ticket_manager(ctx) or (ticket.created_by == ctx.user.id and ticket.status == TicketStatus.OPEN)):
        raise ForbiddenError("Only admins/managers, or the creator while the ticket is still open, can edit it")
    changes = data.model_dump(exclude_unset=True)
    for required in ("subject", "description", "priority"):
        if required in changes and changes[required] is None:
            raise UnprocessableError(f"{required} cannot be null", {required: "Cannot be null"})
    if "project_id" in changes:
        project = _resolve_project(db, ctx, changes["project_id"], ticket.client_id)
        changes["project_id"] = project.id if project else None
    for field, value in changes.items():
        setattr(ticket, field, value)
    log_activity(db, ctx, "updated", "ticket", ticket.id, f"Updated ticket {ticket.ticket_number}")
    db.commit()
    return ticket


def delete_ticket(db: Session, ctx: Ctx, ticket_id: int) -> None:
    ticket = get_ticket(db, ctx, ticket_id)
    if not is_ticket_manager(ctx):
        raise ForbiddenError()
    paths = list(db.scalars(select(TicketAttachment.file_path).where(TicketAttachment.ticket_id == ticket.id)))
    number = ticket.ticket_number
    db.delete(ticket)  # comments and attachment rows go with it (ON DELETE CASCADE)
    log_activity(db, ctx, "deleted", "ticket", ticket_id, f"Deleted ticket {number}")
    db.commit()
    for path in paths:
        delete_stored_file(path)


def assign_ticket(db: Session, ctx: Ctx, ticket_id: int, assignee_id: int | None) -> Ticket:
    ticket = get_ticket(db, ctx, ticket_id)
    if not is_ticket_manager(ctx):
        raise ForbiddenError("Only admins and managers can assign tickets")
    _assert_open(ticket)
    assignee = None
    if assignee_id is not None:
        assignee = db.scalars(select(User).where(User.id == assignee_id, User.company_id == ticket.company_id)).first()
        if assignee is None:
            raise NotFoundError("User not found")
        if assignee.role.name in (RoleName.CLIENT.value, RoleName.SUPER_ADMIN.value) or assignee.status != UserStatus.ACTIVE:
            raise UnprocessableError("Tickets can only be assigned to active internal users", {"assigned_to": "Not an active internal user"})
    if ticket.assigned_to == assignee_id:
        return ticket
    ticket.assigned_to = assignee_id
    text = f"Assigned ticket {ticket.ticket_number} to {assignee.name}" if assignee else f"Unassigned ticket {ticket.ticket_number}"
    log_activity(db, ctx, "assigned", "ticket", ticket.id, text)
    if assignee:
        notify(db, [assignee.id], f"Ticket {ticket.ticket_number} assigned to you", ticket.subject, NotificationType.TICKET, "ticket", ticket.id, exclude_user_id=ctx.user.id)
    db.commit()
    return ticket


def _assert_transition(ctx: Ctx, ticket: Ticket, new: TicketStatus) -> None:
    old = ticket.status
    graph_ok = (old in OPENISH and (new in OPENISH or new == TicketStatus.RESOLVED)) or (old == TicketStatus.RESOLVED and (new in OPENISH or new == TicketStatus.CLOSED))
    if ctx.is_client:
        if old == TicketStatus.CLOSED:
            raise ForbiddenError("Only an admin or manager can reopen a closed ticket")
        if new == TicketStatus.CLOSED or (new == TicketStatus.OPEN and old == TicketStatus.RESOLVED):
            return
        raise ForbiddenError("Clients can only close their ticket or reopen a resolved one")
    if is_ticket_manager(ctx):
        if old == TicketStatus.CLOSED:
            if new != TicketStatus.OPEN:
                raise ConflictError("A closed ticket can only be reopened (to 'open')")
            return
    elif ctx.is_employee and ctx.can("manage_tickets") and ticket.assigned_to == ctx.user.id:
        if old == TicketStatus.CLOSED:
            raise ForbiddenError("Only an admin or manager can reopen a closed ticket")
        if new == TicketStatus.CLOSED:
            raise ForbiddenError("Only an admin or manager can close a ticket")
    else:
        raise ForbiddenError("Only admins, managers or the assignee can change a ticket's status")
    if not graph_ok:
        raise ConflictError(f"A ticket cannot move from '{old.value}' to '{new.value}'")


def change_status(db: Session, ctx: Ctx, ticket_id: int, new: TicketStatus) -> Ticket:
    ticket = get_ticket(db, ctx, ticket_id)
    old = ticket.status
    if new == old:
        raise ConflictError(f"Ticket is already {old.value}")
    _assert_transition(ctx, ticket, new)
    ticket.status = new
    if new == TicketStatus.RESOLVED:
        ticket.resolved_at = utcnow()
    elif new != TicketStatus.CLOSED:
        ticket.resolved_at = None
    log_activity(db, ctx, "status_changed", "ticket", ticket.id, f"Ticket {ticket.ticket_number} moved from {old.value} to {new.value}")
    notify(db, _recipients(db, ticket, include_clients=True), f"Ticket {ticket.ticket_number} is now {new.value.replace('_', ' ')}", ticket.subject, NotificationType.TICKET, "ticket", ticket.id, exclude_user_id=ctx.user.id)
    db.commit()
    return ticket


# ---- comments ----------------------------------------------------------------

def add_comment(db: Session, ctx: Ctx, ticket_id: int, data: CommentCreate) -> TicketComment:
    ticket = get_ticket(db, ctx, ticket_id)
    _assert_open(ticket)
    if data.is_internal and ctx.is_client:
        raise UnprocessableError("Clients cannot post internal comments", {"is_internal": "Not allowed"})
    comment = TicketComment(ticket_id=ticket.id, user_id=ctx.user.id, comment=data.comment, is_internal=data.is_internal)
    db.add(comment)
    db.flush()
    log_activity(db, ctx, "commented", "ticket", ticket.id, f"{'Internal note' if comment.is_internal else 'Comment'} on ticket {ticket.ticket_number}")
    if ctx.is_client and ticket.status == TicketStatus.WAITING_FOR_CLIENT:  # the client answered: the ball is back with us
        ticket.status = TicketStatus.OPEN
        log_activity(db, ctx, "status_changed", "ticket", ticket.id, f"Ticket {ticket.ticket_number} moved from waiting_for_client to open (client replied)")
    title = f"New {'internal note' if comment.is_internal else 'comment'} on {ticket.ticket_number}"
    notify(db, _recipients(db, ticket, include_clients=not comment.is_internal), title, ticket.subject, NotificationType.TICKET, "ticket", ticket.id, exclude_user_id=ctx.user.id)
    db.commit()
    return comment


def list_comments(db: Session, ctx: Ctx, ticket_id: int) -> list[CommentOut]:
    return _comments(db, ctx, get_ticket(db, ctx, ticket_id).id)


# ---- attachments -------------------------------------------------------------

def list_attachments(db: Session, ctx: Ctx, ticket_id: int) -> list[TicketAttachment]:
    return _attachments(db, ctx, get_ticket(db, ctx, ticket_id).id)


def get_attachment(db: Session, ctx: Ctx, ticket_id: int, attachment_id: int) -> TicketAttachment:
    ticket = get_ticket(db, ctx, ticket_id)
    att = next((a for a in _attachments(db, ctx, ticket.id) if a.id == attachment_id), None)
    if att is None:
        raise NotFoundError("Attachment not found")
    return att


async def add_attachment(db: Session, ctx: Ctx, ticket_id: int, file: UploadFile, comment_id: int | None) -> TicketAttachment:
    ticket = get_ticket(db, ctx, ticket_id)
    _assert_open(ticket)
    if comment_id is not None:
        comment = db.scalars(_comment_scope(ctx, select(TicketComment).where(TicketComment.id == comment_id, TicketComment.ticket_id == ticket.id))).first()
        if comment is None:
            raise NotFoundError("Comment not found")
        if comment.user_id != ctx.user.id and not (ctx.is_admin or ctx.is_manager):
            raise ForbiddenError("You can only attach files to your own comments")
    stored = await save_upload(file, f"{ticket.company_id}/tickets")
    try:
        att = TicketAttachment(
            ticket_id=ticket.id, comment_id=comment_id, uploaded_by=ctx.user.id, file_name=stored.original_name,
            file_path=stored.relative_path, file_type=stored.content_type, file_size=stored.size,
        )
        db.add(att)
        db.flush()
        log_activity(db, ctx, "uploaded", "ticket", ticket.id, f"Attached {att.file_name} to ticket {ticket.ticket_number}")
        db.commit()
    except Exception:
        db.rollback()
        delete_stored_file(stored.relative_path)
        raise
    return att


def delete_attachment(db: Session, ctx: Ctx, ticket_id: int, attachment_id: int) -> None:
    att = get_attachment(db, ctx, ticket_id, attachment_id)
    ticket = get_ticket(db, ctx, ticket_id)
    _assert_open(ticket)
    if not (att.uploaded_by == ctx.user.id or ctx.is_admin or ctx.is_manager):
        raise ForbiddenError("Only the uploader or an admin/manager can remove this attachment")
    path, name = att.file_path, att.file_name
    db.delete(att)
    log_activity(db, ctx, "deleted", "ticket", ticket.id, f"Removed attachment {name} from ticket {ticket.ticket_number}")
    db.commit()
    delete_stored_file(path)
