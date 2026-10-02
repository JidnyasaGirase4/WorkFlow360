from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.deps import DbSession, Needs
from app.core.enums import GenericStatus
from app.models.department import Department
from app.schemas.department import DepartmentCreate, DepartmentOut, DepartmentUpdate
from app.services import departments as service
from app.utils.pagination import Pagination, Sorting, apply_sort, paginate
from app.utils.responses import ERROR_RESPONSES, Envelope, Page, ok

router = APIRouter(prefix="/departments", tags=["Departments"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})

SORT_FIELDS = {
    "id": Department.id,
    "name": Department.name,
    "status": Department.status,
    "created_at": Department.created_at,
    "employee_count": service.employee_count_column(),
}


@router.get("", response_model=Page[DepartmentOut], summary="List departments", description="Paginated list with the number of employees in each department.")
def list_departments(
    ctx: Needs("view_departments"),
    db: DbSession,
    pagination: Pagination,
    sorting: Sorting,
    search: Annotated[str | None, Query(description="Matches name and description")] = None,
    status_: Annotated[GenericStatus | None, Query(alias="status")] = None,
):
    stmt = apply_sort(service.list_query(ctx, search=search, status=status_), sorting, SORT_FIELDS, "created_at")
    page = paginate(db, stmt, pagination, DepartmentOut.model_validate)
    service.attach_counts(db, page["data"])
    return page


@router.post(
    "",
    response_model=Envelope[DepartmentOut],
    status_code=status.HTTP_201_CREATED,
    summary="Create a department",
    description="The name must be unique within the company (409 otherwise).",
    responses={409: ERROR_RESPONSES[422] | {"description": "Duplicate department name"}, 422: ERROR_RESPONSES[422]},
)
def create_department(body: DepartmentCreate, ctx: Needs("manage_departments"), db: DbSession):
    return ok(service.department_out(db, service.create_department(db, ctx, body)), "Department created successfully")


@router.get("/{department_id}", response_model=Envelope[DepartmentOut], summary="Get a department", responses={404: ERROR_RESPONSES[404]})
def get_department(department_id: int, ctx: Needs("view_departments"), db: DbSession):
    return ok(service.department_out(db, service.get_department(db, ctx, department_id)))


@router.put(
    "/{department_id}",
    response_model=Envelope[DepartmentOut],
    summary="Update a department",
    responses={404: ERROR_RESPONSES[404], 409: ERROR_RESPONSES[422] | {"description": "Duplicate department name"}},
)
def update_department(department_id: int, body: DepartmentUpdate, ctx: Needs("manage_departments"), db: DbSession):
    return ok(service.department_out(db, service.update_department(db, ctx, department_id, body)), "Department updated successfully")


@router.delete(
    "/{department_id}",
    response_model=Envelope[None],
    summary="Delete a department",
    description="Rejected with 409 while employees are assigned; set the status to inactive instead.",
    responses={404: ERROR_RESPONSES[404], 409: ERROR_RESPONSES[422] | {"description": "Department has employees"}},
)
def delete_department(department_id: int, ctx: Needs("manage_departments"), db: DbSession):
    service.delete_department(db, ctx, department_id)
    return ok(None, "Department deleted successfully")
