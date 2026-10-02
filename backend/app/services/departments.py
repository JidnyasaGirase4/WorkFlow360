"""Department business rules."""
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.deps import Ctx
from app.core.enums import GenericStatus
from app.core.exceptions import ConflictError
from app.models.department import Department
from app.models.employee import Employee
from app.schemas.department import DepartmentCreate, DepartmentOut, DepartmentUpdate
from app.services.activity import log_activity
from app.services.common import get_scoped_or_404
from app.utils.pagination import like_any


def list_query(ctx: Ctx, *, search: str | None, status: GenericStatus | None) -> Select:
    stmt = ctx.scope(select(Department), Department)
    if search:
        stmt = stmt.where(like_any(search, Department.name, Department.description))
    if status:
        stmt = stmt.where(Department.status == status)
    return stmt


def employee_count_column():
    """Correlated count, used as a sort key."""
    return select(func.count(Employee.id)).where(Employee.department_id == Department.id).correlate(Department).scalar_subquery()


def attach_counts(db: Session, items: list[DepartmentOut]) -> list[DepartmentOut]:
    """Fills employee_count for a page of departments with one grouped query."""
    if items:
        rows = db.execute(
            select(Employee.department_id, func.count(Employee.id)).where(Employee.department_id.in_([i.id for i in items])).group_by(Employee.department_id)
        ).all()
        counts = dict(rows)
        for item in items:
            item.employee_count = counts.get(item.id, 0)
    return items


def department_out(db: Session, dept: Department) -> DepartmentOut:
    return attach_counts(db, [DepartmentOut.model_validate(dept)])[0]


def get_department(db: Session, ctx: Ctx, department_id: int) -> Department:
    return get_scoped_or_404(db, ctx, Department, department_id, "Department")


def _assert_unique_name(db: Session, company_id: int, name: str, exclude_id: int | None = None) -> None:
    stmt = select(Department.id).where(Department.company_id == company_id, func.lower(Department.name) == name.lower())
    if exclude_id:
        stmt = stmt.where(Department.id != exclude_id)
    if db.scalar(stmt):
        raise ConflictError("A department with this name already exists", {"name": "Already exists"})


def create_department(db: Session, ctx: Ctx, data: DepartmentCreate) -> Department:
    company_id = ctx.require_company()
    _assert_unique_name(db, company_id, data.name)
    dept = Department(company_id=company_id, **data.model_dump())
    db.add(dept)
    db.flush()
    log_activity(db, ctx, "created", "department", dept.id, f"Created department {dept.name}")
    db.commit()
    return dept


def update_department(db: Session, ctx: Ctx, department_id: int, data: DepartmentUpdate) -> Department:
    dept = get_department(db, ctx, department_id)
    changes = data.model_dump(exclude_unset=True)
    if "name" in changes:
        _assert_unique_name(db, dept.company_id, changes["name"], exclude_id=dept.id)
    for field, value in changes.items():
        setattr(dept, field, value)
    log_activity(db, ctx, "updated", "department", dept.id, f"Updated department {dept.name}")
    db.commit()
    return dept


def delete_department(db: Session, ctx: Ctx, department_id: int) -> None:
    dept = get_department(db, ctx, department_id)
    assigned = db.scalar(select(func.count(Employee.id)).where(Employee.department_id == dept.id)) or 0
    if assigned:
        raise ConflictError(
            f"{dept.name} still has {assigned} employee(s) assigned. Reassign them or set the department status to inactive instead of deleting it.",
            {"employee_count": assigned},
        )
    name = dept.name
    db.delete(dept)
    log_activity(db, ctx, "deleted", "department", department_id, f"Deleted department {name}")
    db.commit()
