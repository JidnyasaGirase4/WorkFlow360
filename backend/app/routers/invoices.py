from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.deps import DbSession, Needs
from app.core.enums import InvoiceStatus
from app.models.invoice import Invoice
from app.routers.payments import SORT_FIELDS as PAYMENT_SORT_FIELDS
from app.schemas.invoice import InvoiceCreate, InvoiceDetail, InvoiceOut, InvoiceUpdate, LineItemOut
from app.schemas.payment import PaymentOut
from app.services import clients as client_service
from app.services import invoices as service
from app.services import payments as payment_service
from app.utils.pagination import Pagination, Sorting, apply_sort, paginate
from app.utils.responses import ERROR_RESPONSES, Envelope, Page, ok

router = APIRouter(prefix="/invoices", tags=["Invoices"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})

SORT_FIELDS = {
    "id": Invoice.id,
    "issue_date": Invoice.issue_date,
    "due_date": Invoice.due_date,
    "total_amount": Invoice.total_amount,
    "balance_amount": Invoice.balance_amount,
    "invoice_number": Invoice.invoice_number,
    "created_at": Invoice.created_at,
}

Conflict = ERROR_RESPONSES[422] | {"description": "The invoice is in a state that does not allow this action"}


def _detail(db, ctx, invoice: Invoice) -> InvoiceDetail:
    detail = InvoiceDetail.model_validate(invoice)
    if ctx.is_internal:  # the audit feed names staff members; clients do not see it
        detail.activity = service.invoice_activity(db, invoice)
    return detail


@router.get(
    "",
    response_model=Page[InvoiceOut],
    summary="List invoices",
    description="Overdue status is reconciled on read, so `?status=overdue` (or `?overdue=true`) is always current. "
    "Client-role users only see their own client's invoices, and never drafts or cancelled ones.",
)
def list_invoices(
    ctx: Needs("view_invoices"),
    db: DbSession,
    pagination: Pagination,
    sorting: Sorting,
    status_: Annotated[InvoiceStatus | None, Query(alias="status")] = None,
    client_id: int | None = None,
    project_id: int | None = None,
    issue_date_from: date | None = None,
    issue_date_to: date | None = None,
    due_date_from: date | None = None,
    due_date_to: date | None = None,
    search: Annotated[str | None, Query(description="Matches invoice number and client name")] = None,
    overdue: bool | None = None,
):
    service.refresh_overdue(db, ctx)
    stmt = service.list_query(
        ctx,
        status=status_,
        client_id=client_id,
        project_id=project_id,
        issue_date_from=issue_date_from,
        issue_date_to=issue_date_to,
        due_date_from=due_date_from,
        due_date_to=due_date_to,
        search=search,
        overdue=overdue,
    )
    stmt = apply_sort(stmt, sorting, SORT_FIELDS, "created_at")
    return paginate(db, stmt, pagination, InvoiceOut.model_validate)


@router.post(
    "",
    response_model=Envelope[InvoiceDetail],
    status_code=status.HTTP_201_CREATED,
    summary="Create an invoice",
    description="Always created as `draft`. Subtotal, discount, tax, total and balance are computed by the server from the line items; "
    "sending any of them is a 422. The number is `INV-<year>-<seq>` per company.",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
def create_invoice(body: InvoiceCreate, ctx: Needs("create_invoices"), db: DbSession):
    return ok(_detail(db, ctx, service.create_invoice(db, ctx, body)), "Invoice created successfully")


@router.get("/{invoice_id}", response_model=Envelope[InvoiceDetail], summary="Get an invoice with items, payments and activity", responses={404: ERROR_RESPONSES[404]})
def get_invoice(invoice_id: int, ctx: Needs("view_invoices"), db: DbSession):
    return ok(_detail(db, ctx, service.get_invoice(db, ctx, invoice_id)))


@router.put(
    "/{invoice_id}",
    response_model=Envelope[InvoiceDetail],
    summary="Edit an invoice",
    description="Allowed while the invoice is a draft, or sent/overdue with no payments (409 otherwise). "
    "When `items` is given it replaces every line; all totals are recalculated.",
    responses={404: ERROR_RESPONSES[404], 409: Conflict, 422: ERROR_RESPONSES[422]},
)
def update_invoice(invoice_id: int, body: InvoiceUpdate, ctx: Needs("edit_invoices"), db: DbSession):
    return ok(_detail(db, ctx, service.update_invoice(db, ctx, invoice_id, body)), "Invoice updated successfully")


@router.delete(
    "/{invoice_id}",
    response_model=Envelope[None],
    summary="Delete a draft invoice",
    description="Only drafts can be deleted; anything that was issued must be cancelled instead (409).",
    responses={404: ERROR_RESPONSES[404], 409: Conflict},
)
def delete_invoice(invoice_id: int, ctx: Needs("delete_invoices"), db: DbSession):
    service.delete_invoice(db, ctx, invoice_id)
    return ok(None, "Invoice deleted successfully")


@router.post(
    "/{invoice_id}/send",
    response_model=Envelope[InvoiceDetail],
    summary="Send a draft invoice to the client",
    description="draft -> sent. Requires at least one item and a total above 0. Notifies the client's users.",
    responses={404: ERROR_RESPONSES[404], 409: Conflict, 422: ERROR_RESPONSES[422]},
)
def send_invoice(invoice_id: int, ctx: Needs("edit_invoices"), db: DbSession):
    return ok(_detail(db, ctx, service.send_invoice(db, ctx, invoice_id)), "Invoice sent successfully")


@router.post(
    "/{invoice_id}/cancel",
    response_model=Envelope[InvoiceDetail],
    summary="Cancel an invoice",
    description="Not possible once the invoice is paid or has any payment recorded (409).",
    responses={404: ERROR_RESPONSES[404], 409: Conflict},
)
def cancel_invoice(invoice_id: int, ctx: Needs("edit_invoices"), db: DbSession):
    return ok(_detail(db, ctx, service.cancel_invoice(db, ctx, invoice_id)), "Invoice cancelled successfully")


@router.get("/{invoice_id}/items", response_model=Envelope[list[LineItemOut]], summary="List an invoice's line items", responses={404: ERROR_RESPONSES[404]})
def list_items(invoice_id: int, ctx: Needs("view_invoices"), db: DbSession):
    return ok(service.get_invoice(db, ctx, invoice_id).items)


@router.get(
    "/{invoice_id}/payments",
    response_model=Envelope[list[PaymentOut]],
    summary="List payments recorded against an invoice",
    responses={404: ERROR_RESPONSES[404]},
)
def list_invoice_payments(invoice_id: int, ctx: Needs("view_invoices", "view_payments"), db: DbSession):
    return ok(service.get_invoice(db, ctx, invoice_id).payments)


# ---- GET /clients/{id}/invoices | payments (billing data of one client) ------------

clients_router = APIRouter(prefix="/clients", tags=["Clients"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})
extra_routers = [clients_router]


@clients_router.get(
    "/{client_id}/invoices",
    response_model=Page[InvoiceOut],
    summary="List a client's invoices",
    responses={404: ERROR_RESPONSES[404]},
)
def client_invoices(
    client_id: int,
    ctx: Needs("view_invoices"),
    db: DbSession,
    pagination: Pagination,
    sorting: Sorting,
    status_: Annotated[InvoiceStatus | None, Query(alias="status")] = None,
):
    client_service.get_client(db, ctx, client_id)  # 404 for other companies / other clients
    service.refresh_overdue(db, ctx)
    stmt = apply_sort(service.list_query(ctx, client_id=client_id, status=status_), sorting, SORT_FIELDS, "created_at")
    return paginate(db, stmt, pagination, InvoiceOut.model_validate)


@clients_router.get(
    "/{client_id}/payments",
    response_model=Page[PaymentOut],
    summary="List a client's payments",
    responses={404: ERROR_RESPONSES[404]},
)
def client_payments(client_id: int, ctx: Needs("view_payments"), db: DbSession, pagination: Pagination, sorting: Sorting):
    client_service.get_client(db, ctx, client_id)
    stmt = apply_sort(payment_service.list_query(ctx, client_id=client_id), sorting, PAYMENT_SORT_FIELDS, "payment_date")
    return paginate(db, stmt, pagination, PaymentOut.model_validate)
