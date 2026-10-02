from typing import Annotated

from fastapi import APIRouter, File, Form, Query, UploadFile, status

from app.core.deps import DbSession, Needs
from app.core.enums import Priority, TicketStatus
from app.models.ticket import Ticket
from app.schemas.ticket import (
    AttachmentOut,
    CommentCreate,
    CommentOut,
    TicketAssign,
    TicketCreate,
    TicketDetail,
    TicketOut,
    TicketStatusUpdate,
    TicketUpdate,
)
from app.services import tickets as service
from app.utils.files import file_response
from app.utils.pagination import Pagination, Sorting, apply_sort, paginate
from app.utils.responses import ERROR_RESPONSES, Envelope, Page, ok

router = APIRouter(prefix="/tickets", tags=["Tickets"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})
clients_router = APIRouter(prefix="/clients", tags=["Tickets"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})
extra_routers = [clients_router]

SORT_FIELDS = {
    "id": Ticket.id, "ticket_number": Ticket.ticket_number, "subject": Ticket.subject, "priority": Ticket.priority,
    "status": Ticket.status, "created_at": Ticket.created_at, "updated_at": Ticket.updated_at,
}

NOT_FOUND = {404: ERROR_RESPONSES[404]}


def _page(db, ctx, stmt, sorting, pagination) -> dict:
    page = paginate(db, apply_sort(stmt, sorting, SORT_FIELDS, "created_at"), pagination, lambda ticket: ticket)
    page["data"] = service.to_out_list(db, ctx, page["data"])  # one batched comment-count query for the page
    return page


@router.get(
    "",
    response_model=Page[TicketOut],
    summary="List tickets",
    description="Admins/managers see every ticket of the company, employees the ones assigned to or created by them, client users their "
    "client's tickets. `comment_count` counts public comments only for client users.",
)
def list_tickets(
    ctx: Needs("view_tickets"),
    db: DbSession,
    pagination: Pagination,
    sorting: Sorting,
    search: Annotated[str | None, Query(description="Matches ticket number and subject")] = None,
    status_: Annotated[TicketStatus | None, Query(alias="status")] = None,
    priority: Priority | None = None,
    client_id: int | None = None,
    project_id: int | None = None,
    assigned_to: Annotated[int | None, Query(description="User id of the assignee")] = None,
    category: str | None = None,
    mine: Annotated[bool, Query(description="Only tickets assigned to or created by me")] = False,
):
    stmt = service.list_query(
        ctx, status=status_, priority=priority, client_id=client_id, project_id=project_id,
        assigned_to=assigned_to, category=category, mine=mine, search=search,
    )
    return _page(db, ctx, stmt, sorting, pagination)


@router.post(
    "",
    response_model=Envelope[TicketDetail],
    status_code=status.HTTP_201_CREATED,
    summary="Raise a ticket",
    description="Internal users must supply `client_id`; client users are pinned to their own client (another client_id is a 422). "
    "The ticket number (`TCK-0001`, ...) is allocated per company.",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
def create_ticket(body: TicketCreate, ctx: Needs("create_tickets"), db: DbSession):
    ticket = service.create_ticket(db, ctx, body)
    return ok(service.ticket_detail(db, ctx, ticket), "Ticket created successfully")


@router.get("/{ticket_id}", response_model=Envelope[TicketDetail], summary="Get a ticket with comments and attachments", responses=NOT_FOUND)
def get_ticket(ticket_id: int, ctx: Needs("view_tickets"), db: DbSession):
    return ok(service.ticket_detail(db, ctx, service.get_ticket(db, ctx, ticket_id)))


@router.put(
    "/{ticket_id}",
    response_model=Envelope[TicketDetail],
    summary="Edit a ticket",
    description="Admins/managers, or the creator while the ticket is still `open`. A closed ticket is read-only (409).",
    responses={404: ERROR_RESPONSES[404], 409: {"description": "Ticket is closed"}, 422: ERROR_RESPONSES[422]},
)
def update_ticket(ticket_id: int, body: TicketUpdate, ctx: Needs("view_tickets"), db: DbSession):
    ticket = service.update_ticket(db, ctx, ticket_id, body)
    return ok(service.ticket_detail(db, ctx, ticket), "Ticket updated successfully")


@router.delete(
    "/{ticket_id}",
    response_model=Envelope[None],
    summary="Delete a ticket",
    description="Admins/managers with `manage_tickets` only. Comments and stored attachment files are removed too.",
    responses=NOT_FOUND,
)
def delete_ticket(ticket_id: int, ctx: Needs("manage_tickets"), db: DbSession):
    service.delete_ticket(db, ctx, ticket_id)
    return ok(None, "Ticket deleted successfully")


@router.patch(
    "/{ticket_id}/status",
    response_model=Envelope[TicketDetail],
    summary="Change a ticket's status",
    description="Flow: open <-> in_progress <-> waiting_for_client -> resolved -> closed. Resolving stamps `resolved_at` (cleared on reopen). "
    "A closed ticket can only be reopened (to `open`) by an admin/manager. Employees may move tickets assigned to them among "
    "open/in_progress/waiting_for_client/resolved. Client users may close their own ticket or reopen a resolved one.",
    responses={404: ERROR_RESPONSES[404], 409: {"description": "Transition not allowed"}},
)
def change_status(ticket_id: int, body: TicketStatusUpdate, ctx: Needs("view_tickets"), db: DbSession):
    ticket = service.change_status(db, ctx, ticket_id, body.status)
    return ok(service.ticket_detail(db, ctx, ticket), "Ticket status updated successfully")


@router.patch(
    "/{ticket_id}/assign",
    response_model=Envelope[TicketDetail],
    summary="Assign a ticket to an internal user",
    description="Admins/managers only. The assignee must be an active internal user of the company and is notified. `null` unassigns.",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
def assign_ticket(ticket_id: int, body: TicketAssign, ctx: Needs("manage_tickets"), db: DbSession):
    ticket = service.assign_ticket(db, ctx, ticket_id, body.assigned_to)
    return ok(service.ticket_detail(db, ctx, ticket), "Ticket assigned successfully")


@router.post(
    "/{ticket_id}/comments",
    response_model=Envelope[CommentOut],
    status_code=status.HTTP_201_CREATED,
    summary="Comment on a ticket",
    description="`is_internal=true` (staff-only note) is rejected with 422 for client users. A public comment from the client on a "
    "`waiting_for_client` ticket moves it back to `open`. Closed tickets are read-only (409).",
    responses={404: ERROR_RESPONSES[404], 409: {"description": "Ticket is closed"}, 422: ERROR_RESPONSES[422]},
)
def add_comment(ticket_id: int, body: CommentCreate, ctx: Needs("view_tickets"), db: DbSession):
    return ok(service.comment_out(service.add_comment(db, ctx, ticket_id, body)), "Comment added successfully")


@router.get(
    "/{ticket_id}/comments",
    response_model=Envelope[list[CommentOut]],
    summary="List a ticket's comments",
    description="Client users never receive internal comments.",
    responses=NOT_FOUND,
)
def list_comments(ticket_id: int, ctx: Needs("view_tickets"), db: DbSession):
    return ok(service.list_comments(db, ctx, ticket_id))


@router.post(
    "/{ticket_id}/attachments",
    response_model=Envelope[AttachmentOut],
    status_code=status.HTTP_201_CREATED,
    summary="Attach a file to a ticket (or to one of its comments)",
    description="Multipart: `file` and optional `comment_id`. Visibility follows the comment: files on internal comments are hidden from clients.",
    responses={404: ERROR_RESPONSES[404], 409: {"description": "Ticket is closed"}, 422: ERROR_RESPONSES[422]},
)
async def add_attachment(
    ticket_id: int,
    ctx: Needs("view_tickets"),
    db: DbSession,
    file: Annotated[UploadFile, File(description="The file to attach")],
    comment_id: Annotated[int | None, Form()] = None,
):
    att = await service.add_attachment(db, ctx, ticket_id, file, comment_id)
    return ok(service.attachment_out(att), "Attachment uploaded successfully")


@router.get("/{ticket_id}/attachments", response_model=Envelope[list[AttachmentOut]], summary="List a ticket's attachments", responses=NOT_FOUND)
def list_attachments(ticket_id: int, ctx: Needs("view_tickets"), db: DbSession):
    return ok([service.attachment_out(a) for a in service.list_attachments(db, ctx, ticket_id)])


@router.get(
    "/{ticket_id}/attachments/{attachment_id}/download",
    summary="Download a ticket attachment",
    responses={200: {"content": {"application/octet-stream": {}}, "description": "The file"}, 404: ERROR_RESPONSES[404]},
)
def download_attachment(ticket_id: int, attachment_id: int, ctx: Needs("view_tickets"), db: DbSession):
    att = service.get_attachment(db, ctx, ticket_id, attachment_id)
    return file_response(att.file_path, att.file_name, att.file_type)


@router.delete(
    "/{ticket_id}/attachments/{attachment_id}",
    response_model=Envelope[None],
    summary="Remove a ticket attachment",
    description="Uploader or admin/manager. Closed tickets are read-only (409).",
    responses={404: ERROR_RESPONSES[404], 409: {"description": "Ticket is closed"}},
)
def delete_attachment(ticket_id: int, attachment_id: int, ctx: Needs("view_tickets"), db: DbSession):
    service.delete_attachment(db, ctx, ticket_id, attachment_id)
    return ok(None, "Attachment removed successfully")


@clients_router.get(
    "/{client_id}/tickets",
    response_model=Page[TicketOut],
    summary="List a client's tickets",
    description="Client users may only ask for their own client. Row-level rules of `GET /tickets` still apply.",
    responses=NOT_FOUND,
)
def list_client_tickets(
    client_id: int,
    ctx: Needs("view_tickets"),
    db: DbSession,
    pagination: Pagination,
    sorting: Sorting,
    search: str | None = None,
    status_: Annotated[TicketStatus | None, Query(alias="status")] = None,
    priority: Priority | None = None,
):
    stmt = service.client_tickets_query(db, ctx, client_id, search=search, status=status_, priority=priority)
    return _page(db, ctx, stmt, sorting, pagination)
