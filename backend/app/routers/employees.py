from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.deps import CurrentCtx, DbSession, Needs
from app.core.enums import EmploymentStatus, EmploymentType
from app.models.activity import ActivityLog
from app.models.department import Department
from app.models.employee import Employee
from app.models.user import User
from app.schemas.employee import EmployeeActivityOut, EmployeeCreate, EmployeeCreated, EmployeeDetail, EmployeeOut, EmployeeUpdate
from app.services import employees as service
from app.utils.pagination import Pagination, Sorting, apply_sort, paginate
from app.utils.responses import ERROR_RESPONSES, Envelope, Page, ok

router = APIRouter(prefix="/employees", tags=["Employees"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})

SORT_FIELDS = {
    "id": Employee.id,
    "name": User.name,
    "employee_code": Employee.employee_code,
    "designation": Employee.designation,
    "department": Department.name,
    "joining_date": Employee.joining_date,
    "employment_status": Employee.employment_status,
    "created_at": Employee.created_at,
}
ACTIVITY_SORT_FIELDS = {"id": ActivityLog.id, "created_at": ActivityLog.created_at, "action": ActivityLog.action}
CONFLICT = ERROR_RESPONSES[422] | {"description": "Duplicate email or employee code"}


@router.get(
    "",
    response_model=Page[EmployeeOut],
    summary="List employees",
    description="Company directory. Salary is null unless the caller has `view_salary`; sensitive personal fields are null for the "
    "`employee` role (directory view: name, email, phone, designation, department, location).",
)
def list_employees(
    ctx: Needs("view_employees"),
    db: DbSession,
    pagination: Pagination,
    sorting: Sorting,
    search: Annotated[str | None, Query(description="Matches name, email, employee code, designation")] = None,
    department: Annotated[str | None, Query(description="Department name, case-insensitive")] = None,
    department_id: int | None = None,
    status_: Annotated[EmploymentStatus | None, Query(alias="status", description="Employment status")] = None,
    employment_type: EmploymentType | None = None,
):
    stmt = service.list_query(ctx, search=search, department=department, department_id=department_id, status=status_, employment_type=employment_type)
    stmt = apply_sort(stmt, sorting, SORT_FIELDS, "created_at")
    return paginate(db, stmt, pagination, lambda emp: service.serialize(db, ctx, emp))


@router.post(
    "",
    response_model=Envelope[EmployeeCreated],
    status_code=status.HTTP_201_CREATED,
    summary="Create an employee (and their login)",
    description="Creates the login user and the employee record in one transaction. `role` is `employee` (default) or `manager`. "
    "Without `password` a strong random one is generated and returned once as `temporary_password`. "
    "`employee_code` defaults to the next `EMP-0001` style number. Duplicate email or code is 409.",
    responses={409: CONFLICT, 422: ERROR_RESPONSES[422], 404: ERROR_RESPONSES[404]},
)
def create_employee(body: EmployeeCreate, ctx: Needs("create_employees"), db: DbSession):
    emp, temporary = service.create_employee(db, ctx, body)
    return ok(EmployeeCreated.model_validate({**service.detail(db, ctx, emp).model_dump(), "temporary_password": temporary}), "Employee created successfully")


# Declared before /{employee_id} so "me" is not parsed as an id.
@router.get("/me", response_model=Envelope[EmployeeDetail], summary="The caller's own employee profile", responses={404: ERROR_RESPONSES[404]})
def get_me(ctx: CurrentCtx, db: DbSession):
    return ok(service.detail(db, ctx, service.get_me(db, ctx)))


@router.get(
    "/{employee_id}",
    response_model=Envelope[EmployeeDetail],
    summary="Get an employee profile",
    description="Includes `stats` (project_count, open_task_count, leave_balance) for admins, managers and the employee themself.",
    responses={404: ERROR_RESPONSES[404]},
)
def get_employee(employee_id: int, ctx: Needs("view_employees"), db: DbSession):
    return ok(service.detail(db, ctx, service.get_employee(db, ctx, employee_id)))


@router.put(
    "/{employee_id}",
    response_model=Envelope[EmployeeDetail],
    summary="Update an employee",
    description="Also updates the linked user's name, phone and email. Changing `salary` needs `view_salary` (403 otherwise). "
    "Setting `employment_status` to inactive/terminated also deactivates the login.",
    responses={404: ERROR_RESPONSES[404], 409: CONFLICT},
)
def update_employee(employee_id: int, body: EmployeeUpdate, ctx: Needs("edit_employees"), db: DbSession):
    emp = service.update_employee(db, ctx, employee_id, body)
    return ok(service.detail(db, ctx, emp), "Employee updated successfully")


@router.delete(
    "/{employee_id}",
    response_model=Envelope[None],
    summary="Deactivate an employee",
    description="Never a hard delete: employment_status becomes `terminated`, the login is set inactive and all refresh tokens are revoked. "
    "You cannot deactivate yourself.",
    responses={404: ERROR_RESPONSES[404]},
)
def deactivate_employee(employee_id: int, ctx: Needs("delete_employees"), db: DbSession):
    service.deactivate_employee(db, ctx, employee_id)
    return ok(None, "Employee deactivated successfully")


@router.get(
    "/{employee_id}/activity",
    response_model=Page[EmployeeActivityOut],
    summary="Audit trail of an employee's actions",
    description="Admins, managers and the employee themself.",
    responses={404: ERROR_RESPONSES[404]},
)
def employee_activity(employee_id: int, ctx: CurrentCtx, db: DbSession, pagination: Pagination, sorting: Sorting):
    stmt = apply_sort(service.activity_query(db, ctx, employee_id), sorting, ACTIVITY_SORT_FIELDS, "created_at")
    return paginate(db, stmt, pagination, EmployeeActivityOut.model_validate)
