"""Client (customer) business rules. Routers call these; they never touch HTTP."""
from decimal import Decimal

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.deps import Ctx
from app.core.enums import ClientStatus, InvoiceStatus, ProjectStatus, TicketStatus
from app.core.exceptions import ConflictError, NotFoundError
from app.models.client import Client, ClientContact
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.project import Project
from app.models.ticket import Ticket
from app.schemas.client import ClientCreate, ClientUpdate, ContactCreate, ContactUpdate
from app.services.activity import log_activity
from app.services.common import get_scoped_or_404
from app.utils.pagination import like_any


def list_query(ctx: Ctx, *, search: str | None, status: ClientStatus | None, industry: str | None) -> Select:
    stmt = ctx.scope(select(Client), Client)
    if ctx.is_client:  # a client user only ever sees their own client record
        stmt = stmt.where(Client.id == ctx.client_id)
    if search:
        stmt = stmt.where(like_any(search, Client.company_name, Client.contact_name, Client.email, Client.city))
    if status:
        stmt = stmt.where(Client.status == status)
    if industry:
        stmt = stmt.where(Client.industry == industry)
    return stmt


def get_client(db: Session, ctx: Ctx, client_id: int) -> Client:
    if ctx.is_client and client_id != ctx.client_id:
        # same answer as a missing row, so ids of other clients are not discoverable
        raise NotFoundError("Client not found")
    return get_scoped_or_404(db, ctx, Client, client_id, "Client")


def _assert_unique(db: Session, company_id: int, *, name: str | None, email: str | None, exclude_id: int | None = None) -> None:
    if name:
        stmt = select(Client.id).where(Client.company_id == company_id, Client.company_name == name)
        if exclude_id:
            stmt = stmt.where(Client.id != exclude_id)
        if db.scalar(stmt):
            raise ConflictError("A client with this company name already exists", {"company_name": "Already exists"})
    if email:
        stmt = select(Client.id).where(Client.company_id == company_id, Client.email == email)
        if exclude_id:
            stmt = stmt.where(Client.id != exclude_id)
        if db.scalar(stmt):
            raise ConflictError("A client with this email already exists", {"email": "Already exists"})


def create_client(db: Session, ctx: Ctx, data: ClientCreate) -> Client:
    company_id = ctx.require_company()
    _assert_unique(db, company_id, name=data.company_name, email=data.email)
    values = data.model_dump(exclude={"contacts"})
    client = Client(company_id=company_id, created_by=ctx.user.id, **values)
    client.contacts = [ClientContact(**c.model_dump()) for c in data.contacts]
    _ensure_single_primary(client.contacts)
    db.add(client)
    db.flush()
    log_activity(db, ctx, "created", "client", client.id, f"Created client {client.company_name}")
    db.commit()
    return client


def update_client(db: Session, ctx: Ctx, client_id: int, data: ClientUpdate) -> Client:
    client = get_scoped_or_404(db, ctx, Client, client_id, "Client")
    changes = data.model_dump(exclude_unset=True)
    _assert_unique(db, client.company_id, name=changes.get("company_name"), email=changes.get("email"), exclude_id=client.id)
    for field, value in changes.items():
        setattr(client, field, value)
    log_activity(db, ctx, "updated", "client", client.id, f"Updated client {client.company_name}")
    db.commit()
    return client


def has_history(db: Session, client_id: int) -> bool:
    return any(
        db.scalar(select(func.count()).select_from(model).where(model.client_id == client_id))
        for model in (Project, Invoice, Payment, Ticket)
    )


def delete_client(db: Session, ctx: Ctx, client_id: int) -> str:
    """Hard-deletes an unused client; a client with projects/invoices/tickets is archived so history survives."""
    client = get_scoped_or_404(db, ctx, Client, client_id, "Client")
    if has_history(db, client.id):
        client.status = ClientStatus.ARCHIVED
        log_activity(db, ctx, "archived", "client", client.id, f"Archived client {client.company_name} (has related records)")
        db.commit()
        return "archived"
    name = client.company_name
    db.delete(client)
    log_activity(db, ctx, "deleted", "client", client_id, f"Deleted client {name}")
    db.commit()
    return "deleted"


def client_stats(db: Session, client_id: int) -> dict:
    projects = db.scalar(select(func.count()).select_from(Project).where(Project.client_id == client_id)) or 0
    active = db.scalar(select(func.count()).select_from(Project).where(Project.client_id == client_id, Project.status == ProjectStatus.ACTIVE)) or 0
    billed, paid = db.execute(
        select(func.coalesce(func.sum(Invoice.total_amount), 0), func.coalesce(func.sum(Invoice.paid_amount), 0)).where(
            Invoice.client_id == client_id, Invoice.status.notin_([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED])
        )
    ).one()
    open_tickets = db.scalar(
        select(func.count()).select_from(Ticket).where(Ticket.client_id == client_id, Ticket.status.in_([TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_FOR_CLIENT]))
    ) or 0
    return {
        "projects": projects,
        "active_projects": active,
        "total_billed": Decimal(billed),
        "total_paid": Decimal(paid),
        "outstanding": Decimal(billed) - Decimal(paid),
        "open_tickets": open_tickets,
    }


# ---- contacts -------------------------------------------------------------

def _ensure_single_primary(contacts: list[ClientContact], keep: ClientContact | None = None) -> None:
    primaries = [c for c in contacts if c.is_primary]
    if len(primaries) > 1:
        winner = keep if keep in primaries else primaries[0]
        for contact in primaries:
            contact.is_primary = contact is winner


def add_contact(db: Session, ctx: Ctx, client_id: int, data: ContactCreate) -> ClientContact:
    client = get_scoped_or_404(db, ctx, Client, client_id, "Client")
    contact = ClientContact(client_id=client.id, **data.model_dump())
    client.contacts.append(contact)
    if contact.is_primary:
        _ensure_single_primary(client.contacts, keep=contact)
    db.flush()
    log_activity(db, ctx, "created", "client_contact", contact.id, f"Added contact {contact.name} to {client.company_name}")
    db.commit()
    return contact


def _get_contact(client: Client, contact_id: int) -> ClientContact:
    contact = next((c for c in client.contacts if c.id == contact_id), None)
    if contact is None:
        raise NotFoundError("Contact not found")
    return contact


def update_contact(db: Session, ctx: Ctx, client_id: int, contact_id: int, data: ContactUpdate) -> ClientContact:
    client = get_scoped_or_404(db, ctx, Client, client_id, "Client")
    contact = _get_contact(client, contact_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(contact, field, value)
    if contact.is_primary:
        _ensure_single_primary(client.contacts, keep=contact)
    log_activity(db, ctx, "updated", "client_contact", contact.id, f"Updated contact {contact.name} of {client.company_name}")
    db.commit()
    return contact


def delete_contact(db: Session, ctx: Ctx, client_id: int, contact_id: int) -> None:
    client = get_scoped_or_404(db, ctx, Client, client_id, "Client")
    contact = _get_contact(client, contact_id)
    client.contacts.remove(contact)
    log_activity(db, ctx, "deleted", "client_contact", contact_id, f"Removed contact {contact.name} from {client.company_name}")
    db.commit()

