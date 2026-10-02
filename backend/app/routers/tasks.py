from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, UploadFile, status

from app.core.deps import DbSession, Needs
from app.core.enums import Priority, TaskStatus
from app.models.task import Task
from app.schemas.task import (
    AssignUpdate,
    AttachmentOut,
    ChecklistUpdate,
    CommentCreate,
    CommentOut,
    StatusUpdate,
    TaskCreate,
    TaskOut,
    TaskUpdate,
)
from app.services import tasks as service
from app.utils.files import delete_stored_file, file_response, save_upload
from app.utils.pagination import Pagination, Sorting, apply_sort, paginate
from app.utils.responses import ERROR_RESPONSES, Envelope, Page, ok

router = APIRouter(prefix="/tasks", tags=["Tasks"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})

SORT_FIELDS = {
    "id": Task.id,
    "title": Task.title,
    "priority": Task.priority,
    "status": Task.status,
    "due_date": Task.due_date,
    "start_date": Task.start_date,
    "created_at": Task.created_at,
    "updated_at": Task.updated_at,
}


def task_filters(
    project_id: int | None = None,
    milestone_id: int | None = None,
    assigned_to: int | None = None,
    status_: Annotated[TaskStatus | None, Query(alias="status")] = None,
    priority: Priority | None = None,
    due_date_from: date | None = None,
    due_date_to: date | None = None,
    overdue: Annotated[bool, Query(description="Due date passed and not completed")] = False,
    mine: Annotated[bool, Query(description="Only tasks assigned to me")] = False,
    search: Annotated[str | None, Query(description="Matches the task title")] = None,
) -> service.TaskFilters:
    return service.TaskFilters(project_id, milestone_id, assigned_to, status_, priority, due_date_from, due_date_to, overdue, mine, search)


TaskFilterParams = Annotated[service.TaskFilters, Depends(task_filters)]


def task_page(db, stmt, pagination, sorting) -> dict:
    """Shared by every endpoint that lists tasks (also used by /projects/{id}/tasks and /employees/{id}/tasks)."""
    stmt = apply_sort(stmt, sorting, SORT_FIELDS, "created_at")
    page = paginate(db, stmt, pagination, lambda task: task)
    page["data"] = service.serialize(db, page["data"])
    return page


@router.get(
    "",
    response_model=Page[TaskOut],
    summary="List tasks",
    description="Only tasks the caller may see: admins all, managers those of their projects, employees those assigned to or created by them. Clients have no task access.",
)
def list_tasks(ctx: Needs("view_tasks"), db: DbSession, pagination: Pagination, sorting: Sorting, filters: TaskFilterParams):
    return task_page(db, service.list_query(ctx, filters), pagination, sorting)


@router.post(
    "",
    response_model=Envelope[TaskOut],
    status_code=status.HTTP_201_CREATED,
    summary="Create a task",
    description="The project must be visible to the caller, the milestone must belong to it and the assignee must be a project member (422 otherwise). The assignee is notified.",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
def create_task(body: TaskCreate, ctx: Needs("create_tasks"), db: DbSession):
    return ok(service.serialize_one(db, service.create_task(db, ctx, body)), "Task created successfully")


@router.get("/{task_id}", response_model=Envelope[TaskOut], summary="Get a task", responses={404: ERROR_RESPONSES[404]})
def get_task(task_id: int, ctx: Needs("view_tasks"), db: DbSession):
    return ok(service.serialize_one(db, service.get_task(db, ctx, task_id)))


@router.put(
    "/{task_id}",
    response_model=Envelope[TaskOut],
    summary="Update a task (admin / manager)",
    description="Employees cannot use this endpoint (403); they use PATCH status / checklist.",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
def update_task(task_id: int, body: TaskUpdate, ctx: Needs("edit_tasks"), db: DbSession):
    return ok(service.serialize_one(db, service.update_task(db, ctx, task_id, body)), "Task updated successfully")


@router.delete(
    "/{task_id}",
    response_model=Envelope[None],
    summary="Delete a task (admin / manager)",
    description="Recomputes project and milestone progress and removes the task's attachment files.",
    responses={404: ERROR_RESPONSES[404]},
)
def delete_task(task_id: int, ctx: Needs("delete_tasks"), db: DbSession):
    service.delete_task(db, ctx, task_id)
    return ok(None, "Task deleted successfully")


@router.patch(
    "/{task_id}/status",
    response_model=Envelope[TaskOut],
    summary="Change a task's status",
    description="Managers/admins for any visible task; employees only for tasks assigned to them. Sets/clears `completed_at`, "
    "recomputes project and milestone progress and notifies the creator and project manager.",
    responses={404: ERROR_RESPONSES[404]},
)
def change_status(task_id: int, body: StatusUpdate, ctx: Needs("edit_tasks"), db: DbSession):
    return ok(service.serialize_one(db, service.change_status(db, ctx, task_id, body.status)), "Task status updated successfully")


@router.patch(
    "/{task_id}/assign",
    response_model=Envelope[TaskOut],
    summary="Assign or unassign a task (admin / manager)",
    description="`assigned_to` must be a member of the task's project, or null to unassign.",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
def assign_task(task_id: int, body: AssignUpdate, ctx: Needs("edit_tasks"), db: DbSession):
    return ok(service.serialize_one(db, service.assign_task(db, ctx, task_id, body)), "Task assignment updated successfully")


@router.patch(
    "/{task_id}/checklist",
    response_model=Envelope[TaskOut],
    summary="Replace a task's checklist",
    description="Allowed for the assignee and for admins/managers. Send the whole list; items without a (unique) id get one assigned.",
    responses={404: ERROR_RESPONSES[404]},
)
def update_checklist(task_id: int, body: ChecklistUpdate, ctx: Needs("edit_tasks"), db: DbSession):
    task = service.update_checklist(db, ctx, task_id, body.model_dump()["checklist"])
    return ok(service.serialize_one(db, task), "Checklist updated successfully")


@router.get("/{task_id}/comments", response_model=Envelope[list[CommentOut]], summary="List a task's comments", responses={404: ERROR_RESPONSES[404]})
def list_comments(task_id: int, ctx: Needs("view_tasks"), db: DbSession):
    return ok(service.list_comments(db, ctx, task_id))


@router.post(
    "/{task_id}/comments",
    response_model=Envelope[CommentOut],
    status_code=status.HTTP_201_CREATED,
    summary="Comment on a task",
    responses={404: ERROR_RESPONSES[404]},
)
def add_comment(task_id: int, body: CommentCreate, ctx: Needs("edit_tasks"), db: DbSession):
    return ok(service.add_comment(db, ctx, task_id, body), "Comment added successfully")


@router.get("/{task_id}/attachments", response_model=Envelope[list[AttachmentOut]], summary="List a task's attachments", responses={404: ERROR_RESPONSES[404]})
def list_attachments(task_id: int, ctx: Needs("view_tasks"), db: DbSession):
    return ok(service.list_attachments(db, ctx, task_id))


@router.post(
    "/{task_id}/attachments",
    response_model=Envelope[AttachmentOut],
    status_code=status.HTTP_201_CREATED,
    summary="Attach a file to a task",
    description="Multipart upload (`file`). Extension, MIME type, content signature and size are validated (422 otherwise).",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
async def upload_attachment(task_id: int, ctx: Needs("edit_tasks"), db: DbSession, file: Annotated[UploadFile, File(description="The file to attach")]):
    task = service.get_task(db, ctx, task_id)  # authorise before touching the disk
    stored = await save_upload(file, f"{task.company_id}/tasks")
    try:
        attachment = service.add_attachment(db, ctx, task, stored)
    except Exception:
        delete_stored_file(stored.relative_path)
        raise
    return ok(attachment, "File attached successfully")


@router.get(
    "/{task_id}/attachments/{attachment_id}/download",
    summary="Download a task attachment",
    description="Streams the file after checking the caller may see the task.",
    responses={404: ERROR_RESPONSES[404]},
)
def download_attachment(task_id: int, attachment_id: int, ctx: Needs("view_tasks"), db: DbSession):
    attachment = service.get_attachment(db, ctx, task_id, attachment_id)
    return file_response(attachment.file_path, attachment.file_name, attachment.file_type)


@router.delete(
    "/{task_id}/attachments/{attachment_id}",
    response_model=Envelope[None],
    summary="Delete a task attachment",
    description="Allowed for the uploader, managers and admins. The stored file is removed too.",
    responses={404: ERROR_RESPONSES[404]},
)
def delete_attachment(task_id: int, attachment_id: int, ctx: Needs("edit_tasks"), db: DbSession):
    service.delete_attachment(db, ctx, task_id, attachment_id)
    return ok(None, "Attachment deleted successfully")
