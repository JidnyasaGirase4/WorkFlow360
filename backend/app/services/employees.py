"""Employee business rules: creation with login account, field-level visibility, deactivation."""
import secrets
import string
from datetime import date

from sqlalchemy import Integer, Select, cast, func, select
from sqlalchemy.orm import Session

from app.core.deps import Ctx
from app.core.enums import EmploymentStatus, EmploymentType, RoleName, TaskStatus, UserStatus
from app.core.exceptions import BadRequestError, ConflictError, ForbiddenError, NotFoundError
from app.core.security import hash_password, password_problems
from app.models.activity import ActivityLog
from app.models.department import Department
from app.models.employee import Employee
from app.models.project import ProjectMember
from app.models.role import Role
from app.models.task import Task
from app.models.user import User
from app.schemas.employee import EmployeeCreate, EmployeeDetail, EmployeeOut, EmployeeStats, EmployeeUpdate
from app.services import auth as auth_service
from app.services import leave as leave_service
from app.services.activity import log_activity
from app.services.common import get_referenced, get_scoped_or_404
from app.utils.pagination import like_any

_ADMIN_ROLES = (RoleName.COMPANY_ADMIN.value, RoleName.SUPER_ADMIN.value)
_INACTIVE = (EmploymentStatus.INACTIVE, EmploymentStatus.TERMINATED)
_USER_FIELDS = ("name", "email", "phone")


# ---- visibility ------------------------------------------------------------

def _is_self(ctx: Ctx, emp: Employee) -> bool:
    return ctx.employee_id is not None and ctx.employee_id == emp.id


def _sees_personal(ctx: Ctx, emp: Employee) -> bool:
    """Admin, manager, or the employee themself may see the non-directory fields."""
    return ctx.is_admin or ctx.is_manager or _is_self(ctx, emp)


def _sees_salary(ctx: Ctx, emp: Employee) -> bool:
    return ctx.can("view_salary") or _is_self(ctx, emp)


def serialize(db: Session, ctx: Ctx, emp: Employee) -> EmployeeOut:
    """Applies field visibility: hidden fields are returned as null, never omitted."""
    user = emp.user
    data = {
        "id": emp.id, "company_id": emp.company_id, "user_id": emp.user_id, "employee_code": emp.employee_code,
        "name": user.name, "email": user.email, "phone": user.phone, "role": user.role.name, "profile_image": user.profile_image,
        "department_id": emp.department_id, "department_name": emp.department.name if emp.department else None,
        "designation": emp.designation, "location": emp.location, "employment_status": emp.employment_status,
        "created_at": emp.created_at, "updated_at": emp.updated_at,
    }
    if _sees_personal(ctx, emp):
        manager = db.get(Employee, emp.manager_id) if emp.manager_id else None
        data |= {
            "user_status": user.status, "joining_date": emp.joining_date, "employment_type": emp.employment_type,
            "manager_id": emp.manager_id, "manager_name": manager.user.name if manager else None,
            "skills": emp.skills or [], "gender": emp.gender, "date_of_birth": emp.date_of_birth, "address": emp.address,
            "emergency_contact_name": emp.emergency_contact_name, "emergency_contact_phone": emp.emergency_contact_phone,
            "emergency_contact_relation": emp.emergency_contact_relation,
        }
    if _sees_salary(ctx, emp):
        data["salary"] = emp.salary
    return EmployeeOut.model_validate(data)


def detail(db: Session, ctx: Ctx, emp: Employee) -> EmployeeDetail:
    out = serialize(db, ctx, emp).model_dump()
    stats = None
    if _sees_personal(ctx, emp):
        stats = EmployeeStats(
            project_count=db.scalar(select(func.count()).select_from(ProjectMember).where(ProjectMember.employee_id == emp.id)) or 0,
            open_task_count=db.scalar(select(func.count()).select_from(Task).where(Task.assigned_to == emp.id, Task.status != TaskStatus.COMPLETED)) or 0,
            leave_balance=leave_service.compute_balance(db, emp.id, date.today().year),
        )
    return EmployeeDetail.model_validate({**out, "stats": stats})


# ---- queries ---------------------------------------------------------------

def list_query(
    ctx: Ctx,
    *,
    search: str | None,
    department: str | None,
    department_id: int | None,
    status: EmploymentStatus | None,
    employment_type: EmploymentType | None,
) -> Select:
    stmt = (
        ctx.scope(select(Employee), Employee)
        .join(User, User.id == Employee.user_id)
        .outerjoin(Department, Department.id == Employee.department_id)
    )
    if search:
        stmt = stmt.where(like_any(search, User.name, User.email, Employee.employee_code, Employee.designation))
    if department:
        stmt = stmt.where(func.lower(Department.name) == department.strip().lower())
    if department_id:
        stmt = stmt.where(Employee.department_id == department_id)
    if status:
        stmt = stmt.where(Employee.employment_status == status)
    if employment_type:
        stmt = stmt.where(Employee.employment_type == employment_type)
    return stmt


def get_employee(db: Session, ctx: Ctx, employee_id: int) -> Employee:
    return get_scoped_or_404(db, ctx, Employee, employee_id, "Employee")


def get_me(db: Session, ctx: Ctx) -> Employee:
    if ctx.is_client:
        raise ForbiddenError()
    if ctx.employee_id is None:
        raise NotFoundError("Your account has no employee profile")
    return get_employee(db, ctx, ctx.employee_id)


def activity_query(db: Session, ctx: Ctx, employee_id: int) -> Select:
    emp = get_employee(db, ctx, employee_id)
    if not (ctx.is_admin or ctx.is_manager or _is_self(ctx, emp)):
        raise ForbiddenError()
    return select(ActivityLog).where(ActivityLog.user_id == emp.user_id)


# ---- create / update / deactivate -------------------------------------------

def generate_password() -> str:
    alphabet = string.ascii_letters + string.digits
    while True:
        candidate = "".join(secrets.choice(alphabet) for _ in range(14))
        if not password_problems(candidate):
            return candidate


def _next_code(db: Session, company_id: int) -> str:
    last = db.scalar(
        select(func.max(cast(func.substr(Employee.employee_code, 5), Integer))).where(
            Employee.company_id == company_id, Employee.employee_code.op("REGEXP")(r"^EMP-[0-9]+$")
        )
    )
    return f"EMP-{(last or 0) + 1:04d}"


def _assert_code_free(db: Session, company_id: int, code: str, exclude_id: int | None = None) -> None:
    stmt = select(Employee.id).where(Employee.company_id == company_id, Employee.employee_code == code)
    if exclude_id:
        stmt = stmt.where(Employee.id != exclude_id)
    if db.scalar(stmt):
        raise ConflictError("This employee code is already in use", {"employee_code": "Already exists"})


def _assert_email_free(db: Session, email: str, exclude_user_id: int | None = None) -> None:
    stmt = select(User.id).where(User.email == email)
    if exclude_user_id:
        stmt = stmt.where(User.id != exclude_user_id)
    if db.scalar(stmt):
        raise ConflictError("An account with this email already exists", {"email": "Already registered"})


def _check_refs(db: Session, ctx: Ctx, data: dict, employee_id: int | None = None) -> None:
    if data.get("department_id") is not None:
        get_referenced(db, ctx, Department, data["department_id"], "Department")
    if data.get("manager_id") is not None:
        if employee_id is not None and data["manager_id"] == employee_id:
            raise BadRequestError("An employee cannot be their own manager", {"manager_id": "Invalid"})
        get_referenced(db, ctx, Employee, data["manager_id"], "Manager")


def create_employee(db: Session, ctx: Ctx, data: EmployeeCreate) -> tuple[Employee, str | None]:
    company_id = ctx.require_company()
    email = data.email.lower()
    _assert_email_free(db, email)
    values = data.model_dump(exclude={*_USER_FIELDS, "role", "password", "employee_code"})
    _check_refs(db, ctx, values)
    code = data.employee_code or _next_code(db, company_id)
    if data.employee_code:
        _assert_code_free(db, company_id, code)

    temporary = None if data.password else generate_password()
    role = db.scalar(select(Role).where(Role.name == data.role))
    user = User(company_id=company_id, name=data.name, email=email, phone=data.phone, role_id=role.id, password_hash=hash_password(data.password or temporary))
    db.add(user)
    db.flush()
    emp = Employee(company_id=company_id, user_id=user.id, employee_code=code, **values)
    db.add(emp)
    db.flush()
    log_activity(db, ctx, "created", "employee", emp.id, f"Created employee {user.name} ({code}) with role {data.role}")
    db.commit()
    db.refresh(emp)  # sessions do not expire on commit: reload joined department/user and DB-normalised values
    return emp, temporary


def _deactivate_user(db: Session, ctx: Ctx, emp: Employee) -> None:
    if emp.user_id == ctx.user.id:
        raise ForbiddenError("You cannot deactivate your own account")
    emp.user.status = UserStatus.INACTIVE
    auth_service.revoke_all_sessions(db, emp.user_id)


def _assert_may_manage(ctx: Ctx, emp: Employee) -> None:
    if ctx.is_manager and emp.user.role.name in _ADMIN_ROLES:
        raise ForbiddenError("Managers cannot modify administrator accounts")


def update_employee(db: Session, ctx: Ctx, employee_id: int, data: EmployeeUpdate) -> Employee:
    emp = get_employee(db, ctx, employee_id)
    _assert_may_manage(ctx, emp)
    changes = data.model_dump(exclude_unset=True)
    if "salary" in changes:
        ctx.require("view_salary")
    _check_refs(db, ctx, changes, emp.id)
    if "employee_code" in changes:
        _assert_code_free(db, emp.company_id, changes["employee_code"], exclude_id=emp.id)
    if "email" in changes:
        changes["email"] = changes["email"].lower()
        _assert_email_free(db, changes["email"], exclude_user_id=emp.user_id)

    if "employment_status" in changes:
        new_status = changes["employment_status"]
        if new_status in _INACTIVE:
            _deactivate_user(db, ctx, emp)
        elif emp.employment_status in _INACTIVE and emp.user.status == UserStatus.INACTIVE:
            emp.user.status = UserStatus.ACTIVE  # reinstated

    for field, value in changes.items():
        setattr(emp.user if field in _USER_FIELDS else emp, field, value)
    log_activity(db, ctx, "updated", "employee", emp.id, f"Updated employee {emp.user.name} (fields: {', '.join(sorted(changes))})")
    db.commit()
    db.refresh(emp)
    return emp


def deactivate_employee(db: Session, ctx: Ctx, employee_id: int) -> None:
    """Employees are never hard-deleted: history (attendance, tasks, audit) must survive."""
    emp = get_employee(db, ctx, employee_id)
    _assert_may_manage(ctx, emp)
    _deactivate_user(db, ctx, emp)
    emp.employment_status = EmploymentStatus.TERMINATED
    log_activity(db, ctx, "deleted", "employee", emp.id, f"Deactivated employee {emp.user.name} ({emp.employee_code})")
    db.commit()
