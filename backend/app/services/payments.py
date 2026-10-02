"""Payment ledger. Recording a payment updates the invoice in the same transaction; payments are never edited or deleted."""
from datetime import date

from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.deps import Ctx
from app.core.enums import InvoiceStatus, NotificationType, PaymentMethod
from app.core.exceptions import ConflictError, NotFoundError, UnprocessableError
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.schemas.payment import PaymentCreate
from app.services.activity import log_activity
from app.services.billing_math import balance_of
from app.services.invoices import client_user_ids
from app.services.notifications import notify
from app.utils.pagination import like_any

PAYABLE = (InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE)


def visible(ctx: Ctx, stmt: Select) -> Select:
    stmt = ctx.scope(stmt, Payment)
    if ctx.is_client:
        stmt = stmt.where(Payment.client_id == ctx.client_id)
    return stmt


def list_query(
    ctx: Ctx,
    *,
    invoice_id: int | None = None,
    client_id: int | None = None,
    payment_method: PaymentMethod | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    search: str | None = None,
) -> Select:
    stmt = visible(ctx, select(Payment)).options(joinedload(Payment.invoice), joinedload(Payment.client))
    if invoice_id:
        stmt = stmt.where(Payment.invoice_id == invoice_id)
    if client_id:
        stmt = stmt.where(Payment.client_id == client_id)
    if payment_method:
        stmt = stmt.where(Payment.payment_method == payment_method)
    if date_from:
        stmt = stmt.where(Payment.payment_date >= date_from)
    if date_to:
        stmt = stmt.where(Payment.payment_date <= date_to)
    if search:
        by_invoice = Payment.invoice_id.in_(select(Invoice.id).where(like_any(search, Invoice.invoice_number)))
        stmt = stmt.where(or_(like_any(search, Payment.reference_number), by_invoice))
    return stmt


def get_payment(db: Session, ctx: Ctx, payment_id: int) -> Payment:
    payment = db.scalars(visible(ctx, select(Payment).where(Payment.id == payment_id))).first()
    if payment is None:
        raise NotFoundError("Payment not found")
    return payment


def create_payment(db: Session, ctx: Ctx, data: PaymentCreate) -> Payment:
    ctx.require_company()
    # Row lock: two people paying the same invoice at once are serialized, so the balance check below
    # always sees the previous payment and the invoice can never be overpaid.
    invoice = db.scalars(ctx.scope(select(Invoice).where(Invoice.id == data.invoice_id), Invoice).with_for_update().execution_options(populate_existing=True)).first()
    if invoice is None:
        raise NotFoundError("Invoice not found")
    if invoice.status not in PAYABLE:
        raise ConflictError(f"Payments cannot be recorded against a {invoice.status.value.replace('_', ' ')} invoice")
    if data.payment_date > date.today():
        raise UnprocessableError("Payment date cannot be in the future", {"payment_date": "Cannot be in the future"})
    if data.amount > invoice.balance_amount:
        raise UnprocessableError(
            f"Amount exceeds the outstanding balance of {invoice.balance_amount}", {"amount": f"Outstanding balance is {invoice.balance_amount}"}
        )

    payment = Payment(
        company_id=invoice.company_id,
        invoice_id=invoice.id,
        client_id=invoice.client_id,  # from the invoice, never from the request
        amount=data.amount,
        payment_date=data.payment_date,
        payment_method=data.payment_method,
        reference_number=data.reference_number,
        notes=data.notes,
        created_by=ctx.user.id,
    )
    db.add(payment)
    invoice.paid_amount = invoice.paid_amount + data.amount
    invoice.balance_amount = balance_of(invoice.total_amount, invoice.paid_amount)
    settled = invoice.balance_amount == 0
    invoice.status = InvoiceStatus.PAID if settled else InvoiceStatus.PARTIALLY_PAID
    db.flush()

    log_activity(db, ctx, "created", "payment", payment.id, f"Recorded payment of {data.amount} for invoice {invoice.invoice_number}")
    if settled:
        log_activity(db, ctx, "status_changed", "invoice", invoice.id, f"Invoice {invoice.invoice_number} marked as paid")
    notify(
        db,
        [invoice.created_by, *client_user_ids(db, invoice.client_id)],
        f"Payment received for {invoice.invoice_number}",
        f"{data.amount} received via {data.payment_method.value.replace('_', ' ')}. Balance: {invoice.balance_amount}.",
        NotificationType.PAYMENT,
        "payment",
        payment.id,
        exclude_user_id=ctx.user.id,
    )
    db.commit()
    db.refresh(payment)
    return payment
