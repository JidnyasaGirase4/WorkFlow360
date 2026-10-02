"""Task business rules: visibility, assignment, status flow, checklist, comments and attachments."""
from collections import Counter
from dataclasses import dataclass
from datetime import date

from sqlalchemy import ColumnElement, Select, false, func, or_, select
from sqlalchemy.orm import Session

from app.core.deps import Ctx
from app.core.enums import NotificationType, Priority, TaskStatus
from app.core.exceptions import ForbiddenError, NotFoundError, UnprocessableError
from app.database.base import utcnow
from app.models.employee import Employee
from app.models.milestone import Milestone
from app.models.project import Project, ProjectMember
from app.models.task import Task, TaskAttachment, TaskComment
from app.models.user import User
from app.schemas.task import AssignUpdate, AttachmentOut, CommentCreate, CommentOut, TaskBase, TaskCreate, TaskOut, TaskUpdate
from app.services import milestones as milestone_service
from app.services import projects as project_service
from app.services.access import get_visible_project, visible_project_ids
from app.services.activity import log_activity
from app.services.common import get_referenced
from app.services.notifications import notify
from app.utils.files import StoredFile, delete_stored_file
from app.utils.pagination import like_any


def _now():
    """Whole seconds, so the value in a response equals what the database stores."""
    return utcnow().replace(microsecond=0)


@dataclass
class TaskFilters:
    project_id: int | None = None
    milestone_id: int | None = None
    assigned_to: int | None = None
    status: TaskStatus | None = None
    priority: Priority | None = None
    due_date_from: date | None = None
    due_date_to: date | None = None
    overdue: bool = False
    mine: bool = False
    search: str | None = None


# ---- visibility -----------------------------------------------------------

def task_visibility(ctx: Ctx) -> ColumnElement[bool]:
    """Tasks of visible projects; employees additionally only tasks assigned to or created by them; clients none."""
    if ctx.is_client:
        return false()
    cond = Task.project_id.in_(visible_project_ids(ctx))
    if ctx.is_employee:
        cond = cond & or_(Task.assigned_to == ctx.employee_id, Task.created_by == ctx.user.id)
    return cond


def get_task(db: Session, ctx: Ctx, task_id: int) -> Task:
    if ctx.is_client:
        raise ForbiddenError()
    task = db.scalars(select(Task).where(Task.id == task_id, task_visibility(ctx))).first()
    if task is None:
        raise NotFoundError("Task not found")
    return task


def _require_staff(ctx: Ctx) -> None:
    """Full edit / assign / delete is for admins and managers; employees only update their own work."""
    if ctx.is_employee or ctx.is_client:
        raise ForbiddenError()


def _require_assignee_or_staff(ctx: Ctx, task: Task) -> None:
    if ctx.is_client or (ctx.is_employee and task.assigned_to != ctx.employee_id):
        raise ForbiddenError("Only the assignee can update this task")


def list_query(ctx: Ctx, f: TaskFilters) -> Select:
    stmt = select(Task).where(task_visibility(ctx))
    if f.project_id:
        stmt = stmt.where(Task.project_id == f.project_id)
    if f.milestone_id:
        stmt = stmt.where(Task.milestone_id == f.milestone_id)
    if f.assigned_to:
        stmt = stmt.where(Task.assigned_to == f.assigned_to)
    if f.status:
        stmt = stmt.where(Task.status == f.status)
    if f.priority:
        stmt = stmt.where(Task.priority == f.priority)
    if f.due_date_from:
        stmt = stmt.where(Task.due_date >= f.due_date_from)
    if f.due_date_to:
        stmt = stmt.where(Task.due_date <= f.due_date_to)
    if f.overdue:
        stmt = stmt.where(Task.due_date < date.today(), Task.status != TaskStatus.COMPLETED)
    if f.mine:
        stmt = stmt.where(Task.assigned_to == ctx.employee_id) if ctx.employee_id else stmt.where(false())
    if f.search:
        stmt = stmt.where(like_any(f.search, Task.title))
    return stmt


def project_tasks_query(db: Session, ctx: Ctx, project_id: int, f: TaskFilters) -> Select:
    project = get_visible_project(db, ctx, project_id)
    f.project_id = project.id
    return list_query(ctx, f)


def employee_tasks_query(db: Session, ctx: Ctx, employee_id: int, f: TaskFilters) -> Select:
    employee = project_service.get_target_employee(db, ctx, employee_id)
    f.assigned_to = employee.id
    return list_query(ctx, f)


# ---- serialisation --------------------------------------------------------

def serialize(db: Session, tasks: list[Task]) -> list[TaskOut]:
    ids = [t.id for t in tasks]
    comments = dict(db.execute(select(TaskComment.task_id, func.count()).where(TaskComment.task_id.in_(ids)).group_by(TaskComment.task_id)).all()) if ids else {}
    attachments = dict(db.execute(select(TaskAttachment.task_id, func.count()).where(TaskAttachment.task_id.in_(ids)).group_by(TaskAttachment.task_id)).all()) if ids else {}
    project_names = _names(db, Project, Project.name, {t.project_id for t in tasks})
    milestone_names = _names(db, Milestone, Milestone.name, {t.milestone_id for t in tasks})
    creator_names = _names(db, User, User.name, {t.created_by for t in tasks})
    assignee_ids = {t.assigned_to for t in tasks if t.assigned_to}
    assignees = {e.id: e for e in db.scalars(select(Employee).where(Employee.id.in_(assignee_ids))).unique()} if assignee_ids else {}
    today = date.today()
    result = []
    for t in tasks:
        assignee = assignees.get(t.assigned_to)
        result.append(
            TaskOut(
                **TaskBase.model_validate(t).model_dump(),
                project_name=project_names.get(t.project_id),
                milestone_name=milestone_names.get(t.milestone_id),
                assignee_name=assignee.user.name if assignee else None,
                assignee_user_id=assignee.user_id if assignee else None,
                created_by_name=creator_names.get(t.created_by),
                comment_count=comments.get(t.id, 0),
                attachment_count=attachments.get(t.id, 0),
                is_overdue=bool(t.due_date and t.due_date < today and t.status != TaskStatus.COMPLETED),
            )
        )
    return result


def _names(db: Session, model, column, ids: set) -> dict[int, str]:
    ids = {i for i in ids if i}
    return dict(db.execute(select(model.id, column).where(model.id.in_(ids))).all()) if ids else {}


def serialize_one(db: Session, task: Task) -> TaskOut:
    return serialize(db, [task])[0]


# ---- helpers --------------------------------------------------------------

def _normalise_checklist(items: list[dict] | None) -> list[dict]:
    """Keeps client ids that are unique, assigns `chk-N` to the rest."""
    items = items or []
    provided = Counter(i["id"] for i in items if i.get("id"))
    used = {cid for cid, n in provided.items() if n == 1}
    result, counter, seen = [], 0, set()
    for item in items:
        cid = item.get("id")
        if not cid or cid not in used or cid in seen:
            while True:
                counter += 1
                cid = f"chk-{counter}"
                if cid not in used and cid not in seen:
                    break
        seen.add(cid)
        result.append({"id": cid, "text": item["text"], "done": bool(item.get("done", False))})
    return result


def _milestone_for(db: Session, project: Project, milestone_id: int | None) -> Milestone | None:
    if milestone_id is None:
        return None
    milestone = db.scalars(select(Milestone).where(Milestone.id == milestone_id, Milestone.project_id == project.id)).first()
    if milestone is None:
        raise UnprocessableError("Milestone does not belong to this project", {"milestone_id": "Not a milestone of this project"})
    return milestone


def _assignee_for(db: Session, ctx: Ctx, project: Project, employee_id: int | None) -> Employee | None:
    if employee_id is None:
        return None
    employee = get_referenced(db, ctx, Employee, employee_id, "Employee")
    is_member = db.scalar(select(ProjectMember.id).where(ProjectMember.project_id == project.id, ProjectMember.employee_id == employee.id))
    if not is_member:
        raise UnprocessableError("Assignee must be a member of the project", {"assigned_to": "Not a member of this project"})
    return employee


def _user_id_of_employee(db: Session, employee_id: int | None) -> int | None:
    return db.scalar(select(Employee.user_id).where(Employee.id == employee_id)) if employee_id else None


def _stakeholder_user_ids(db: Session, task: Task, project: Project) -> list[int | None]:
    return [task.created_by, _user_id_of_employee(db, project.manager_id), _user_id_of_employee(db, task.assigned_to)]


def _sync_progress(db: Session, project_id: int, *milestone_ids: int | None) -> None:
    project_service.recompute_progress(db, project_id)
    for milestone_id in {m for m in milestone_ids if m}:
        milestone_service.recompute_progress(db, milestone_id)


def _apply_status(db: Session, ctx: Ctx, task: Task, project: Project, new_status: TaskStatus) -> None:
    if new_status == task.status:
        return
    old = task.status
    task.status = new_status
    task.completed_at = _now() if new_status == TaskStatus.COMPLETED else None
    log_activity(db, ctx, "status_changed", "task", task.id, f"Task '{task.title}' status: {old.value} -> {new_status.value}")
    notify(
        db, _stakeholder_user_ids(db, task, project), "Task status changed",
        f"{ctx.user.name} moved '{task.title}' to {new_status.value.replace('_', ' ')}",
        NotificationType.TASK, "task", task.id, exclude_user_id=ctx.user.id,
    )


def _apply_assignment(db: Session, ctx: Ctx, task: Task, project: Project, assignee: Employee | None) -> None:
    if (assignee.id if assignee else None) == task.assigned_to:
        return
    task.assigned_to = assignee.id if assignee else None
    who = assignee.user.name if assignee else "nobody"
    log_activity(db, ctx, "assigned", "task", task.id, f"Task '{task.title}' assigned to {who}")
    if assignee:
        notify(db, [assignee.user_id], "New task assigned", f"You were assigned '{task.title}' in {project.name}", NotificationType.TASK, "task", task.id, exclude_user_id=ctx.user.id)


# ---- CRUD -----------------------------------------------------------------

def create_task(db: Session, ctx: Ctx, data: TaskCreate) -> Task:
    project = get_visible_project(db, ctx, data.project_id)
    milestone = _milestone_for(db, project, data.milestone_id)
    assignee = _assignee_for(db, ctx, project, data.assigned_to)
    task = Task(
        company_id=project.company_id, project_id=project.id, milestone_id=milestone.id if milestone else None,
        assigned_to=assignee.id if assignee else None, created_by=ctx.user.id, title=data.title, description=data.description,
        priority=data.priority, status=data.status, start_date=data.start_date, due_date=data.due_date,
        completed_at=_now() if data.status == TaskStatus.COMPLETED else None,
        checklist=_normalise_checklist(data.model_dump()["checklist"]),
    )
    db.add(task)
    db.flush()
    _sync_progress(db, project.id, task.milestone_id)
    log_activity(db, ctx, "created", "task", task.id, f"Created task '{task.title}' in {project.name}")
    if assignee:
        notify(db, [assignee.user_id], "New task assigned", f"You were assigned '{task.title}' in {project.name}", NotificationType.TASK, "task", task.id, exclude_user_id=ctx.user.id)
    db.commit()
    return task


def update_task(db: Session, ctx: Ctx, task_id: int, data: TaskUpdate) -> Task:
    _require_staff(ctx)
    task = get_task(db, ctx, task_id)
    project = db.get(Project, task.project_id)
    changes = data.model_dump(exclude_unset=True)
    start = changes.get("start_date", task.start_date)
    due = changes.get("due_date", task.due_date)
    if start and due and due < start:
        raise UnprocessableError("due_date cannot be before start_date", {"due_date": "Must be on or after start_date"})

    old_milestone = task.milestone_id
    if "milestone_id" in changes:
        milestone = _milestone_for(db, project, changes["milestone_id"])
        task.milestone_id = milestone.id if milestone else None
    if "assigned_to" in changes:
        _apply_assignment(db, ctx, task, project, _assignee_for(db, ctx, project, changes["assigned_to"]))
    for field in ("title", "description", "priority", "start_date", "due_date"):
        if field in changes:
            setattr(task, field, changes[field])
    if "checklist" in changes:
        task.checklist = _normalise_checklist(changes["checklist"])
    if "status" in changes:
        _apply_status(db, ctx, task, project, changes["status"])
    _sync_progress(db, project.id, old_milestone, task.milestone_id)
    log_activity(db, ctx, "updated", "task", task.id, f"Updated task '{task.title}'")
    db.commit()
    return task


def change_status(db: Session, ctx: Ctx, task_id: int, status: TaskStatus) -> Task:
    task = get_task(db, ctx, task_id)
    _require_assignee_or_staff(ctx, task)
    project = db.get(Project, task.project_id)
    _apply_status(db, ctx, task, project, status)
    _sync_progress(db, project.id, task.milestone_id)
    db.commit()
    return task


def assign_task(db: Session, ctx: Ctx, task_id: int, data: AssignUpdate) -> Task:
    _require_staff(ctx)
    task = get_task(db, ctx, task_id)
    project = db.get(Project, task.project_id)
    _apply_assignment(db, ctx, task, project, _assignee_for(db, ctx, project, data.assigned_to))
    db.commit()
    return task


def update_checklist(db: Session, ctx: Ctx, task_id: int, items: list[dict]) -> Task:
    task = get_task(db, ctx, task_id)
    _require_assignee_or_staff(ctx, task)
    task.checklist = _normalise_checklist(items)
    log_activity(db, ctx, "updated", "task", task.id, f"Updated checklist of task '{task.title}'")
    db.commit()
    return task


def delete_task(db: Session, ctx: Ctx, task_id: int) -> None:
    _require_staff(ctx)
    task = get_task(db, ctx, task_id)
    project_id, milestone_id, title = task.project_id, task.milestone_id, task.title
    paths = db.scalars(select(TaskAttachment.file_path).where(TaskAttachment.task_id == task.id)).all()
    db.delete(task)  # comments and attachment rows cascade in the database
    _sync_progress(db, project_id, milestone_id)
    log_activity(db, ctx, "deleted", "task", task_id, f"Deleted task '{title}'")
    db.commit()
    for path in paths:
        delete_stored_file(path)


# ---- comments -------------------------------------------------------------

def list_comments(db: Session, ctx: Ctx, task_id: int) -> list[CommentOut]:
    task = get_task(db, ctx, task_id)
    rows = db.execute(
        select(TaskComment, User.name).outerjoin(User, User.id == TaskComment.user_id).where(TaskComment.task_id == task.id).order_by(TaskComment.id)
    ).all()
    return [CommentOut(id=c.id, task_id=c.task_id, user_id=c.user_id, user_name=name, comment=c.comment, created_at=c.created_at) for c, name in rows]


def add_comment(db: Session, ctx: Ctx, task_id: int, data: CommentCreate) -> CommentOut:
    task = get_task(db, ctx, task_id)
    project = db.get(Project, task.project_id)
    comment = TaskComment(task_id=task.id, user_id=ctx.user.id, comment=data.comment)
    db.add(comment)
    db.flush()
    log_activity(db, ctx, "commented", "task", task.id, f"Commented on task '{task.title}'")
    recipients = [task.created_by, _user_id_of_employee(db, task.assigned_to)]
    notify(db, recipients, "New comment on a task", f"{ctx.user.name} commented on '{task.title}' ({project.name})", NotificationType.TASK, "task", task.id, exclude_user_id=ctx.user.id)
    db.commit()
    return CommentOut(id=comment.id, task_id=task.id, user_id=ctx.user.id, user_name=ctx.user.name, comment=comment.comment, created_at=comment.created_at)


# ---- attachments ----------------------------------------------------------

def _attachment_out(db: Session, a: TaskAttachment, names: dict[int, str] | None = None) -> AttachmentOut:
    names = names if names is not None else _names(db, User, User.name, {a.uploaded_by})
    return AttachmentOut(
        id=a.id, task_id=a.task_id, uploaded_by=a.uploaded_by, uploaded_by_name=names.get(a.uploaded_by),
        file_name=a.file_name, file_type=a.file_type, file_size=a.file_size, created_at=a.created_at,
    )


def list_attachments(db: Session, ctx: Ctx, task_id: int) -> list[AttachmentOut]:
    task = get_task(db, ctx, task_id)
    rows = db.scalars(select(TaskAttachment).where(TaskAttachment.task_id == task.id).order_by(TaskAttachment.id)).all()
    names = _names(db, User, User.name, {a.uploaded_by for a in rows})
    return [_attachment_out(db, a, names) for a in rows]


def add_attachment(db: Session, ctx: Ctx, task: Task, stored: StoredFile) -> AttachmentOut:
    attachment = TaskAttachment(task_id=task.id, uploaded_by=ctx.user.id, file_name=stored.original_name, file_path=stored.relative_path, file_type=stored.content_type, file_size=stored.size)
    db.add(attachment)
    db.flush()
    log_activity(db, ctx, "uploaded", "task", task.id, f"Attached {stored.original_name} to task '{task.title}'")
    db.commit()
    return _attachment_out(db, attachment, {ctx.user.id: ctx.user.name})


def get_attachment(db: Session, ctx: Ctx, task_id: int, attachment_id: int) -> TaskAttachment:
    task = get_task(db, ctx, task_id)
    attachment = db.scalars(select(TaskAttachment).where(TaskAttachment.id == attachment_id, TaskAttachment.task_id == task.id)).first()
    if attachment is None:
        raise NotFoundError("Attachment not found")
    return attachment


def delete_attachment(db: Session, ctx: Ctx, task_id: int, attachment_id: int) -> None:
    attachment = get_attachment(db, ctx, task_id, attachment_id)
    if not (ctx.is_admin or ctx.is_manager or attachment.uploaded_by == ctx.user.id):
        raise ForbiddenError("Only the uploader, a manager or an admin can delete this attachment")
    path, name = attachment.file_path, attachment.file_name
    db.delete(attachment)
    log_activity(db, ctx, "deleted", "task", task_id, f"Removed attachment {name}")
    db.commit()
    delete_stored_file(path)
