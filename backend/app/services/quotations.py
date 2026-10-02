"""Quotations: draft -> sent -> accepted/rejected, and conversion into a draft invoice."""
from datetime import date, timedelta

from sqlalchemy import Select, select
from sqlalchemy.orm import Session, joinedload

from app.core.deps import Ctx
from app.core.enums import InvoiceStatus, QuotationStatus
from app.core.exceptions import ConflictError, NotFoundError, UnprocessableError
from app.models.client import Client
from app.models.invoice import Invoice, InvoiceItem, Quotation, QuotationItem
from app.schemas.quotation import QuotationCreate, QuotationUpdate
from app.services.activity import log_activity
from app.services.billing_math import validated_totals
from app.services.common import get_scoped_or_404
from app.services.invoices import add_numbered, apply_totals, build_items, next_number, validate_project
from app.utils.pagination import like_any

CONVERTIBLE = (QuotationStatus.ACCEPTED, QuotationStatus.SENT)
DEFAULT_TERMS_DAYS = 15


def list_query(
    ctx: Ctx,
    *,
    status: QuotationStatus | None = None,
    client_id: int | None = None,
    project_id: int | None = None,
    search: str | None = None,
) -> Select:
    stmt = ctx.scope(select(Quotation), Quotation).options(joinedload(Quotation.client), joinedload(Quotation.project))
    if status:
        stmt = stmt.where(Quotation.status == status)
    if client_id:
        stmt = stmt.where(Quotation.client_id == client_id)
    if project_id:
        stmt = stmt.where(Quotation.project_id == project_id)
    if search:
        by_client = Quotation.client_id.in_(select(Client.id).where(like_any(search, Client.company_name)))
        stmt = stmt.where(like_any(search, Quotation.quotation_number) | by_client)
    return stmt


def get_quotation(db: Session, ctx: Ctx, quotation_id: int, *, lock: bool = False) -> Quotation:
    stmt = ctx.scope(select(Quotation).where(Quotation.id == quotation_id), Quotation)
    if lock:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    quotation = db.scalars(stmt).first()
    if quotation is None:
        raise NotFoundError("Quotation not found")
    return quotation


def linked_invoice(db: Session, quotation: Quotation) -> Invoice | None:
    return db.scalars(select(Invoice).where(Invoice.quotation_id == quotation.id).order_by(Invoice.id)).first()


def _check_valid_until(issue: date, valid_until: date | None) -> None:
    if valid_until and valid_until < issue:
        raise UnprocessableError("valid_until cannot be before issue_date", {"valid_until": "Cannot be before issue_date"})


def create_quotation(db: Session, ctx: Ctx, data: QuotationCreate) -> Quotation:
    company_id = ctx.require_company()
    client = get_scoped_or_404(db, ctx, Client, data.client_id, "Client")
    validate_project(db, ctx, data.project_id, client.id)
    totals = validated_totals(data.items, data.additional_discount)

    quotation = Quotation(
        company_id=company_id,
        client_id=client.id,
        project_id=data.project_id,
        issue_date=data.issue_date,
        valid_until=data.valid_until,
        notes=data.notes,
        status=QuotationStatus.DRAFT,
        created_by=ctx.user.id,
    )
    apply_totals(quotation, totals)
    quotation.items = build_items(QuotationItem, data.items, totals)
    prefix = f"QUO-{data.issue_date.year}-"
    add_numbered(db, quotation, "quotation_number", lambda: next_number(db, Quotation, "quotation_number", company_id, prefix, 3))
    log_activity(db, ctx, "created", "quotation", quotation.id, f"Created quotation {quotation.quotation_number} for {client.company_name}")
    db.commit()
    db.refresh(quotation)
    return quotation


def update_quotation(db: Session, ctx: Ctx, quotation_id: int, data: QuotationUpdate) -> Quotation:
    quotation = get_quotation(db, ctx, quotation_id, lock=True)
    if quotation.status not in (QuotationStatus.DRAFT, QuotationStatus.SENT):
        raise ConflictError(f"A {quotation.status.value} quotation cannot be edited")

    changes = data.model_dump(exclude_unset=True, exclude={"items"})
    client_id = changes.get("client_id", quotation.client_id)
    project_id = changes.get("project_id", quotation.project_id)
    if client_id != quotation.client_id:
        get_scoped_or_404(db, ctx, Client, client_id, "Client")
    if client_id != quotation.client_id or project_id != quotation.project_id:
        validate_project(db, ctx, project_id, client_id)
    _check_valid_until(changes.get("issue_date", quotation.issue_date), changes.get("valid_until", quotation.valid_until))

    items_in = data.items if data.items is not None else quotation.items
    totals = validated_totals(items_in, changes.get("additional_discount", quotation.additional_discount))
    for field, value in changes.items():
        if field != "additional_discount":
            setattr(quotation, field, value)
    apply_totals(quotation, totals)
    if data.items is not None:
        quotation.items = build_items(QuotationItem, data.items, totals)
    log_activity(db, ctx, "updated", "quotation", quotation.id, f"Updated quotation {quotation.quotation_number}")
    db.commit()
    db.refresh(quotation)
    return quotation


def delete_quotation(db: Session, ctx: Ctx, quotation_id: int) -> None:
    quotation = get_quotation(db, ctx, quotation_id, lock=True)
    if quotation.status != QuotationStatus.DRAFT:
        raise ConflictError("Only draft quotations can be deleted")
    number = quotation.quotation_number
    db.delete(quotation)
    log_activity(db, ctx, "deleted", "quotation", quotation_id, f"Deleted draft quotation {number}")
    db.commit()


def _transition(db: Session, ctx: Ctx, quotation_id: int, allowed: tuple[QuotationStatus, ...], target: QuotationStatus, action: str, verb: str) -> Quotation:
    quotation = get_quotation(db, ctx, quotation_id, lock=True)
    if quotation.status not in allowed:
        raise ConflictError(f"A {quotation.status.value} quotation cannot be {verb}")
    quotation.status = target
    log_activity(db, ctx, action, "quotation", quotation.id, f"Quotation {quotation.quotation_number} {verb}")
    db.commit()
    db.refresh(quotation)
    return quotation


def send_quotation(db: Session, ctx: Ctx, quotation_id: int) -> Quotation:
    return _transition(db, ctx, quotation_id, (QuotationStatus.DRAFT,), QuotationStatus.SENT, "sent", "sent")


def accept_quotation(db: Session, ctx: Ctx, quotation_id: int) -> Quotation:
    return _transition(db, ctx, quotation_id, (QuotationStatus.SENT,), QuotationStatus.ACCEPTED, "approved", "accepted")


def reject_quotation(db: Session, ctx: Ctx, quotation_id: int) -> Quotation:
    return _transition(db, ctx, quotation_id, (QuotationStatus.SENT,), QuotationStatus.REJECTED, "rejected", "rejected")


def convert_quotation(db: Session, ctx: Ctx, quotation_id: int) -> tuple[Quotation, Invoice]:
    """Creates a DRAFT invoice from the quotation's lines (same client/project) and marks the quotation converted."""
    quotation = get_quotation(db, ctx, quotation_id, lock=True)
    if quotation.status == QuotationStatus.CONVERTED:
        raise ConflictError("This quotation has already been converted to an invoice")
    if quotation.status not in CONVERTIBLE:
        raise ConflictError(f"A {quotation.status.value} quotation cannot be converted; it must be sent or accepted")

    today = date.today()
    totals = validated_totals(quotation.items, quotation.additional_discount)
    invoice = Invoice(
        company_id=quotation.company_id,
        client_id=quotation.client_id,
        project_id=quotation.project_id,
        quotation_id=quotation.id,
        issue_date=today,
        due_date=today + timedelta(days=DEFAULT_TERMS_DAYS),
        payment_terms=f"Net {DEFAULT_TERMS_DAYS}",
        notes=quotation.notes,
        status=InvoiceStatus.DRAFT,
        paid_amount=0,
        balance_amount=totals.total_amount,
        created_by=ctx.user.id,
    )
    apply_totals(invoice, totals)
    invoice.items = build_items(InvoiceItem, quotation.items, totals)
    prefix = f"INV-{today.year}-"
    add_numbered(db, invoice, "invoice_number", lambda: next_number(db, Invoice, "invoice_number", quotation.company_id, prefix, 5))

    quotation.status = QuotationStatus.CONVERTED
    log_activity(db, ctx, "created", "invoice", invoice.id, f"Created invoice {invoice.invoice_number} from quotation {quotation.quotation_number}")
    log_activity(db, ctx, "converted", "quotation", quotation.id, f"Converted quotation {quotation.quotation_number} to invoice {invoice.invoice_number}")
    db.commit()
    db.refresh(quotation)
    db.refresh(invoice)
    return quotation, invoice
