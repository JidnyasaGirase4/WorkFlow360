from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.deps import DbSession, Needs
from app.core.enums import LeadSource, LeadStatus, Priority
from app.models.lead import Lead
from app.schemas.client import ClientOut
from app.schemas.lead import (
    LeadActivityCreate,
    LeadActivityOut,
    LeadConvert,
    LeadConvertResult,
    LeadCreate,
    LeadOut,
    LeadUpdate,
    Pipeline,
)
from app.services import leads as service
from app.utils.pagination import Pagination, Sorting, apply_sort
from app.utils.responses import ERROR_RESPONSES, Envelope, Page, ok

router = APIRouter(prefix="/leads", tags=["Leads"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})

SORT_FIELDS = {
    "id": Lead.id,
    "company_name": Lead.company_name,
    "contact_name": Lead.contact_name,
    "status": Lead.status,
    "priority": Lead.priority,
    "estimated_value": Lead.estimated_value,
    "created_at": Lead.created_at,
    "next_followup_date": Lead.next_followup_date,
    "last_contact_date": Lead.last_contact_date,
}


def _one(db, lead: Lead) -> LeadOut:
    return service.serialize_leads(db, [lead])[0]


@router.get(
    "",
    response_model=Page[LeadOut],
    summary="List leads",
    description="Paginated list of the company's leads. `date_from`/`date_to` filter on the creation date (inclusive).",
    responses={422: ERROR_RESPONSES[422]},
)
def list_leads(
    ctx: Needs("view_leads"),
    db: DbSession,
    pagination: Pagination,
    sorting: Sorting,
    search: Annotated[str | None, Query(description="Matches company name, contact name, email")] = None,
    status_: Annotated[LeadStatus | None, Query(alias="status")] = None,
    source: LeadSource | None = None,
    owner_id: int | None = None,
    priority: Priority | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    stmt = service.list_query(
        ctx, search=search, status=status_, source=source, owner_id=owner_id, priority=priority, date_from=date_from, date_to=date_to
    )
    stmt = apply_sort(stmt, sorting, SORT_FIELDS, "created_at")
    return service.paginate_leads(db, stmt, pagination)


@router.get(
    "/pipeline",
    response_model=Envelope[Pipeline],
    summary="Pipeline summary for the Kanban header",
    description="Lead count and total estimated value for every status (statuses with no leads are included with zeros).",
)
def pipeline(ctx: Needs("view_leads"), db: DbSession):
    return ok(service.pipeline(db, ctx))


@router.post(
    "",
    response_model=Envelope[LeadOut],
    status_code=status.HTTP_201_CREATED,
    summary="Create a lead",
    description="`owner_id` defaults to the caller and must be an internal user of the company.",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
def create_lead(body: LeadCreate, ctx: Needs("create_leads"), db: DbSession):
    return ok(_one(db, service.create_lead(db, ctx, body)), "Lead created successfully")


@router.get("/{lead_id}", response_model=Envelope[LeadOut], summary="Get a lead", responses={404: ERROR_RESPONSES[404]})
def get_lead(lead_id: int, ctx: Needs("view_leads"), db: DbSession):
    return ok(_one(db, service.get_lead(db, ctx, lead_id)))


@router.put(
    "/{lead_id}",
    response_model=Envelope[LeadOut],
    summary="Update a lead",
    description="Partial update. A converted lead's status is locked (409).",
    responses={404: ERROR_RESPONSES[404], 409: ERROR_RESPONSES[422] | {"description": "Lead already converted"}, 422: ERROR_RESPONSES[422]},
)
def update_lead(lead_id: int, body: LeadUpdate, ctx: Needs("edit_leads"), db: DbSession):
    return ok(_one(db, service.update_lead(db, ctx, lead_id, body)), "Lead updated successfully")


@router.delete(
    "/{lead_id}",
    response_model=Envelope[None],
    summary="Delete a lead",
    description="A converted lead cannot be deleted (409) so the conversion history is kept.",
    responses={404: ERROR_RESPONSES[404], 409: ERROR_RESPONSES[422] | {"description": "Lead already converted"}},
)
def delete_lead(lead_id: int, ctx: Needs("delete_leads"), db: DbSession):
    service.delete_lead(db, ctx, lead_id)
    return ok(None, "Lead deleted successfully")


@router.post(
    "/{lead_id}/activities",
    response_model=Envelope[LeadActivityOut],
    status_code=status.HTTP_201_CREATED,
    summary="Log an activity on a lead",
    description="call / email / meeting activities also update the lead's `last_contact_date`. "
    "A `follow_up` activity may carry `next_followup_date`.",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
def add_activity(lead_id: int, body: LeadActivityCreate, ctx: Needs("edit_leads"), db: DbSession):
    return ok(service.add_activity(db, ctx, lead_id, body), "Activity recorded successfully")


@router.get(
    "/{lead_id}/activities",
    response_model=Page[LeadActivityOut],
    summary="List a lead's activities (newest first)",
    responses={404: ERROR_RESPONSES[404]},
)
def list_activities(lead_id: int, ctx: Needs("view_leads"), db: DbSession, pagination: Pagination):
    return service.paginate_activities(db, service.activities_query(db, ctx, lead_id), pagination)


@router.post(
    "/{lead_id}/convert",
    response_model=Envelope[LeadConvertResult],
    summary="Convert a lead into a client",
    description="Atomically creates the client and its primary contact, marks the lead `won` and links it. "
    "409 if the lead is already converted, or if a client with the same name/email exists "
    "(`errors.existing_client_id`; repeat with `existing_client_id` to link instead). 422 if the lead is lost. "
    "Needs `edit_leads` and, unless linking, `create_clients`.",
    responses={404: ERROR_RESPONSES[404], 409: ERROR_RESPONSES[422] | {"description": "Already converted / duplicate client"}, 422: ERROR_RESPONSES[422]},
)
def convert_lead(lead_id: int, ctx: Needs("edit_leads"), db: DbSession, body: LeadConvert | None = None):
    lead, client = service.convert_lead(db, ctx, lead_id, body or LeadConvert())
    result = {"lead": _one(db, lead), "client": ClientOut.model_validate(client)}
    return ok(result, "Lead converted successfully")
