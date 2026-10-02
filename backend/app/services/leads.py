"""Lead (CRM) business rules: CRUD, activities, pipeline summary and conversion into a client."""
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.deps import Ctx
from app.core.enums import ClientStatus, LeadActivityType, LeadSource, LeadStatus, NotificationType, Priority, RoleName
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, UnprocessableError
from app.database.base import utcnow
from app.models.client import Client, ClientContact
from app.models.lead import Lead, LeadActivity
from app.models.user import User
from app.schemas.lead import (
    LeadActivityCreate,
    LeadActivityOut,
    LeadConvert,
    LeadCreate,
    LeadOut,
    LeadUpdate,
    Pipeline,
    PipelineStage,
)
from app.services.activity import log_activity
from app.services.common import get_scoped_or_404
from app.services.notifications import notify
from app.utils.pagination import PageParams, like_any, paginate

_CONTACT_ACTIVITIES = {LeadActivityType.CALL, LeadActivityType.EMAIL, LeadActivityType.MEETING}


# ---- queries & serialisation ----------------------------------------------

def list_query(
    ctx: Ctx,
    *,
    search: str | None,
    status: LeadStatus | None,
    source: LeadSource | None,
    owner_id: int | None,
    priority: Priority | None,
    date_from: date | None,
    date_to: date | None,
) -> Select:
    if date_from and date_to and date_from > date_to:
        raise UnprocessableError("date_from must not be after date_to", {"date_from": "Must be on or before date_to"})
    stmt = ctx.scope(select(Lead), Lead)
    if search:
        stmt = stmt.where(like_any(search, Lead.company_name, Lead.contact_name, Lead.email))
    if status:
        stmt = stmt.where(Lead.status == status)
    if source:
        stmt = stmt.where(Lead.source == source)
    if owner_id:
        stmt = stmt.where(Lead.owner_id == owner_id)
    if priority:
        stmt = stmt.where(Lead.priority == priority)
    if date_from:
        stmt = stmt.where(Lead.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        stmt = stmt.where(Lead.created_at < datetime.combine(date_to + timedelta(days=1), time.min))
    return stmt


def _user_names(db: Session, ids: set[int | None]) -> dict[int, str]:
    wanted = {i for i in ids if i is not None}
    if not wanted:
        return {}
    return dict(db.execute(select(User.id, User.name).where(User.id.in_(wanted))).all())


def serialize_leads(db: Session, leads: list[Lead]) -> list[LeadOut]:
    names = _user_names(db, {lead.owner_id for lead in leads})
    return [LeadOut.model_validate(lead).model_copy(update={"owner_name": names.get(lead.owner_id)}) for lead in leads]


def paginate_leads(db: Session, stmt: Select, pagination: PageParams) -> dict:
    """Standard page envelope with `owner_name` joined in (one extra query for the whole page)."""
    page = paginate(db, stmt, pagination, lambda lead: lead)
    page["data"] = serialize_leads(db, page["data"])
    return page


def get_lead(db: Session, ctx: Ctx, lead_id: int) -> Lead:
    return get_scoped_or_404(db, ctx, Lead, lead_id, "Lead")


def pipeline(db: Session, ctx: Ctx) -> Pipeline:
    rows = db.execute(
        ctx.scope(select(Lead.status, func.count(), func.coalesce(func.sum(Lead.estimated_value), 0)), Lead).group_by(Lead.status)
    ).all()
    by_status = {status: (count, Decimal(total)) for status, count, total in rows}
    stages = [PipelineStage(status=s, count=by_status.get(s, (0, Decimal(0)))[0], total_value=by_status.get(s, (0, Decimal(0)))[1]) for s in LeadStatus]
    return Pipeline(stages=stages, total_count=sum(s.count for s in stages), total_value=sum((s.total_value for s in stages), Decimal(0)))


# ---- CRUD ------------------------------------------------------------------

def _validate_owner(db: Session, company_id: int, owner_id: int) -> None:
    """An owner must be an internal (non-client) user of the lead's company."""
    owner = db.scalar(select(User).where(User.id == owner_id, User.company_id == company_id))
    if owner is None:
        raise NotFoundError("Owner not found")
    if owner.role.name == RoleName.CLIENT.value:
        raise UnprocessableError("A lead owner must be an internal user", {"owner_id": "Client users cannot own leads"})


def create_lead(db: Session, ctx: Ctx, data: LeadCreate) -> Lead:
    company_id = ctx.require_company()
    values = data.model_dump()
    if values["owner_id"] is None and ctx.user.company_id == company_id:
        values["owner_id"] = ctx.user.id  # default owner is the creator
    if values["owner_id"] is not None:
        _validate_owner(db, company_id, values["owner_id"])
    lead = Lead(company_id=company_id, **values)
    db.add(lead)
    db.flush()
    log_activity(db, ctx, "created", "lead", lead.id, f"Created lead {lead.company_name} ({lead.contact_name})")
    db.commit()
    return lead


def update_lead(db: Session, ctx: Ctx, lead_id: int, data: LeadUpdate) -> Lead:
    lead = get_lead(db, ctx, lead_id)
    changes = data.model_dump(exclude_unset=True)
    old_status = lead.status
    if "status" in changes and changes["status"] != old_status and lead.converted_client_id:
        raise ConflictError("A converted lead's status can no longer be changed", {"status": "Lead is already converted"})
    if changes.get("owner_id") is not None:
        _validate_owner(db, lead.company_id, changes["owner_id"])
    for field, value in changes.items():
        setattr(lead, field, value)
    log_activity(db, ctx, "updated", "lead", lead.id, f"Updated lead {lead.company_name}")
    if lead.status != old_status:
        log_activity(db, ctx, "status_changed", "lead", lead.id, f"Lead {lead.company_name} moved from {old_status.value} to {lead.status.value}")
        notify(db, [lead.owner_id], "Lead status updated", f"{lead.company_name} moved to {lead.status.value}.", NotificationType.SYSTEM, "lead", lead.id, exclude_user_id=ctx.user.id)
    db.commit()
    return lead


def delete_lead(db: Session, ctx: Ctx, lead_id: int) -> None:
    lead = get_lead(db, ctx, lead_id)
    if lead.converted_client_id:
        raise ConflictError("A converted lead is kept for history and cannot be deleted")
    name = lead.company_name
    db.delete(lead)  # activities go with it (FK ON DELETE CASCADE)
    log_activity(db, ctx, "deleted", "lead", lead_id, f"Deleted lead {name}")
    db.commit()


# ---- activities ------------------------------------------------------------

def add_activity(db: Session, ctx: Ctx, lead_id: int, data: LeadActivityCreate) -> LeadActivityOut:
    lead = get_lead(db, ctx, lead_id)
    if data.next_followup_date and data.activity_type != LeadActivityType.FOLLOW_UP:
        raise UnprocessableError("next_followup_date is only allowed on follow_up activities", {"next_followup_date": "Use a follow_up activity"})
    when = data.activity_date or utcnow()
    activity = LeadActivity(lead_id=lead.id, user_id=ctx.user.id, activity_type=data.activity_type, description=data.description, activity_date=when)
    db.add(activity)
    if data.activity_type in _CONTACT_ACTIVITIES:
        lead.last_contact_date = max(lead.last_contact_date, when.date()) if lead.last_contact_date else when.date()
    if data.next_followup_date:
        lead.next_followup_date = data.next_followup_date
    db.flush()
    log_activity(db, ctx, "created", "lead_activity", activity.id, f"Logged {data.activity_type.value} on lead {lead.company_name}")
    db.commit()
    return LeadActivityOut.model_validate(activity).model_copy(update={"user_name": ctx.user.name})


def activities_query(db: Session, ctx: Ctx, lead_id: int) -> Select:
    lead = get_lead(db, ctx, lead_id)
    return select(LeadActivity).where(LeadActivity.lead_id == lead.id).order_by(LeadActivity.activity_date.desc(), LeadActivity.id.desc())


def paginate_activities(db: Session, stmt: Select, pagination: PageParams) -> dict:
    page = paginate(db, stmt, pagination, lambda activity: activity)
    names = _user_names(db, {a.user_id for a in page["data"]})
    page["data"] = [LeadActivityOut.model_validate(a).model_copy(update={"user_name": names.get(a.user_id)}) for a in page["data"]]
    return page


# ---- conversion ------------------------------------------------------------

def _find_duplicate_client(db: Session, company_id: int, lead: Lead) -> Client | None:
    match = db.scalars(select(Client).where(Client.company_id == company_id, Client.company_name == lead.company_name)).first()
    if match is None and lead.email:
        match = db.scalars(select(Client).where(Client.company_id == company_id, Client.email == lead.email)).first()
    return match


def convert_lead(db: Session, ctx: Ctx, lead_id: int, data: LeadConvert) -> tuple[Lead, Client]:
    """Turns a lead into a client (or links it to an existing one) in a single transaction."""
    if data.existing_client_id is None and not ctx.can("create_clients"):
        raise ForbiddenError("Converting a lead creates a client, which needs the create_clients permission")
    lead = get_lead(db, ctx, lead_id)
    if lead.converted_client_id:
        raise ConflictError("This lead has already been converted", {"converted_client_id": lead.converted_client_id})
    if lead.status == LeadStatus.LOST:
        raise UnprocessableError("A lost lead cannot be converted", {"status": "Lead is lost"})

    if data.existing_client_id is not None:
        client = get_scoped_or_404(db, ctx, Client, data.existing_client_id, "Client")
        if client.company_id != lead.company_id:  # only reachable by a super admin browsing all companies
            raise NotFoundError("Client not found")
        summary = f"Converted to existing client {client.company_name}"
    else:
        duplicate = _find_duplicate_client(db, lead.company_id, lead)
        if duplicate is not None:
            raise ConflictError(
                f"A client named {duplicate.company_name} already exists. Pass existing_client_id to link this lead to it.",
                {"existing_client_id": duplicate.id},
            )
        client = Client(
            company_id=lead.company_id, company_name=lead.company_name, contact_name=lead.contact_name,
            email=lead.email, phone=lead.phone, status=ClientStatus.ACTIVE, created_by=ctx.user.id,
        )
        client.contacts = [ClientContact(name=lead.contact_name, email=lead.email, phone=lead.phone, is_primary=True)]
        db.add(client)
        db.flush()
        log_activity(db, ctx, "created", "client", client.id, f"Created client {client.company_name} from a lead")
        summary = f"Converted to client {client.company_name}"

    lead.status = LeadStatus.WON
    lead.converted_client_id = client.id
    lead.converted_at = utcnow()
    db.add(LeadActivity(lead_id=lead.id, user_id=ctx.user.id, activity_type=LeadActivityType.NOTE, description=summary))
    log_activity(db, ctx, "converted", "lead", lead.id, f"Lead {lead.company_name}: {summary}")
    notify(db, [lead.owner_id], "Lead converted", f"{lead.company_name}: {summary}.", NotificationType.SYSTEM, "lead", lead.id, exclude_user_id=ctx.user.id)
    db.commit()
    return lead, client
