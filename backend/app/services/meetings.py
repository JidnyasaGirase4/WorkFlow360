"""Meeting scheduling, participants and their visibility rules."""
from collections.abc import Iterable
from datetime import date

from sqlalchemy import ColumnElement, Select, and_, exists, or_, select
from sqlalchemy.orm import Session

from app.core.deps import Ctx
from app.core.enums import MeetingStatus, MeetingType, NotificationType, ResponseStatus, RoleName
from app.core.exceptions import ForbiddenError, NotFoundError, UnprocessableError
from app.models.client import Client
from app.models.meeting import Meeting, MeetingParticipant
from app.models.project import Project
from app.models.user import User
from app.schemas.meeting import MeetingCreate, MeetingOut, MeetingUpdate, ParticipantOut
from app.services.activity import log_activity
from app.services.notifications import notify
from app.utils.pagination import PageParams, like_any, paginate


# Fields of MeetingOut read straight off the row (the rest is joined in below).
_COLUMN_FIELDS = tuple(f for f in MeetingOut.model_fields if f not in {"client_name", "project_name", "created_by_name", "participants"})


# ---- visibility & queries --------------------------------------------------

def _is_participant(ctx: Ctx) -> ColumnElement[bool]:
    return exists().where(MeetingParticipant.meeting_id == Meeting.id, MeetingParticipant.user_id == ctx.user.id)


def visibility(ctx: Ctx) -> ColumnElement[bool]:
    """WHERE-clause over `Meeting` for what the caller may see (company scope included).

    admin/manager: whole company. Everyone else: meetings they created or attend, plus, for a client user,
    meetings of their own client record.
    """
    company = Meeting.company_id == ctx.company_id if ctx.company_id is not None else Meeting.id.is_not(None)
    if ctx.is_admin or ctx.is_manager:
        return company
    conditions = [Meeting.created_by == ctx.user.id, _is_participant(ctx)]
    if ctx.is_client and ctx.client_id:
        conditions.append(Meeting.client_id == ctx.client_id)
    return and_(company, or_(*conditions))


def list_query(
    ctx: Ctx,
    *,
    search: str | None,
    status: MeetingStatus | None,
    meeting_type: MeetingType | None,
    client_id: int | None,
    project_id: int | None,
    date_from: date | None,
    date_to: date | None,
    upcoming: bool,
    mine: bool,
) -> Select:
    if date_from and date_to and date_from > date_to:
        raise UnprocessableError("date_from must not be after date_to", {"date_from": "Must be on or before date_to"})
    stmt = select(Meeting).where(visibility(ctx))
    if search:
        stmt = stmt.where(like_any(search, Meeting.title))
    if status:
        stmt = stmt.where(Meeting.status == status)
    if meeting_type:
        stmt = stmt.where(Meeting.meeting_type == meeting_type)
    if client_id:
        stmt = stmt.where(Meeting.client_id == client_id)
    if project_id:
        stmt = stmt.where(Meeting.project_id == project_id)
    if date_from:
        stmt = stmt.where(Meeting.meeting_date >= date_from)
    if date_to:
        stmt = stmt.where(Meeting.meeting_date <= date_to)
    if upcoming:
        stmt = stmt.where(Meeting.meeting_date >= date.today(), Meeting.status == MeetingStatus.SCHEDULED)
    if mine:
        stmt = stmt.where(or_(Meeting.created_by == ctx.user.id, _is_participant(ctx)))
    return stmt


def get_visible_meeting(db: Session, ctx: Ctx, meeting_id: int) -> Meeting:
    meeting = db.scalars(select(Meeting).where(Meeting.id == meeting_id, visibility(ctx))).first()
    if meeting is None:
        raise NotFoundError("Meeting not found")
    return meeting


def serialize_meetings(db: Session, meetings: list[Meeting]) -> list[MeetingOut]:
    """Adds client/project/creator names and the participant list using four queries for the whole page."""
    if not meetings:
        return []
    meeting_ids = [m.id for m in meetings]
    rows = db.scalars(select(MeetingParticipant).where(MeetingParticipant.meeting_id.in_(meeting_ids)).order_by(MeetingParticipant.id)).all()
    user_ids = {r.user_id for r in rows} | {m.created_by for m in meetings if m.created_by}
    users = {u.id: u for u in db.scalars(select(User).where(User.id.in_(user_ids)))} if user_ids else {}
    client_ids = {m.client_id for m in meetings if m.client_id}
    clients = dict(db.execute(select(Client.id, Client.company_name).where(Client.id.in_(client_ids))).all()) if client_ids else {}
    project_ids = {m.project_id for m in meetings if m.project_id}
    projects = dict(db.execute(select(Project.id, Project.name).where(Project.id.in_(project_ids))).all()) if project_ids else {}

    by_meeting: dict[int, list[ParticipantOut]] = {}
    for row in rows:
        user = users.get(row.user_id)
        if user is not None:
            by_meeting.setdefault(row.meeting_id, []).append(
                ParticipantOut(user_id=user.id, name=user.name, role=user.role.name, response_status=row.response_status)
            )
    creators = {m.id: users.get(m.created_by) for m in meetings}
    return [
        MeetingOut.model_validate(
            {
                **{field: getattr(m, field) for field in _COLUMN_FIELDS},
                "client_name": clients.get(m.client_id),
                "project_name": projects.get(m.project_id),
                "created_by_name": creators[m.id].name if creators[m.id] else None,
                "participants": by_meeting.get(m.id, []),
            }
        )
        for m in meetings
    ]


def paginate_meetings(db: Session, stmt: Select, pagination: PageParams) -> dict:
    page = paginate(db, stmt, pagination, lambda meeting: meeting)
    page["data"] = serialize_meetings(db, page["data"])
    return page


# ---- validation helpers ----------------------------------------------------

def _load_ref(db: Session, model, record_id: int, company_id: int, label: str):
    row = db.scalars(select(model).where(model.id == record_id, model.company_id == company_id)).first()
    if row is None:
        raise NotFoundError(f"{label} not found")
    return row


def _validate_links(db: Session, meeting: Meeting) -> None:
    """client / project must belong to the company, and the project to the client when both are given."""
    if meeting.client_id:
        _load_ref(db, Client, meeting.client_id, meeting.company_id, "Client")
    if meeting.project_id:
        project = _load_ref(db, Project, meeting.project_id, meeting.company_id, "Project")
        if meeting.client_id is None:
            meeting.client_id = project.client_id
        elif project.client_id != meeting.client_id:
            raise UnprocessableError("The project does not belong to this client", {"project_id": "Project belongs to a different client"})


def _validate_times(meeting: Meeting) -> None:
    if meeting.end_time is not None and meeting.end_time <= meeting.start_time:
        raise UnprocessableError("end_time must be after start_time", {"end_time": "Must be after start_time"})


def _load_users(db: Session, company_id: int, user_ids: Iterable[int]) -> dict[int, User]:
    wanted = set(user_ids)
    users = {u.id: u for u in db.scalars(select(User).where(User.id.in_(wanted), User.company_id == company_id))} if wanted else {}
    missing = sorted(wanted - users.keys())
    if missing:
        raise NotFoundError("Some participants were not found", {"user_ids": missing})
    return users


def _assert_client_participants(users: Iterable[User], client_id: int | None) -> None:
    """Client-role users may only attend meetings of their own client."""
    bad = sorted(u.id for u in users if u.role.name == RoleName.CLIENT.value and (client_id is None or u.client_id != client_id))
    if bad:
        raise UnprocessableError("Client users can only join meetings of their own client", {"user_ids": bad})


# ---- CRUD ------------------------------------------------------------------

def create_meeting(db: Session, ctx: Ctx, data: MeetingCreate) -> Meeting:
    company_id = ctx.require_company()
    values = data.model_dump(exclude={"participant_user_ids"})
    meeting = Meeting(company_id=company_id, created_by=ctx.user.id, **values)
    _validate_links(db, meeting)

    invitees = set(data.participant_user_ids)
    if ctx.user.company_id == company_id:
        invitees.add(ctx.user.id)  # the creator always attends
    users = _load_users(db, company_id, invitees)
    _assert_client_participants(users.values(), meeting.client_id)

    db.add(meeting)
    db.flush()
    for user_id in invitees:
        accepted = user_id == ctx.user.id
        db.add(MeetingParticipant(meeting_id=meeting.id, user_id=user_id, response_status=ResponseStatus.ACCEPTED if accepted else ResponseStatus.PENDING))
    log_activity(db, ctx, "created", "meeting", meeting.id, f"Scheduled meeting {meeting.title} on {meeting.meeting_date}")
    notify(db, invitees, "New meeting invitation", f"{meeting.title} on {meeting.meeting_date} at {meeting.start_time:%H:%M}.", NotificationType.MEETING, "meeting", meeting.id, exclude_user_id=ctx.user.id)
    db.commit()
    return meeting


def _participant_ids(db: Session, meeting_id: int) -> set[int]:
    return set(db.scalars(select(MeetingParticipant.user_id).where(MeetingParticipant.meeting_id == meeting_id)))


def update_meeting(db: Session, ctx: Ctx, meeting_id: int, data: MeetingUpdate) -> Meeting:
    meeting = get_visible_meeting(db, ctx, meeting_id)
    changes = data.model_dump(exclude_unset=True)
    new_participants = changes.pop("participant_user_ids", None)
    old_slot = (meeting.meeting_date, meeting.start_time, meeting.end_time)
    old_status = meeting.status
    old_participants = _participant_ids(db, meeting.id)

    for field, value in changes.items():
        setattr(meeting, field, value)
    _validate_times(meeting)
    if {"client_id", "project_id"} & changes.keys():
        _validate_links(db, meeting)

    final = set(old_participants)
    if new_participants is not None:
        final = set(new_participants) | ({meeting.created_by} if meeting.created_by in old_participants else set())
    added = final - old_participants
    users = _load_users(db, meeting.company_id, final)
    _assert_client_participants(users.values(), meeting.client_id)
    if new_participants is not None:
        for row in db.scalars(select(MeetingParticipant).where(MeetingParticipant.meeting_id == meeting.id, MeetingParticipant.user_id.not_in(final))):
            db.delete(row)
    for user_id in added:
        db.add(MeetingParticipant(meeting_id=meeting.id, user_id=user_id))

    log_activity(db, ctx, "updated", "meeting", meeting.id, f"Updated meeting {meeting.title}")
    if meeting.status != old_status:
        log_activity(db, ctx, "status_changed", "meeting", meeting.id, f"Meeting {meeting.title} is now {meeting.status.value}")
    _notify_changes(db, ctx, meeting, old_slot=old_slot, old_status=old_status, retained=old_participants & final, added=added, everyone=final)
    db.commit()
    return meeting


def _notify_changes(db: Session, ctx: Ctx, meeting: Meeting, *, old_slot, old_status, retained: set[int], added: set[int], everyone: set[int]) -> None:
    ref = ("meeting", meeting.id)
    when = f"{meeting.meeting_date} at {meeting.start_time:%H:%M}"
    if meeting.status == MeetingStatus.CANCELLED:
        if old_status != MeetingStatus.CANCELLED:
            notify(db, everyone, "Meeting cancelled", f"{meeting.title} on {when} was cancelled.", NotificationType.MEETING, *ref, exclude_user_id=ctx.user.id)
        return
    if (meeting.meeting_date, meeting.start_time, meeting.end_time) != old_slot:
        notify(db, retained, "Meeting rescheduled", f"{meeting.title} is now on {when}.", NotificationType.MEETING, *ref, exclude_user_id=ctx.user.id)
    notify(db, added, "New meeting invitation", f"{meeting.title} on {when}.", NotificationType.MEETING, *ref, exclude_user_id=ctx.user.id)


def delete_meeting(db: Session, ctx: Ctx, meeting_id: int) -> None:
    meeting = get_visible_meeting(db, ctx, meeting_id)
    title = meeting.title
    notify(db, _participant_ids(db, meeting.id), "Meeting cancelled", f"{title} on {meeting.meeting_date} was removed.", NotificationType.MEETING, exclude_user_id=ctx.user.id)
    db.delete(meeting)
    log_activity(db, ctx, "deleted", "meeting", meeting_id, f"Deleted meeting {title}")
    db.commit()


# ---- participants ----------------------------------------------------------

def add_participants(db: Session, ctx: Ctx, meeting_id: int, user_ids: list[int]) -> Meeting:
    meeting = get_visible_meeting(db, ctx, meeting_id)
    existing = _participant_ids(db, meeting.id)
    users = _load_users(db, meeting.company_id, user_ids)
    _assert_client_participants(users.values(), meeting.client_id)
    added = set(user_ids) - existing
    for user_id in added:
        db.add(MeetingParticipant(meeting_id=meeting.id, user_id=user_id))
    if added:
        names = ", ".join(sorted(users[i].name for i in added))
        log_activity(db, ctx, "assigned", "meeting", meeting.id, f"Added {names} to meeting {meeting.title}")
        notify(db, added, "New meeting invitation", f"{meeting.title} on {meeting.meeting_date} at {meeting.start_time:%H:%M}.", NotificationType.MEETING, "meeting", meeting.id, exclude_user_id=ctx.user.id)
    db.commit()
    return meeting


def respond(db: Session, ctx: Ctx, meeting_id: int, user_id: int, response_status: ResponseStatus) -> Meeting:
    """A participant answers for themselves; admins/managers (manage_meetings) may answer for anyone."""
    meeting = get_visible_meeting(db, ctx, meeting_id)
    if user_id != ctx.user.id and not ctx.can("manage_meetings"):
        raise ForbiddenError("You can only change your own response")
    row = db.scalars(select(MeetingParticipant).where(MeetingParticipant.meeting_id == meeting.id, MeetingParticipant.user_id == user_id)).first()
    if row is None:
        raise NotFoundError("Participant not found")
    row.response_status = response_status
    log_activity(db, ctx, "updated", "meeting", meeting.id, f"Response to meeting {meeting.title} set to {response_status.value}")
    db.commit()
    return meeting

