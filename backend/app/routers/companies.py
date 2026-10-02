from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.deps import DbSession, Needs
from app.core.enums import CompanyStatus
from app.models.company import Company
from app.schemas.company_admin import CompanyCreate, CompanyCreated, CompanyOut, CompanyStatusUpdate, CompanyUpdate, CompanyListItem
from app.services import companies as service
from app.utils.pagination import Pagination, Sorting, apply_sort
from app.utils.responses import ERROR_RESPONSES, Envelope, Page, ok

router = APIRouter(prefix="/companies", tags=["Companies"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})

SORT_FIELDS = {"id": Company.id, "name": Company.name, "slug": Company.slug, "status": Company.status, "created_at": Company.created_at}
CONFLICT = ERROR_RESPONSES[422] | {"description": "Duplicate slug or admin email"}


@router.get(
    "",
    response_model=Page[CompanyListItem],
    summary="List companies (super admin)",
    description="Includes the number of user accounts in each company.",
)
def list_companies(
    ctx: Needs("manage_companies"),
    db: DbSession,
    pagination: Pagination,
    sorting: Sorting,
    search: Annotated[str | None, Query(description="Matches name, slug, email")] = None,
    status_: Annotated[CompanyStatus | None, Query(alias="status")] = None,
):
    stmt = apply_sort(service.list_query(search=search, status=status_), sorting, SORT_FIELDS, "created_at")
    return service.list_companies(db, stmt, pagination)


@router.post(
    "",
    response_model=Envelope[CompanyCreated],
    status_code=status.HTTP_201_CREATED,
    summary="Create a company with its first admin (super admin)",
    description="Creates the company and its first `company_admin` user in one transaction. The slug is generated from the name "
    "when omitted; a taken slug or admin email returns 409.",
    responses={409: CONFLICT, 422: ERROR_RESPONSES[422]},
)
def create_company(body: CompanyCreate, ctx: Needs("manage_companies"), db: DbSession):
    company, admin = service.create_company(db, ctx, body)
    return ok({**CompanyOut.model_validate(company).model_dump(), "admin": admin}, "Company created successfully")


# /me routes are declared before /{company_id} so "me" is never parsed as an id.
@router.get(
    "/me",
    response_model=Envelope[CompanyOut],
    summary="Get the caller's company settings",
    description="Requires `manage_settings`. A super admin must pass `?company_id=` (400 otherwise).",
    responses={400: ERROR_RESPONSES[404] | {"description": "Super admin without ?company_id="}},
)
def get_my_company(ctx: Needs("manage_settings"), db: DbSession):
    return ok(service.current_company(db, ctx))


@router.put(
    "/me",
    response_model=Envelope[CompanyOut],
    summary="Update the caller's company settings",
    description="Send only the fields to change: name, industry, address, phone, email, website, gstin, timezone, "
    "currency (USD, INR, EUR, GBP, AED, SGD, AUD), fiscal_year_start (january..december), logo_url. "
    "Requires `manage_settings`. A super admin must pass `?company_id=`.",
    responses={400: ERROR_RESPONSES[404] | {"description": "Super admin without ?company_id="}, 422: ERROR_RESPONSES[422]},
)
def update_my_company(body: CompanyUpdate, ctx: Needs("manage_settings"), db: DbSession):
    company = service.update_company(db, ctx, service.current_company(db, ctx), body)
    return ok(company, "Company settings updated successfully")


@router.get("/{company_id}", response_model=Envelope[CompanyOut], summary="Get a company (super admin)", responses={404: ERROR_RESPONSES[404]})
def get_company(company_id: int, ctx: Needs("manage_companies"), db: DbSession):
    return ok(service.get_company(db, company_id))


@router.put(
    "/{company_id}",
    response_model=Envelope[CompanyOut],
    summary="Update a company (super admin)",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
def update_company(company_id: int, body: CompanyUpdate, ctx: Needs("manage_companies"), db: DbSession):
    company = service.update_company(db, ctx, service.get_company(db, company_id), body)
    return ok(company, "Company updated successfully")


@router.patch(
    "/{company_id}/status",
    response_model=Envelope[CompanyOut],
    summary="Activate or suspend a company (super admin)",
    description="A suspended company's users are rejected (403) on every request and their refresh tokens are revoked.",
    responses={404: ERROR_RESPONSES[404]},
)
def update_company_status(company_id: int, body: CompanyStatusUpdate, ctx: Needs("manage_companies"), db: DbSession):
    company = service.set_status(db, ctx, service.get_company(db, company_id), body.status)
    return ok(company, "Company status updated successfully")
