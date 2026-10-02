"""Invoice business rules: numbering, totals, lifecycle (draft -> sent -> partially_paid/paid/overdue, cancelled)."""
from collections.abc import Callable
from datetime import date
from typing import Any

from sqlalchemy import Integer, Select, and_, cast, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.deps import Ctx
from app.core.enums import InvoiceStatus, NotificationType, UserStatus
from app.core.exceptions import ConflictError, NotFoundError, UnprocessableError
from app.models.activity import ActivityLog
from app.models.client import Client
from app.models.invoice import Invoice, InvoiceItem
from app.models.payment import Payment
from app.models.project import Project
from app.models.user import User
from app.schemas.invoice import ActivityEntry, InvoiceCreate, InvoiceUpdate
from app.services.activity import log_activity
from app.services.billing_math import Totals, balance_of, validated_totals
from app.services.common import get_scoped_or_404
from app.services.notifications import notify
from app.utils.pagination import like_any

CLIENT_HIDDEN = (InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED)
OPEN_STATES = (InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID)


# ---- overdue bookkeeping -------------------------------------------------------

def _refresh_overdue(db: Session, company_id: int | None) -> int:
    """Status is derived from due_date, so it is reconciled on read instead of by a cron job."""
    today = date.today()
    scope = [Invoice.company_id == company_id] if company_id is not None else []
    opts = {"synchronize_session": False}
    changed = db.execute(
        update(Invoice).where(*scope, Invoice.status.in_(OPEN_STATES), Invoice.due_date < today, Invoice.balance_amount > 0)
        .values(status=InvoiceStatus.OVERDUE).execution_options(**opts)
    ).rowcount
    for paid_clause, status in ((Invoice.paid_amount > 0, InvoiceStatus.PARTIALLY_PAID), (Invoice.paid_amount == 0, InvoiceStatus.SENT)):
        changed += db.execute(
            update(Invoice).where(*scope, Invoice.status == InvoiceStatus.OVERDUE, Invoice.due_date >= today, paid_clause)
            .values(status=status).execution_options(**opts)
        ).rowcount
    if changed:
        db.commit()
    return changed


def refresh_overdue(db: Session, ctx: Ctx) -> int:
    """sent/partially_paid invoices past their due date with a balance become overdue (and back if the due date moved)."""
    return _refresh_overdue(db, ctx.company_id)


def refresh_overdue_all(db: Session) -> int:
    """Same, across every company (for jobs and other modules such as dashboards)."""
    return _refresh_overdue(db, None)


# ---- shared billing helpers (quotations reuse them) -----------------------------

def next_number(db: Session, model: type, column: str, company_id: int, prefix: str, width: int) -> str:
    """`prefix` + (highest existing sequence in this company + 1), zero padded."""
    col = getattr(model, column)
    highest = db.scalar(
        select(func.max(cast(func.substr(col, len(prefix) + 1), Integer))).where(model.company_id == company_id, col.like(f"{prefix}%"))
    )
    return f"{prefix}{(highest or 0) + 1:0{width}d}"


def add_numbered(db: Session, obj: Any, column: str, make_number: Callable[[], str]) -> None:
    """Insert `obj` with a fresh document number. Two writers can pick the same number; the unique
    constraint catches that and we retry once with the new maximum."""
    for attempt in (1, 2):
        setattr(obj, column, make_number())
        try:
            with db.begin_nested():
                db.add(obj)
                db.flush()
            return
        except IntegrityError:
            if attempt == 2:
                raise ConflictError("Could not allocate a document number, please try again") from None


def build_items(item_cls: type, items: list[Any], totals: Totals) -> list[Any]:
    return [
        item_cls(description=i.description, quantity=i.quantity, unit_price=i.unit_price, tax_rate=i.tax_rate, discount=line.discount, total=line.total)
        for i, line in zip(items, totals.lines, strict=True)
    ]


def apply_totals(doc: Any, totals: Totals) -> None:
    doc.subtotal = totals.subtotal
    doc.discount_amount = totals.discount_amount
    doc.additional_discount = totals.additional_discount
    doc.tax_amount = totals.tax_amount
    doc.total_amount = totals.total_amount


def validate_project(db: Session, ctx: Ctx, project_id: int | None, client_id: int) -> None:
    if project_id is None:
        return
    project = get_scoped_or_404(db, ctx, Project, project_id, "Project")
    if project.client_id != client_id:
        raise UnprocessableError("Project does not belong to this client", {"project_id": "Project belongs to a different client"})


def client_user_ids(db: Session, client_id: int) -> list[int]:
    return list(db.scalars(select(User.id).where(User.client_id == client_id, User.status == UserStatus.ACTIVE)))


# ---- queries --------------------------------------------------------------------

def visible(ctx: Ctx, stmt: Select) -> Select:
    stmt = ctx.scope(stmt, Invoice)
    if ctx.is_client:  # own invoices only, and never ones the company has not issued
        stmt = stmt.where(Invoice.client_id == ctx.client_id, Invoice.status.notin_(CLIENT_HIDDEN))
    return stmt


def list_query(
    ctx: Ctx,
    *,
    status: InvoiceStatus | None = None,
    client_id: int | None = None,
    project_id: int | None = None,
    issue_date_from: date | None = None,
    issue_date_to: date | None = None,
    due_date_from: date | None = None,
    due_date_to: date | None = None,
    search: str | None = None,
    overdue: bool | None = None,
) -> Select:
    stmt = visible(ctx, select(Invoice)).options(joinedload(Invoice.client), joinedload(Invoice.project), selectinload(Invoice.payments))
    if status:
        stmt = stmt.where(Invoice.status == status)
    if overdue:
        stmt = stmt.where(Invoice.status == InvoiceStatus.OVERDUE)
    if client_id:
        stmt = stmt.where(Invoice.client_id == client_id)
    if project_id:
        stmt = stmt.where(Invoice.project_id == project_id)
    for column, low, high in ((Invoice.issue_date, issue_date_from, issue_date_to), (Invoice.due_date, due_date_from, due_date_to)):
        if low:
            stmt = stmt.where(column >= low)
        if high:
            stmt = stmt.where(column <= high)
    if search:
        by_client = Invoice.client_id.in_(select(Client.id).where(like_any(search, Client.company_name)))
        stmt = stmt.where(or_(like_any(search, Invoice.invoice_number), by_client))
    return stmt


def get_invoice(db: Session, ctx: Ctx, invoice_id: int, *, lock: bool = False) -> Invoice:
    """`lock=True` takes a row lock so writers and payments cannot interleave on the same invoice."""
    refresh_overdue(db, ctx)
    stmt = visible(ctx, select(Invoice).where(Invoice.id == invoice_id))
    if lock:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    invoice = db.scalars(stmt).first()
    if invoice is None:
        raise NotFoundError("Invoice not found")
    return invoice


def invoice_activity(db: Session, invoice: Invoice) -> list[ActivityEntry]:
    payment_ids = select(Payment.id).where(Payment.invoice_id == invoice.id)
    rows = db.execute(
        select(ActivityLog, User.name)
        .outerjoin(User, User.id == ActivityLog.user_id)
        .where(
            or_(
                and_(ActivityLog.entity_type == "invoice", ActivityLog.entity_id == invoice.id),
                and_(ActivityLog.entity_type == "payment", ActivityLog.entity_id.in_(payment_ids)),
            )
        )
        .order_by(ActivityLog.created_at, ActivityLog.id)
    ).all()
    return [ActivityEntry(id=log.id, actor=name, action=log.action, description=log.description, created_at=log.created_at) for log, name in rows]


# ---- commands -------------------------------------------------------------------

def _check_dates(issue: date, due: date) -> None:
    if due < issue:
        raise UnprocessableError("due_date cannot be before issue_date", {"due_date": "Cannot be before issue_date"})


def create_invoice(db: Session, ctx: Ctx, data: InvoiceCreate) -> Invoice:
    company_id = ctx.require_company()
    client = get_scoped_or_404(db, ctx, Client, data.client_id, "Client")
    validate_project(db, ctx, data.project_id, client.id)
    totals = validated_totals(data.items, data.additional_discount)

    invoice = Invoice(
        company_id=company_id,
        client_id=client.id,
        project_id=data.project_id,
        issue_date=data.issue_date,
        due_date=data.due_date,
        payment_terms=data.payment_terms,
        notes=data.notes,
        status=InvoiceStatus.DRAFT,
        paid_amount=0,
        balance_amount=totals.total_amount,
        created_by=ctx.user.id,
    )
    apply_totals(invoice, totals)
    invoice.items = build_items(InvoiceItem, data.items, totals)
    prefix = f"INV-{data.issue_date.year}-"
    add_numbered(db, invoice, "invoice_number", lambda: next_number(db, Invoice, "invoice_number", company_id, prefix, 5))
    log_activity(db, ctx, "created", "invoice", invoice.id, f"Created invoice {invoice.invoice_number} for {client.company_name}")
    db.commit()
    db.refresh(invoice)
    return invoice


def update_invoice(db: Session, ctx: Ctx, invoice_id: int, data: InvoiceUpdate) -> Invoice:
    invoice = get_invoice(db, ctx, invoice_id, lock=True)
    editable = invoice.status == InvoiceStatus.DRAFT or (invoice.status in (InvoiceStatus.SENT, InvoiceStatus.OVERDUE) and invoice.paid_amount == 0)
    if not editable:
        raise ConflictError(f"A {invoice.status.value.replace('_', ' ')} invoice cannot be edited")

    changes = data.model_dump(exclude_unset=True, exclude={"items"})
    client_id = changes.get("client_id", invoice.client_id)
    project_id = changes.get("project_id", invoice.project_id)
    if client_id != invoice.client_id:
        get_scoped_or_404(db, ctx, Client, client_id, "Client")
    if client_id != invoice.client_id or project_id != invoice.project_id:
        validate_project(db, ctx, project_id, client_id)
    _check_dates(changes.get("issue_date", invoice.issue_date), changes.get("due_date", invoice.due_date))

    items_in = data.items if data.items is not None else invoice.items
    totals = validated_totals(items_in, changes.get("additional_discount", invoice.additional_discount))
    for field, value in changes.items():
        if field != "additional_discount":
            setattr(invoice, field, value)
    apply_totals(invoice, totals)
    invoice.balance_amount = balance_of(totals.total_amount, invoice.paid_amount)
    if data.items is not None:
        invoice.items = build_items(InvoiceItem, data.items, totals)
    if invoice.status == InvoiceStatus.OVERDUE and invoice.due_date >= date.today():
        invoice.status = InvoiceStatus.SENT  # the due date was moved out
    log_activity(db, ctx, "updated", "invoice", invoice.id, f"Updated invoice {invoice.invoice_number}")
    db.commit()
    db.refresh(invoice)
    return invoice


def delete_invoice(db: Session, ctx: Ctx, invoice_id: int) -> None:
    invoice = get_invoice(db, ctx, invoice_id, lock=True)
    if invoice.status != InvoiceStatus.DRAFT:
        raise ConflictError("Only draft invoices can be deleted; cancel it instead")
    number = invoice.invoice_number
    db.delete(invoice)
    log_activity(db, ctx, "deleted", "invoice", invoice_id, f"Deleted draft invoice {number}")
    db.commit()


def send_invoice(db: Session, ctx: Ctx, invoice_id: int) -> Invoice:
    invoice = get_invoice(db, ctx, invoice_id, lock=True)
    if invoice.status != InvoiceStatus.DRAFT:
        raise ConflictError("Only draft invoices can be sent")
    if not invoice.items or invoice.total_amount <= 0:
        raise UnprocessableError("An invoice needs at least one line item and a total above 0 before it can be sent")
    invoice.status = InvoiceStatus.SENT
    notify(
        db,
        client_user_ids(db, invoice.client_id),
        f"Invoice {invoice.invoice_number} received",
        f"Invoice {invoice.invoice_number} for {invoice.total_amount} is due on {invoice.due_date.isoformat()}.",
        NotificationType.INVOICE,
        "invoice",
        invoice.id,
        exclude_user_id=ctx.user.id,
    )
    log_activity(db, ctx, "sent", "invoice", invoice.id, f"Sent invoice {invoice.invoice_number} to the client")
    db.commit()
    db.refresh(invoice)
    return invoice


def cancel_invoice(db: Session, ctx: Ctx, invoice_id: int) -> Invoice:
    invoice = get_invoice(db, ctx, invoice_id, lock=True)
    if invoice.status == InvoiceStatus.CANCELLED:
        raise ConflictError("Invoice is already cancelled")
    has_payments = invoice.paid_amount > 0 or db.scalar(select(func.count()).select_from(Payment).where(Payment.invoice_id == invoice.id))
    if invoice.status == InvoiceStatus.PAID or has_payments:
        raise ConflictError("An invoice with recorded payments cannot be cancelled")
    invoice.status = InvoiceStatus.CANCELLED
    log_activity(db, ctx, "status_changed", "invoice", invoice.id, f"Cancelled invoice {invoice.invoice_number}")
    db.commit()
    db.refresh(invoice)
    return invoice
