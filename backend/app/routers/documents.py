from datetime import date
from typing import Annotated

from fastapi import APIRouter, File, Form, Query, UploadFile, status

from app.core.deps import DbSession, Needs
from app.core.enums import DocumentCategory, DocumentVisibility
from app.models.document import Document
from app.schemas.document import DocumentOut, DocumentUpdate
from app.services import documents as service
from app.utils.files import file_response
from app.utils.pagination import Pagination, Sorting, apply_sort, paginate
from app.utils.responses import ERROR_RESPONSES, Envelope, Page, ok

router = APIRouter(prefix="/documents", tags=["Documents"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})
# GET /clients/{id}/documents and GET /projects/{id}/documents live here so the visibility rules stay in one module.
clients_router = APIRouter(prefix="/clients", tags=["Documents"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})
projects_router = APIRouter(prefix="/projects", tags=["Documents"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})
extra_routers = [clients_router, projects_router]

SORT_FIELDS = {
    "id": Document.id, "name": Document.name, "category": Document.category, "file_size": Document.file_size,
    "visibility": Document.visibility, "created_at": Document.created_at,
}


@router.get(
    "",
    response_model=Page[DocumentOut],
    summary="List documents",
    description="Only documents the caller may open are returned (see the access rules on `GET /documents/{id}`).",
)
def list_documents(
    ctx: Needs("view_documents"),
    db: DbSession,
    pagination: Pagination,
    sorting: Sorting,
    search: Annotated[str | None, Query(description="Matches document name and original file name")] = None,
    category: DocumentCategory | None = None,
    client_id: int | None = None,
    project_id: int | None = None,
    employee_id: int | None = None,
    visibility: DocumentVisibility | None = None,
    uploaded_by: Annotated[int | None, Query(description="User id of the uploader")] = None,
    date_from: Annotated[date | None, Query(description="Uploaded on/after this date")] = None,
    date_to: Annotated[date | None, Query(description="Uploaded on/before this date")] = None,
):
    stmt = service.list_query(
        ctx, category=category, client_id=client_id, project_id=project_id, employee_id=employee_id,
        visibility=visibility, uploaded_by=uploaded_by, search=search, date_from=date_from, date_to=date_to,
    )
    return paginate(db, apply_sort(stmt, sorting, SORT_FIELDS, "created_at"), pagination, service.to_out)


@router.post(
    "/upload",
    response_model=Envelope[DocumentOut],
    status_code=status.HTTP_201_CREATED,
    summary="Upload a document",
    description="Multipart form: `file` plus `name`, `category`, `visibility` (default private), `client_id`, `project_id`, `employee_id`. "
    "The file is checked for extension, MIME type, magic bytes and size and stored under a random name. "
    "Category `employee` requires `employee_id` and can only be filed by an admin (or the employee themselves); "
    "visibility `client` requires a client (taken from the project when omitted).",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
async def upload_document(
    ctx: Needs("upload_documents"),
    db: DbSession,
    file: Annotated[UploadFile, File(description="The file to store")],
    name: Annotated[str | None, Form(max_length=255)] = None,
    category: Annotated[DocumentCategory, Form()] = DocumentCategory.OTHER,
    visibility: Annotated[DocumentVisibility, Form()] = DocumentVisibility.PRIVATE,
    client_id: Annotated[int | None, Form()] = None,
    project_id: Annotated[int | None, Form()] = None,
    employee_id: Annotated[int | None, Form()] = None,
):
    doc = await service.upload_document(
        db, ctx, file, name=(name or "").strip() or None, category=category, visibility=visibility,
        client_id=client_id, project_id=project_id, employee_id=employee_id,
    )
    return ok(service.to_out(doc), "Document uploaded successfully")


@router.get(
    "/{document_id}",
    response_model=Envelope[DocumentOut],
    summary="Get a document's details",
    description="Access: employee-category files are visible only to admins and the employee they are about. Otherwise admins see "
    "everything, the uploader sees their own, `company` documents are visible to every internal user, `client` documents also to users "
    "of the document's client, `private` only to uploader/admins. Project-linked documents additionally require access to the project. "
    "Anything else answers 404.",
    responses={404: ERROR_RESPONSES[404]},
)
def get_document(document_id: int, ctx: Needs("view_documents"), db: DbSession):
    return ok(service.to_out(service.get_document(db, ctx, document_id)))


@router.get(
    "/{document_id}/download",
    summary="Download (or preview) a document",
    description="Streams the file after the access check. `?inline=true` serves it for in-browser preview instead of as an attachment.",
    responses={200: {"content": {"application/octet-stream": {}}, "description": "The file"}, 404: ERROR_RESPONSES[404]},
)
def download_document(document_id: int, ctx: Needs("view_documents"), db: DbSession, inline: bool = False):
    doc = service.prepare_download(db, ctx, document_id, inline=inline)
    return file_response(doc.file_path, doc.file_name, doc.file_type, inline=inline)


@router.patch(
    "/{document_id}",
    response_model=Envelope[DocumentOut],
    summary="Rename a document or change its category / visibility",
    description="Uploader or admin only.",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
def update_document(document_id: int, body: DocumentUpdate, ctx: Needs("upload_documents"), db: DbSession):
    return ok(service.to_out(service.update_document(db, ctx, document_id, body)), "Document updated successfully")


@router.delete(
    "/{document_id}",
    response_model=Envelope[None],
    summary="Delete a document and its stored file",
    description="Uploader or admin only.",
    responses={404: ERROR_RESPONSES[404]},
)
def delete_document(document_id: int, ctx: Needs("delete_documents"), db: DbSession):
    service.delete_document(db, ctx, document_id)
    return ok(None, "Document deleted successfully")


@clients_router.get(
    "/{client_id}/documents",
    response_model=Page[DocumentOut],
    summary="List a client's documents",
    description="Client users may only ask for their own client; everyone gets the same visibility filtering as `GET /documents`.",
    responses={404: ERROR_RESPONSES[404]},
)
def list_client_documents(
    client_id: int,
    ctx: Needs("view_documents"),
    db: DbSession,
    pagination: Pagination,
    sorting: Sorting,
    search: str | None = None,
    category: DocumentCategory | None = None,
    visibility: DocumentVisibility | None = None,
):
    stmt = service.client_documents_query(db, ctx, client_id, search=search, category=category, visibility=visibility)
    return paginate(db, apply_sort(stmt, sorting, SORT_FIELDS, "created_at"), pagination, service.to_out)


@projects_router.get(
    "/{project_id}/documents",
    response_model=Page[DocumentOut],
    summary="List a project's documents",
    description="The project must be visible to the caller (404 otherwise); documents are filtered by the same visibility rules.",
    responses={404: ERROR_RESPONSES[404]},
)
def list_project_documents(
    project_id: int,
    ctx: Needs("view_documents"),
    db: DbSession,
    pagination: Pagination,
    sorting: Sorting,
    search: str | None = None,
    category: DocumentCategory | None = None,
    visibility: DocumentVisibility | None = None,
):
    stmt = service.project_documents_query(db, ctx, project_id, search=search, category=category, visibility=visibility)
    return paginate(db, apply_sort(stmt, sorting, SORT_FIELDS, "created_at"), pagination, service.to_out)
