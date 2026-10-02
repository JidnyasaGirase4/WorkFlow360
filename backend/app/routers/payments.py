from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.deps import DbSession, Needs
from app.core.enums import PaymentMethod
from app.models.payment import Payment
from app.schemas.payment import PaymentCreate, PaymentOut
from app.services import payments as service
from app.utils.pagination import Pagination, Sorting, apply_sort, paginate
from app.utils.responses import ERROR_RESPONSES, Envelope, Page, ok

router = APIRouter(prefix="/payments", tags=["Payments"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})

SORT_FIELDS = {"id": Payment.id, "payment_date": Payment.payment_date, "amount": Payment.amount, "created_at": Payment.created_at}


@router.get(
    "",
    response_model=Page[PaymentOut],
    summary="List payments",
    description="The payment ledger. Client-role users only see payments against their own invoices.",
)
def list_payments(
    ctx: Needs("view_payments"),
    db: DbSession,
    pagination: Pagination,
    sorting: Sorting,
    invoice_id: int | None = None,
    client_id: int | None = None,
    payment_method: PaymentMethod | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    search: Annotated[str | None, Query(description="Matches the reference number and invoice number")] = None,
):
    stmt = service.list_query(ctx, invoice_id=invoice_id, client_id=client_id, payment_method=payment_method, date_from=date_from, date_to=date_to, search=search)
    stmt = apply_sort(stmt, sorting, SORT_FIELDS, "payment_date")
    return paginate(db, stmt, pagination, PaymentOut.model_validate)


@router.post(
    "",
    response_model=Envelope[PaymentOut],
    status_code=status.HTTP_201_CREATED,
    summary="Record a payment against an invoice",
    description="Atomically (row-locking the invoice) validates the amount against the outstanding balance, stores the payment, "
    "updates the invoice's paid/balance/status (`partially_paid` or `paid`), writes the audit log and notifies the invoice creator "
    "and the client's users. The invoice must be sent, partially paid or overdue (409 otherwise); an amount above the balance is a 422. "
    "Payments cannot be edited or deleted.",
    responses={404: ERROR_RESPONSES[404], 409: ERROR_RESPONSES[422] | {"description": "Invoice cannot receive payments"}, 422: ERROR_RESPONSES[422]},
)
def create_payment(body: PaymentCreate, ctx: Needs("create_payments"), db: DbSession):
    return ok(service.create_payment(db, ctx, body), "Payment recorded successfully")


@router.get("/{payment_id}", response_model=Envelope[PaymentOut], summary="Get a payment", responses={404: ERROR_RESPONSES[404]})
def get_payment(payment_id: int, ctx: Needs("view_payments"), db: DbSession):
    return ok(service.get_payment(db, ctx, payment_id))
