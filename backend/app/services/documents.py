"""Document business rules. `can_access_document` and `document_visibility_filter` encode the SAME rules
(one for a loaded row, one as SQL for lists); tests assert they agree — change both together."""
from datetime import date, datetime, time

from fastapi import UploadFile
from sqlalchemy import ColumnElement, Select, and_, false, or_, select, true
from sqlalchemy.orm import Session

from app.core.deps import Ctx
from app.core.enums import DocumentCategory, DocumentVisibility
from app.core.exceptions import ForbiddenError, NotFoundError, UnprocessableError
from app.models.client import Client
from app.models.document import Document
from app.models.employee import Employee
from app.models.project import Project
from app.schemas.document import DocumentOut, DocumentUpdate
from app.services.access import get_visible_project, project_visibility, visible_project_ids
from app.services.activity import log_activity
from app.services.common import get_referenced, get_scoped_or_404
from app.utils.files import delete_stored_file, resolve_stored_path, save_upload
from app.utils.pagination import like_any


# ---- access rules ------------------------------------------------------------

def can_access_document(ctx: Ctx, doc: Document) -> bool:
    if ctx.company_id is not None and doc.company_id != ctx.company_id:
        return False
    if doc.category == DocumentCategory.EMPLOYEE:  # personal HR files: admins and the subject only
        return ctx.is_admin or (ctx.employee_id is not None and doc.employee_id == ctx.employee_id)
    if ctx.is_admin:
        return True
    if ctx.is_client:
        return ctx.client_id is not None and doc.visibility == DocumentVisibility.CLIENT and doc.client_id == ctx.client_id
    if doc.uploaded_by == ctx.user.id:
        return True
    if doc.visibility == DocumentVisibility.PRIVATE:
        return False
    if doc.project_id is None:
        return True
    return ctx.db.scalar(select(Project.id).where(Project.id == doc.project_id, project_visibility(ctx))) is not None


def document_visibility_filter(ctx: Ctx) -> ColumnElement[bool]:
    company = Document.company_id == ctx.company_id if ctx.company_id is not None else true()
    is_employee_doc = Document.category == DocumentCategory.EMPLOYEE
    if ctx.is_admin:
        return company
    if ctx.is_client:
        if ctx.client_id is None:
            return false()
        return and_(company, ~is_employee_doc, Document.visibility == DocumentVisibility.CLIENT, Document.client_id == ctx.client_id)
    about_me = and_(is_employee_doc, Document.employee_id == ctx.employee_id) if ctx.employee_id is not None else false()
    project_ok = or_(Document.project_id.is_(None), Document.project_id.in_(visible_project_ids(ctx)))
    shared = and_(Document.visibility.in_([DocumentVisibility.COMPANY, DocumentVisibility.CLIENT]), project_ok)
    return and_(company, or_(about_me, and_(~is_employee_doc, or_(Document.uploaded_by == ctx.user.id, shared))))


def get_document(db: Session, ctx: Ctx, document_id: int) -> Document:
    """Load a document the caller may open; anything else answers 404 so existence is never confirmed."""
    doc = db.scalars(select(Document).where(Document.id == document_id, document_visibility_filter(ctx))).first()
    if doc is None:
        raise NotFoundError("Document not found")
    return doc


# ---- output ------------------------------------------------------------------

def to_out(doc: Document) -> DocumentOut:
    out = DocumentOut.model_validate(doc)
    out.uploaded_by_name = doc.uploader.name if doc.uploader else None
    out.client_name = doc.client.company_name if doc.client else None
    out.project_name = doc.project.name if doc.project else None
    return out


# ---- queries -----------------------------------------------------------------

def list_query(
    ctx: Ctx,
    *,
    category: DocumentCategory | None = None,
    client_id: int | None = None,
    project_id: int | None = None,
    employee_id: int | None = None,
    visibility: DocumentVisibility | None = None,
    uploaded_by: int | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> Select:
    stmt = select(Document).where(document_visibility_filter(ctx))
    for column, value in (
        (Document.category, category), (Document.client_id, client_id), (Document.project_id, project_id),
        (Document.employee_id, employee_id), (Document.visibility, visibility), (Document.uploaded_by, uploaded_by),
    ):
        if value is not None:
            stmt = stmt.where(column == value)
    if search:
        stmt = stmt.where(like_any(search, Document.name, Document.file_name))
    if date_from:
        stmt = stmt.where(Document.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        stmt = stmt.where(Document.created_at <= datetime.combine(date_to, time.max))
    return stmt


def client_documents_query(db: Session, ctx: Ctx, client_id: int, **filters) -> Select:
    if ctx.is_client and client_id != ctx.client_id:
        raise NotFoundError("Client not found")
    client = get_scoped_or_404(db, ctx, Client, client_id, "Client")
    return list_query(ctx, client_id=client.id, **filters)


def project_documents_query(db: Session, ctx: Ctx, project_id: int, **filters) -> Select:
    project = get_visible_project(db, ctx, project_id)
    return list_query(ctx, project_id=project.id, **filters)


# ---- writes ------------------------------------------------------------------

def _check_state(ctx: Ctx, *, category: DocumentCategory, employee_id: int | None, visibility: DocumentVisibility, client_id: int | None) -> None:
    if category == DocumentCategory.EMPLOYEE:
        if employee_id is None:
            raise UnprocessableError("Employee documents must reference an employee", {"employee_id": "Required for category 'employee'"})
        if not (ctx.is_admin or employee_id == ctx.employee_id):
            raise ForbiddenError("Only admins (or the employee themselves) can file employee documents")
    if visibility == DocumentVisibility.CLIENT and client_id is None:
        raise UnprocessableError("Client-visible documents must be linked to a client", {"client_id": "Required for visibility 'client'"})


async def upload_document(
    db: Session,
    ctx: Ctx,
    file: UploadFile,
    *,
    name: str | None,
    category: DocumentCategory,
    visibility: DocumentVisibility,
    client_id: int | None,
    project_id: int | None,
    employee_id: int | None,
) -> Document:
    company_id = ctx.require_company()
    # every foreign id is validated BEFORE any bytes are written
    client = get_referenced(db, ctx, Client, client_id, "Client")
    project = get_visible_project(db, ctx, project_id) if project_id is not None else None
    if project and client and project.client_id != client.id:
        raise UnprocessableError("Project does not belong to the selected client", {"project_id": "Belongs to a different client"})
    if project and not client:
        client_id = project.client_id
    employee = get_referenced(db, ctx, Employee, employee_id, "Employee")
    _check_state(ctx, category=category, employee_id=employee.id if employee else None, visibility=visibility, client_id=client_id)

    stored = await save_upload(file, f"{company_id}/documents")
    try:
        doc = Document(
            company_id=company_id, name=(name or stored.original_name)[:255], file_name=stored.original_name,
            file_path=stored.relative_path, file_type=stored.content_type, file_size=stored.size,
            category=category, visibility=visibility, client_id=client_id, project_id=project.id if project else None,
            employee_id=employee.id if employee else None, uploaded_by=ctx.user.id,
        )
        db.add(doc)
        db.flush()
        log_activity(db, ctx, "uploaded", "document", doc.id, f"Uploaded document {doc.name}")
        db.commit()
    except Exception:
        db.rollback()
        delete_stored_file(stored.relative_path)
        raise
    return doc


def _assert_owner_or_admin(ctx: Ctx, doc: Document) -> None:
    if not (ctx.is_admin or doc.uploaded_by == ctx.user.id):
        raise ForbiddenError("Only the uploader or an admin can change this document")


def update_document(db: Session, ctx: Ctx, document_id: int, data: DocumentUpdate) -> Document:
    doc = get_document(db, ctx, document_id)
    _assert_owner_or_admin(ctx, doc)
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    _check_state(
        ctx, category=changes.get("category", doc.category), employee_id=doc.employee_id,
        visibility=changes.get("visibility", doc.visibility), client_id=doc.client_id,
    )
    for field, value in changes.items():
        setattr(doc, field, value)
    log_activity(db, ctx, "updated", "document", doc.id, f"Updated document {doc.name}")
    db.commit()
    return doc


def delete_document(db: Session, ctx: Ctx, document_id: int) -> None:
    doc = get_document(db, ctx, document_id)
    _assert_owner_or_admin(ctx, doc)
    path, name = doc.file_path, doc.name
    db.delete(doc)
    log_activity(db, ctx, "deleted", "document", document_id, f"Deleted document {name}")
    db.commit()
    delete_stored_file(path)  # after commit: a failed commit must not leave a row pointing at a missing file


def prepare_download(db: Session, ctx: Ctx, document_id: int, *, inline: bool) -> Document:
    """Authorise + audit. The caller then streams the file with `file_response`."""
    doc = get_document(db, ctx, document_id)
    resolve_stored_path(doc.file_path)  # 404 before auditing a download that cannot happen
    log_activity(db, ctx, "downloaded", "document", doc.id, f"{'Previewed' if inline else 'Downloaded'} document {doc.name}")
    db.commit()
    return doc
