from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.deps import CurrentCtx, DbSession, Needs
from app.core.enums import ClientStatus
from app.core.exceptions import ForbiddenError
from app.models.client import Client
from app.schemas.client import (
    ClientCreate,
    ClientDetail,
    ClientOut,
    ClientUpdate,
    ContactCreate,
    ContactOut,
    ContactUpdate,
)
from app.services import clients as service
from app.utils.pagination import Pagination, Sorting, apply_sort, paginate
from app.utils.responses import ERROR_RESPONSES, Envelope, Page, ok

router = APIRouter(prefix="/clients", tags=["Clients"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})

SORT_FIELDS = {"id": Client.id, "company_name": Client.company_name, "status": Client.status, "created_at": Client.created_at, "city": Client.city}


def _detail(db, client: Client) -> ClientDetail:
    return ClientDetail.model_validate({**ClientOut.model_validate(client).model_dump(), "contacts": client.contacts, "stats": service.client_stats(db, client.id)})


@router.get(
    "",
    response_model=Page[ClientOut],
    summary="List clients",
    description="Paginated, searchable list of the company's clients. Client-role users only ever see their own client.",
)
def list_clients(
    ctx: Needs("view_clients"),
    db: DbSession,
    pagination: Pagination,
    sorting: Sorting,
    search: Annotated[str | None, Query(description="Matches company name, contact, email, city")] = None,
    status_: Annotated[ClientStatus | None, Query(alias="status")] = None,
    industry: str | None = None,
):
    stmt = service.list_query(ctx, search=search, status=status_, industry=industry)
    stmt = apply_sort(stmt, sorting, SORT_FIELDS, "created_at")
    return paginate(db, stmt, pagination, ClientOut.model_validate)


@router.post(
    "",
    response_model=Envelope[ClientDetail],
    status_code=status.HTTP_201_CREATED,
    summary="Create a client",
    description="Optionally include `contacts`. Company name and email must be unique within the company (409 otherwise).",
    responses={409: ERROR_RESPONSES[422] | {"description": "Duplicate client"}, 422: ERROR_RESPONSES[422]},
)
def create_client(body: ClientCreate, ctx: Needs("create_clients"), db: DbSession):
    client = service.create_client(db, ctx, body)
    return ok(_detail(db, client), "Client created successfully")


@router.get(
    "/{client_id}",
    response_model=Envelope[ClientDetail],
    summary="Get a client with contacts and billing stats",
    responses={404: ERROR_RESPONSES[404]},
)
def get_client(client_id: int, ctx: CurrentCtx, db: DbSession):
    if not (ctx.can("view_clients") or ctx.is_client):
        raise ForbiddenError()
    return ok(_detail(db, service.get_client(db, ctx, client_id)))


@router.put(
    "/{client_id}",
    response_model=Envelope[ClientDetail],
    summary="Update a client",
    responses={404: ERROR_RESPONSES[404], 409: ERROR_RESPONSES[422] | {"description": "Duplicate client"}},
)
def update_client(client_id: int, body: ClientUpdate, ctx: Needs("edit_clients"), db: DbSession):
    client = service.update_client(db, ctx, client_id, body)
    return ok(_detail(db, client), "Client updated successfully")


@router.delete(
    "/{client_id}",
    response_model=Envelope[None],
    summary="Delete (or archive) a client",
    description="A client with no projects, invoices, payments or tickets is deleted. Otherwise it is **archived** "
    "so historical business data is preserved; the message says which happened.",
    responses={404: ERROR_RESPONSES[404]},
)
def delete_client(client_id: int, ctx: Needs("delete_clients"), db: DbSession):
    outcome = service.delete_client(db, ctx, client_id)
    return ok(None, f"Client {outcome} successfully")


@router.get(
    "/{client_id}/contacts",
    response_model=Envelope[list[ContactOut]],
    summary="List a client's contacts",
    responses={404: ERROR_RESPONSES[404]},
)
def list_contacts(client_id: int, ctx: Needs("view_clients"), db: DbSession):
    return ok(service.get_client(db, ctx, client_id).contacts)


@router.post(
    "/{client_id}/contacts",
    response_model=Envelope[ContactOut],
    status_code=status.HTTP_201_CREATED,
    summary="Add a contact to a client",
    description="Marking a contact `is_primary` demotes the previous primary contact.",
    responses={404: ERROR_RESPONSES[404]},
)
def add_contact(client_id: int, body: ContactCreate, ctx: Needs("edit_clients"), db: DbSession):
    return ok(service.add_contact(db, ctx, client_id, body), "Contact added successfully")


@router.put(
    "/{client_id}/contacts/{contact_id}",
    response_model=Envelope[ContactOut],
    summary="Update a client contact",
    responses={404: ERROR_RESPONSES[404]},
)
def update_contact(client_id: int, contact_id: int, body: ContactUpdate, ctx: Needs("edit_clients"), db: DbSession):
    return ok(service.update_contact(db, ctx, client_id, contact_id, body), "Contact updated successfully")


@router.delete(
    "/{client_id}/contacts/{contact_id}",
    response_model=Envelope[None],
    summary="Remove a client contact",
    responses={404: ERROR_RESPONSES[404]},
)
def delete_contact(client_id: int, contact_id: int, ctx: Needs("edit_clients"), db: DbSession):
    service.delete_contact(db, ctx, client_id, contact_id)
    return ok(None, "Contact removed successfully")
