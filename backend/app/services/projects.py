"""Project business rules: CRUD, members, derived progress, activity feed, per-client / per-employee views."""
from collections import defaultdict
from decimal import Decimal

from sqlalchemy import Select, and_, case, exists, func, or_, select
from sqlalchemy.orm import Session

from app.core.deps import Ctx
from app.core.enums import NotificationType, TaskStatus
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, UnprocessableError
from app.models.activity import ActivityLog
from app.models.client import Client
from app.models.document import Document
from app.models.employee import Employee
from app.models.expense import Expense
from app.models.invoice import Invoice, Quotation
from app.models.milestone import Milestone
from app.models.project import Project, ProjectMember
from app.models.task import Task, TaskAttachment
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.project import ActivityOut, MemberCreate, MemberOut, ProjectBase, ProjectCreate, ProjectOut, ProjectUpdate
from app.services.access import get_visible_project, project_visibility
from app.services.activity import log_activity
from app.services.common import get_referenced, get_scoped_or_404
from app.services.notifications import notify
from app.utils.files import delete_stored_file
from app.utils.pagination import like_any

MANAGER_ROLE = "Project Manager"


# ---- queries --------------------------------------------------------------

def list_query(ctx: Ctx, *, search: str | None, status, client_id: int | None, manager_id: int | None) -> Select:
    stmt = select(Project).where(project_visibility(ctx))
    if search:
        stmt = stmt.where(like_any(search, Project.name, Project.project_code, Project.description))
    if status:
        stmt = stmt.where(Project.status == status)
    if client_id:
        stmt = stmt.where(Project.client_id == client_id)
    if manager_id:
        stmt = stmt.where(Project.manager_id == manager_id)
    return stmt


def client_projects_query(db: Session, ctx: Ctx, client_id: int) -> Select:
    if ctx.is_client and client_id != ctx.client_id:
        raise NotFoundError("Client not found")  # same answer as a missing row
    client = get_scoped_or_404(db, ctx, Client, client_id, "Client")
    return select(Project).where(project_visibility(ctx), Project.client_id == client.id)


def get_target_employee(db: Session, ctx: Ctx, employee_id: int) -> Employee:
    """Who may look at another person's projects/tasks: admin/manager anyone; an employee only themself; never a client."""
    if ctx.is_client or (ctx.is_employee and employee_id != ctx.employee_id):
        raise ForbiddenError()
    return get_scoped_or_404(db, ctx, Employee, employee_id, "Employee")


def employee_projects_query(db: Session, ctx: Ctx, employee_id: int) -> Select:
    employee = get_target_employee(db, ctx, employee_id)
    member = exists().where(ProjectMember.project_id == Project.id, ProjectMember.employee_id == employee.id)
    return select(Project).where(project_visibility(ctx), or_(Project.manager_id == employee.id, member))


# ---- serialisation --------------------------------------------------------

def _member_out(member: ProjectMember, employee: Employee) -> MemberOut:
    return MemberOut(employee_id=employee.id, user_id=employee.user_id, name=employee.user.name, designation=employee.designation, role=member.role)


def serialize(db: Session, ctx: Ctx, projects: list[Project]) -> list[ProjectOut]:
    """Adds names, members, task counts and spend using one query per aspect (not per row)."""
    ids = [p.id for p in projects]
    members: dict[int, list[MemberOut]] = defaultdict(list)
    counts: dict[int, tuple[int, int]] = {}
    spent: dict[int, Decimal] = {}
    client_names: dict[int, str] = {}
    manager_names: dict[int, str] = {}
    if ids:
        for member, employee in db.execute(
            select(ProjectMember, Employee).join(Employee, Employee.id == ProjectMember.employee_id).where(ProjectMember.project_id.in_(ids)).order_by(ProjectMember.id)
        ).all():
            members[member.project_id].append(_member_out(member, employee))
        counts = {
            pid: (int(total), int(done))
            for pid, total, done in db.execute(
                select(Task.project_id, func.count(), func.coalesce(func.sum(case((Task.status == TaskStatus.COMPLETED, 1), else_=0)), 0))
                .where(Task.project_id.in_(ids))
                .group_by(Task.project_id)
            ).all()
        }
        spent = {pid: Decimal(total) for pid, total in db.execute(select(Expense.project_id, func.sum(Expense.amount)).where(Expense.project_id.in_(ids)).group_by(Expense.project_id)).all()}
        client_ids = {p.client_id for p in projects if p.client_id}
        if client_ids:
            client_names = dict(db.execute(select(Client.id, Client.company_name).where(Client.id.in_(client_ids))).all())
        manager_ids = {p.manager_id for p in projects if p.manager_id}
        if manager_ids:
            manager_names = {e.id: e.user.name for e in db.scalars(select(Employee).where(Employee.id.in_(manager_ids))).unique()}
    hide_money = ctx.is_client
    result = []
    for p in projects:
        total, done = counts.get(p.id, (0, 0))
        result.append(
            ProjectOut(
                **ProjectBase.model_validate(p).model_dump(),
                budget=None if hide_money else p.budget,
                spent=None if hide_money else spent.get(p.id, Decimal("0.00")),
                client_name=client_names.get(p.client_id),
                manager_name=manager_names.get(p.manager_id),
                members=members.get(p.id, []),
                task_count=total,
                completed_task_count=done,
            )
        )
    return result


def serialize_one(db: Session, ctx: Ctx, project: Project) -> ProjectOut:
    return serialize(db, ctx, [project])[0]


# ---- derived progress -----------------------------------------------------

def recompute_progress(db: Session, project_id: int) -> None:
    """With >=1 task, progress = round(completed / total * 100). Caller commits."""
    db.flush()
    total, done = db.execute(
        select(func.count(), func.coalesce(func.sum(case((Task.status == TaskStatus.COMPLETED, 1), else_=0)), 0)).where(Task.project_id == project_id)
    ).one()
    project = db.get(Project, project_id)
    if project is not None and total:
        project.progress = (int(done) * 200 + int(total)) // (2 * int(total))  # round half up


def _has_tasks(db: Session, project_id: int) -> bool:
    return bool(db.scalar(select(func.count()).select_from(Task).where(Task.project_id == project_id)))


# ---- CRUD -----------------------------------------------------------------

def _next_code(db: Session, company_id: int) -> str:
    codes = db.scalars(select(Project.project_code).where(Project.company_id == company_id, Project.project_code.like("PRJ-%"))).all()
    numbers = [int(c[4:]) for c in codes if c[4:].isdigit()]
    return f"PRJ-{max(numbers, default=0) + 1:03d}"


def _assert_code_free(db: Session, company_id: int, code: str, exclude_id: int | None = None) -> None:
    stmt = select(Project.id).where(Project.company_id == company_id, Project.project_code == code)
    if exclude_id:
        stmt = stmt.where(Project.id != exclude_id)
    if db.scalar(stmt):
        raise ConflictError("A project with this code already exists", {"project_code": "Already exists"})


def _ensure_member(project: Project, employee_id: int, role: str | None = None) -> None:
    if not any(m.employee_id == employee_id for m in project.members):
        project.members.append(ProjectMember(employee_id=employee_id, role=role))


def _notify_manager(db: Session, ctx: Ctx, project: Project, manager: Employee | None) -> None:
    if manager is not None:
        notify(db, [manager.user_id], "Project assigned", f"You are now the manager of {project.name}", NotificationType.PROJECT, "project", project.id, exclude_user_id=ctx.user.id)


def create_project(db: Session, ctx: Ctx, data: ProjectCreate) -> Project:
    company_id = ctx.require_company()
    get_referenced(db, ctx, Client, data.client_id, "Client")
    manager_id = data.manager_id if data.manager_id is not None else (ctx.employee_id if ctx.is_manager else None)
    manager = get_referenced(db, ctx, Employee, manager_id, "Manager")
    extra_members = [get_referenced(db, ctx, Employee, eid, "Employee") for eid in dict.fromkeys(data.member_ids)]

    code = data.project_code or _next_code(db, company_id)
    _assert_code_free(db, company_id, code)
    values = data.model_dump(exclude={"member_ids", "project_code", "manager_id"})
    project = Project(company_id=company_id, project_code=code, manager_id=manager_id, created_by=ctx.user.id, **values)
    if manager:
        _ensure_member(project, manager.id, MANAGER_ROLE)
    for employee in extra_members:
        _ensure_member(project, employee.id)
    db.add(project)
    db.flush()
    log_activity(db, ctx, "created", "project", project.id, f"Created project {project.name} ({project.project_code})")
    _notify_manager(db, ctx, project, manager)
    db.commit()
    return project


def update_project(db: Session, ctx: Ctx, project_id: int, data: ProjectUpdate) -> Project:
    project = get_visible_project(db, ctx, project_id)
    changes = data.model_dump(exclude_unset=True)
    if changes.get("client_id") is not None:
        get_referenced(db, ctx, Client, changes["client_id"], "Client")
    manager = None
    manager_changed = "manager_id" in changes and changes["manager_id"] != project.manager_id
    if manager_changed:
        manager = get_referenced(db, ctx, Employee, changes["manager_id"], "Manager")
    if "project_code" in changes:
        _assert_code_free(db, project.company_id, changes["project_code"], exclude_id=project.id)
    if "progress" in changes and _has_tasks(db, project.id):
        changes.pop("progress")  # derived from tasks; a manual value would be overwritten anyway
    start = changes.get("start_date", project.start_date)
    end = changes.get("end_date", project.end_date)
    if start and end and end < start:
        raise UnprocessableError("end_date cannot be before start_date", {"end_date": "Must be on or after start_date"})

    old_status = project.status
    for field, value in changes.items():
        setattr(project, field, value)
    if manager:
        _ensure_member(project, manager.id, MANAGER_ROLE)
        _notify_manager(db, ctx, project, manager)
    log_activity(db, ctx, "updated", "project", project.id, f"Updated project {project.name}")
    if project.status != old_status:
        log_activity(db, ctx, "status_changed", "project", project.id, f"Project {project.name} status: {old_status.value} -> {project.status.value}")
    db.commit()
    return project


def delete_project(db: Session, ctx: Ctx, project_id: int) -> None:
    project = get_visible_project(db, ctx, project_id)
    for model, label in ((Invoice, "invoices"), (Quotation, "quotations"), (Ticket, "tickets"), (Expense, "expenses"), (Document, "documents")):
        if db.scalar(select(func.count()).select_from(model).where(model.project_id == project.id)):
            raise ConflictError(f"This project has {label} and cannot be deleted; set its status to cancelled instead")
    paths = db.scalars(select(TaskAttachment.file_path).join(Task, Task.id == TaskAttachment.task_id).where(Task.project_id == project.id)).all()
    name = project.name
    db.delete(project)  # tasks, milestones and members cascade
    log_activity(db, ctx, "deleted", "project", project_id, f"Deleted project {name}")
    db.commit()
    for path in paths:
        delete_stored_file(path)


# ---- members --------------------------------------------------------------

def _require_manages(ctx: Ctx, project: Project) -> None:
    """Managers may only change the team of projects they manage; admins may change any."""
    if not ctx.is_admin and project.manager_id != ctx.employee_id:
        raise ForbiddenError("Only the project manager can change the team")


def list_members(db: Session, ctx: Ctx, project_id: int) -> list[MemberOut]:
    return serialize_one(db, ctx, get_visible_project(db, ctx, project_id)).members


def add_member(db: Session, ctx: Ctx, project_id: int, data: MemberCreate) -> MemberOut:
    project = get_visible_project(db, ctx, project_id)
    _require_manages(ctx, project)
    employee = get_referenced(db, ctx, Employee, data.employee_id, "Employee")
    if any(m.employee_id == employee.id for m in project.members):
        raise ConflictError("This employee is already a member of the project", {"employee_id": "Already a member"})
    member = ProjectMember(employee_id=employee.id, role=data.role)
    project.members.append(member)
    db.flush()
    log_activity(db, ctx, "updated", "project", project.id, f"Added {employee.user.name} to project {project.name}")
    notify(db, [employee.user_id], "Added to a project", f"You were added to {project.name}", NotificationType.PROJECT, "project", project.id, exclude_user_id=ctx.user.id)
    db.commit()
    return _member_out(member, employee)


def remove_member(db: Session, ctx: Ctx, project_id: int, employee_id: int) -> None:
    project = get_visible_project(db, ctx, project_id)
    _require_manages(ctx, project)
    member = next((m for m in project.members if m.employee_id == employee_id), None)
    if member is None:
        raise NotFoundError("Member not found")
    if employee_id == project.manager_id:
        raise ConflictError("The project manager cannot be removed from the team; assign another manager first")
    employee = db.get(Employee, employee_id)
    project.members.remove(member)
    # a task must never stay assigned to someone who can no longer see the project
    for task in db.scalars(select(Task).where(Task.project_id == project.id, Task.assigned_to == employee_id)):
        task.assigned_to = None
    log_activity(db, ctx, "updated", "project", project.id, f"Removed {employee.user.name} from project {project.name}")
    db.commit()


# ---- activity feed --------------------------------------------------------

def activity_query(db: Session, ctx: Ctx, project_id: int) -> Select:
    project = get_visible_project(db, ctx, project_id)
    tasks = select(Task.id).where(Task.project_id == project.id)
    milestones = select(Milestone.id).where(Milestone.project_id == project.id)
    return (
        select(ActivityLog)
        .where(
            ActivityLog.company_id == project.company_id,
            or_(
                and_(ActivityLog.entity_type == "project", ActivityLog.entity_id == project.id),
                and_(ActivityLog.entity_type == "task", ActivityLog.entity_id.in_(tasks)),
                and_(ActivityLog.entity_type == "milestone", ActivityLog.entity_id.in_(milestones)),
            ),
        )
        .order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc())
    )


def serialize_activity(db: Session, rows: list[ActivityLog]) -> list[ActivityOut]:
    user_ids = {r.user_id for r in rows if r.user_id}
    names = dict(db.execute(select(User.id, User.name).where(User.id.in_(user_ids))).all()) if user_ids else {}
    return [
        ActivityOut(
            id=r.id, user_id=r.user_id, user_name=names.get(r.user_id), action=r.action,
            entity_type=r.entity_type, entity_id=r.entity_id, description=r.description, created_at=r.created_at,
        )
        for r in rows
    ]
