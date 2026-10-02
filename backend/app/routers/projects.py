from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.deps import DbSession, Needs
from app.core.enums import ProjectStatus
from app.core.exceptions import ForbiddenError, UnprocessableError
from app.models.milestone import Milestone
from app.models.project import Project
from app.routers.tasks import TaskFilterParams, task_page
from app.schemas.milestone import MilestoneCreate, MilestoneOut
from app.schemas.project import ActivityOut, MemberCreate, MemberOut, ProjectCreate, ProjectOut, ProjectUpdate
from app.schemas.task import TaskOut
from app.services import milestones as milestone_service
from app.services.access import get_visible_project
from app.services import projects as service
from app.services import tasks as task_service
from app.utils.pagination import Pagination, Sorting, apply_sort, paginate
from app.utils.responses import ERROR_RESPONSES, Envelope, Page, ok

_COMMON = {401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]}
router = APIRouter(prefix="/projects", tags=["Projects"], responses=_COMMON)
clients_router = APIRouter(prefix="/clients", tags=["Clients"], responses=_COMMON)
employees_router = APIRouter(prefix="/employees", tags=["Employees"], responses=_COMMON)
extra_routers = [clients_router, employees_router]

SORT_FIELDS = {
    "id": Project.id,
    "name": Project.name,
    "project_code": Project.project_code,
    "status": Project.status,
    "progress": Project.progress,
    "start_date": Project.start_date,
    "end_date": Project.end_date,
    "budget": Project.budget,
    "created_at": Project.created_at,
}
MILESTONE_SORT_FIELDS = {"id": Milestone.id, "name": Milestone.name, "due_date": Milestone.due_date, "status": Milestone.status, "progress": Milestone.progress, "created_at": Milestone.created_at}


def project_page(db, ctx, stmt, pagination: Pagination, sorting: Sorting) -> dict:
    if ctx.is_client and sorting.sort_by == "budget":
        raise UnprocessableError("Cannot sort by 'budget'", {"sort_by": "Not available"})  # would leak the internal figure's order
    page = paginate(db, apply_sort(stmt, sorting, SORT_FIELDS, "created_at"), pagination, lambda project: project)
    page["data"] = service.serialize(db, ctx, page["data"])
    return page


# ---- projects -------------------------------------------------------------

@router.get(
    "",
    response_model=Page[ProjectOut],
    summary="List projects",
    description="Admins see the whole company, managers the projects they manage or belong to, employees the ones they belong to, "
    "clients their own client's projects (without budget / spent).",
)
def list_projects(
    ctx: Needs("view_projects"),
    db: DbSession,
    pagination: Pagination,
    sorting: Sorting,
    search: Annotated[str | None, Query(description="Matches name, code, description")] = None,
    status_: Annotated[ProjectStatus | None, Query(alias="status")] = None,
    client_id: int | None = None,
    manager_id: int | None = None,
):
    stmt = service.list_query(ctx, search=search, status=status_, client_id=client_id, manager_id=manager_id)
    return project_page(db, ctx, stmt, pagination, sorting)


@router.post(
    "",
    response_model=Envelope[ProjectOut],
    status_code=status.HTTP_201_CREATED,
    summary="Create a project",
    description="`project_code` is generated (PRJ-001, PRJ-002, ...) when omitted and must be unique per company (409). "
    "A manager creating a project without `manager_id` becomes its manager. The manager is added to the team automatically.",
    responses={404: ERROR_RESPONSES[404], 409: ERROR_RESPONSES[422] | {"description": "Duplicate project code"}, 422: ERROR_RESPONSES[422]},
)
def create_project(body: ProjectCreate, ctx: Needs("create_projects"), db: DbSession):
    project = service.create_project(db, ctx, body)
    return ok(service.serialize_one(db, ctx, project), "Project created successfully")


@router.get("/{project_id}", response_model=Envelope[ProjectOut], summary="Get a project", responses={404: ERROR_RESPONSES[404]})
def get_project(project_id: int, ctx: Needs("view_projects"), db: DbSession):
    return ok(service.serialize_one(db, ctx, get_visible_project(db, ctx, project_id)))


@router.put(
    "/{project_id}",
    response_model=Envelope[ProjectOut],
    summary="Update a project",
    description="`progress` is only stored while the project has no tasks; otherwise it is derived from the tasks.",
    responses={404: ERROR_RESPONSES[404], 409: ERROR_RESPONSES[422] | {"description": "Duplicate project code"}, 422: ERROR_RESPONSES[422]},
)
def update_project(project_id: int, body: ProjectUpdate, ctx: Needs("edit_projects"), db: DbSession):
    project = service.update_project(db, ctx, project_id, body)
    return ok(service.serialize_one(db, ctx, project), "Project updated successfully")


@router.delete(
    "/{project_id}",
    response_model=Envelope[None],
    summary="Delete a project",
    description="409 when the project has invoices, quotations, tickets, expenses or documents (set its status to cancelled instead). "
    "Otherwise the project and its tasks, milestones and members are deleted.",
    responses={404: ERROR_RESPONSES[404], 409: ERROR_RESPONSES[422] | {"description": "Project has related records"}},
)
def delete_project(project_id: int, ctx: Needs("delete_projects"), db: DbSession):
    service.delete_project(db, ctx, project_id)
    return ok(None, "Project deleted successfully")


# ---- members --------------------------------------------------------------

@router.get("/{project_id}/members", response_model=Envelope[list[MemberOut]], summary="List project members", responses={404: ERROR_RESPONSES[404]})
def list_members(project_id: int, ctx: Needs("view_projects"), db: DbSession):
    return ok(service.list_members(db, ctx, project_id))


@router.post(
    "/{project_id}/members",
    response_model=Envelope[MemberOut],
    status_code=status.HTTP_201_CREATED,
    summary="Add a project member",
    description="Admins for any project, managers only for projects they manage. A duplicate is a 409. The employee is notified.",
    responses={404: ERROR_RESPONSES[404], 409: ERROR_RESPONSES[422] | {"description": "Already a member"}},
)
def add_member(project_id: int, body: MemberCreate, ctx: Needs("manage_project_members"), db: DbSession):
    return ok(service.add_member(db, ctx, project_id, body), "Member added successfully")


@router.delete(
    "/{project_id}/members/{employee_id}",
    response_model=Envelope[None],
    summary="Remove a project member",
    description="The project manager cannot be removed (409). Tasks assigned to the removed member become unassigned.",
    responses={404: ERROR_RESPONSES[404], 409: ERROR_RESPONSES[422] | {"description": "Member is the project manager"}},
)
def remove_member(project_id: int, employee_id: int, ctx: Needs("manage_project_members"), db: DbSession):
    service.remove_member(db, ctx, project_id, employee_id)
    return ok(None, "Member removed successfully")


# ---- milestones -----------------------------------------------------------

@router.get("/{project_id}/milestones", response_model=Page[MilestoneOut], summary="List a project's milestones", responses={404: ERROR_RESPONSES[404]})
def list_milestones(project_id: int, ctx: Needs("view_projects"), db: DbSession, pagination: Pagination, sorting: Sorting):
    stmt = apply_sort(milestone_service.list_query(db, ctx, project_id), sorting, MILESTONE_SORT_FIELDS, "id")
    page = paginate(db, stmt, pagination, lambda milestone: milestone)
    page["data"] = milestone_service.serialize(db, page["data"])
    return page


@router.post(
    "/{project_id}/milestones",
    response_model=Envelope[MilestoneOut],
    status_code=status.HTTP_201_CREATED,
    summary="Add a milestone to a project",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
def create_milestone(project_id: int, body: MilestoneCreate, ctx: Needs("edit_projects"), db: DbSession):
    milestone = milestone_service.create_milestone(db, ctx, project_id, body)
    return ok(milestone_service.serialize(db, [milestone])[0], "Milestone created successfully")


# ---- tasks & activity -----------------------------------------------------

@router.get(
    "/{project_id}/tasks",
    response_model=Page[TaskOut],
    summary="List a project's tasks",
    description="Same filters as `GET /tasks` (`project_id` is taken from the path). Employees only see their own tasks; clients get 403.",
    responses={404: ERROR_RESPONSES[404]},
)
def list_project_tasks(project_id: int, ctx: Needs("view_tasks"), db: DbSession, pagination: Pagination, sorting: Sorting, filters: TaskFilterParams):
    return task_page(db, task_service.project_tasks_query(db, ctx, project_id, filters), pagination, sorting)


@router.get(
    "/{project_id}/activity",
    response_model=Page[ActivityOut],
    summary="Project activity feed",
    description="Audit entries of the project and its tasks and milestones, newest first. Internal users only.",
    responses={404: ERROR_RESPONSES[404]},
)
def project_activity(project_id: int, ctx: Needs("view_projects"), db: DbSession, pagination: Pagination):
    if ctx.is_client:
        raise ForbiddenError()
    page = paginate(db, service.activity_query(db, ctx, project_id), pagination, lambda row: row)
    page["data"] = service.serialize_activity(db, page["data"])
    return page


# ---- sub-resources of other modules' prefixes -----------------------------

@clients_router.get(
    "/{client_id}/projects",
    response_model=Page[ProjectOut],
    summary="List a client's projects",
    description="Only projects the caller may see. A client user can only ask for their own client.",
    responses={404: ERROR_RESPONSES[404]},
)
def list_client_projects(client_id: int, ctx: Needs("view_projects"), db: DbSession, pagination: Pagination, sorting: Sorting):
    return project_page(db, ctx, service.client_projects_query(db, ctx, client_id), pagination, sorting)


@employees_router.get(
    "/{employee_id}/projects",
    response_model=Page[ProjectOut],
    summary="List projects an employee manages or belongs to",
    description="Admins and managers for anyone in the company (managers limited to projects they can see); an employee only for themself; clients get 403.",
    responses={404: ERROR_RESPONSES[404]},
)
def list_employee_projects(employee_id: int, ctx: Needs("view_projects"), db: DbSession, pagination: Pagination, sorting: Sorting):
    return project_page(db, ctx, service.employee_projects_query(db, ctx, employee_id), pagination, sorting)


@employees_router.get(
    "/{employee_id}/tasks",
    response_model=Page[TaskOut],
    summary="List tasks assigned to an employee",
    description="Same access rules as `/employees/{id}/projects`; supports the `GET /tasks` filters.",
    responses={404: ERROR_RESPONSES[404]},
)
def list_employee_tasks(employee_id: int, ctx: Needs("view_tasks"), db: DbSession, pagination: Pagination, sorting: Sorting, filters: TaskFilterParams):
    return task_page(db, task_service.employee_tasks_query(db, ctx, employee_id, filters), pagination, sorting)
