from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.deps import DbSession, Needs
from app.core.enums import QuotationStatus
from app.models.invoice import Quotation
from app.schemas.quotation import ConvertResult, QuotationCreate, QuotationDetail, QuotationOut, QuotationUpdate
from app.services import quotations as service
from app.utils.pagination import Pagination, Sorting, apply_sort, paginate
from app.utils.responses import ERROR_RESPONSES, Envelope, Page, ok

router = APIRouter(prefix="/quotations", tags=["Quotations"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})

SORT_FIELDS = {
    "id": Quotation.id,
    "issue_date": Quotation.issue_date,
    "valid_until": Quotation.valid_until,
    "total_amount": Quotation.total_amount,
    "quotation_number": Quotation.quotation_number,
    "created_at": Quotation.created_at,
}

Conflict = ERROR_RESPONSES[422] | {"description": "The quotation is in a state that does not allow this action"}


def _detail(db, quotation: Quotation) -> QuotationDetail:
    detail = QuotationDetail.model_validate(quotation)
    invoice = service.linked_invoice(db, quotation)
    if invoice:
        detail.invoice_id, detail.invoice_number = invoice.id, invoice.invoice_number
    return detail


@router.get("", response_model=Page[QuotationOut], summary="List quotations")
def list_quotations(
    ctx: Needs("view_quotations"),
    db: DbSession,
    pagination: Pagination,
    sorting: Sorting,
    status_: Annotated[QuotationStatus | None, Query(alias="status")] = None,
    client_id: int | None = None,
    project_id: int | None = None,
    search: Annotated[str | None, Query(description="Matches quotation number and client name")] = None,
):
    stmt = service.list_query(ctx, status=status_, client_id=client_id, project_id=project_id, search=search)
    stmt = apply_sort(stmt, sorting, SORT_FIELDS, "created_at")
    return paginate(db, stmt, pagination, QuotationOut.model_validate)


@router.post(
    "",
    response_model=Envelope[QuotationDetail],
    status_code=status.HTTP_201_CREATED,
    summary="Create a quotation",
    description="Created as `draft`. Totals are computed by the server (same rules as invoices). Number: `QUO-<year>-<seq>`.",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
def create_quotation(body: QuotationCreate, ctx: Needs("manage_quotations"), db: DbSession):
    return ok(_detail(db, service.create_quotation(db, ctx, body)), "Quotation created successfully")


@router.get("/{quotation_id}", response_model=Envelope[QuotationDetail], summary="Get a quotation with its items", responses={404: ERROR_RESPONSES[404]})
def get_quotation(quotation_id: int, ctx: Needs("view_quotations"), db: DbSession):
    return ok(_detail(db, service.get_quotation(db, ctx, quotation_id)))


@router.put(
    "/{quotation_id}",
    response_model=Envelope[QuotationDetail],
    summary="Edit a quotation",
    description="Draft or sent quotations only (409 otherwise). When `items` is given it replaces every line.",
    responses={404: ERROR_RESPONSES[404], 409: Conflict, 422: ERROR_RESPONSES[422]},
)
def update_quotation(quotation_id: int, body: QuotationUpdate, ctx: Needs("manage_quotations"), db: DbSession):
    return ok(_detail(db, service.update_quotation(db, ctx, quotation_id, body)), "Quotation updated successfully")


@router.delete(
    "/{quotation_id}",
    response_model=Envelope[None],
    summary="Delete a draft quotation",
    responses={404: ERROR_RESPONSES[404], 409: Conflict},
)
def delete_quotation(quotation_id: int, ctx: Needs("manage_quotations"), db: DbSession):
    service.delete_quotation(db, ctx, quotation_id)
    return ok(None, "Quotation deleted successfully")


@router.post("/{quotation_id}/send", response_model=Envelope[QuotationDetail], summary="Mark a draft quotation as sent", responses={404: ERROR_RESPONSES[404], 409: Conflict})
def send_quotation(quotation_id: int, ctx: Needs("manage_quotations"), db: DbSession):
    return ok(_detail(db, service.send_quotation(db, ctx, quotation_id)), "Quotation sent successfully")


@router.post("/{quotation_id}/accept", response_model=Envelope[QuotationDetail], summary="Record that the client accepted (sent -> accepted)", responses={404: ERROR_RESPONSES[404], 409: Conflict})
def accept_quotation(quotation_id: int, ctx: Needs("manage_quotations"), db: DbSession):
    return ok(_detail(db, service.accept_quotation(db, ctx, quotation_id)), "Quotation accepted")


@router.post("/{quotation_id}/reject", response_model=Envelope[QuotationDetail], summary="Record that the client rejected (sent -> rejected)", responses={404: ERROR_RESPONSES[404], 409: Conflict})
def reject_quotation(quotation_id: int, ctx: Needs("manage_quotations"), db: DbSession):
    return ok(_detail(db, service.reject_quotation(db, ctx, quotation_id)), "Quotation rejected")


@router.post(
    "/{quotation_id}/convert",
    response_model=Envelope[ConvertResult],
    summary="Convert a quotation into a draft invoice",
    description="Only sent or accepted quotations. Creates a draft invoice (same client/project and items, issued today, due in 15 days), "
    "links it via `invoice.quotation_id` and marks the quotation `converted`. 409 if it was already converted.",
    responses={404: ERROR_RESPONSES[404], 409: Conflict},
)
def convert_quotation(quotation_id: int, ctx: Needs("manage_quotations"), db: DbSession):
    quotation, invoice = service.convert_quotation(db, ctx, quotation_id)
    result = ConvertResult(quotation_id=quotation.id, invoice_id=invoice.id, invoice_number=invoice.invoice_number)
    return ok(result, "Quotation converted to invoice")
