from typing import Annotated

from fastapi import APIRouter, Query

from app.core.deps import DbSession, Needs
from app.schemas.dashboard import (
    ActivityItem,
    ClientsOut,
    Overview,
    ProjectsOut,
    RevenueOut,
    TasksOut,
    TicketsOut,
)
from app.services import dashboard as service
from app.utils.responses import ERROR_RESPONSES, Envelope, ok

router = APIRouter(prefix="/dashboard", tags=["Dashboard"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})

Months = Annotated[int, Query(ge=1, le=24, description="How many calendar months to include, ending with the current one")]
CompanyId = Annotated[int | None, Query(description="Super admin only: restrict to one company (omit for all)")]


@router.get(
    "/overview",
    response_model=Envelope[Overview],
    summary="Role-aware KPI overview",
    description="Admin/super admin: revenue (this vs last month), outstanding, active clients/projects, pending tasks, open tickets, "
    "overdue invoices/tasks and 6-month sparklines. Manager: same shape, restricted to the projects they can see; "
    "finance and client blocks are null. Employee: own tasks, projects, deadlines, tickets, attendance and leave. "
    "Client: own projects, outstanding balance, tickets, next meeting, recent invoices and payments. "
    "Discriminate on `view`.",
)
def overview(ctx: Needs("view_dashboard"), db: DbSession, company_id: CompanyId = None):
    return ok(service.overview(db, ctx))


@router.get(
    "/revenue",
    response_model=Envelope[RevenueOut],
    summary="Monthly revenue, invoiced and outstanding (admin only)",
    description="`revenue` = payments received in the month; `invoiced` and `outstanding` are for invoices issued in the month "
    "(draft and cancelled invoices excluded).",
)
def revenue(ctx: Needs("view_dashboard"), db: DbSession, months: Months = 6, company_id: CompanyId = None):
    return ok(service.revenue_series(db, ctx, months))


@router.get(
    "/projects",
    response_model=Envelope[ProjectsOut],
    summary="Project counts by status and the top open projects by progress",
)
def projects(ctx: Needs("view_dashboard"), db: DbSession, limit: Annotated[int, Query(ge=1, le=50)] = 5, company_id: CompanyId = None):
    return ok(service.projects_summary(db, ctx, limit))


@router.get(
    "/tasks",
    response_model=Envelope[TasksOut],
    summary="Task counts by status/priority, overdue count and tasks due this week",
    description="Restricted to the caller's visible tasks: admin all, manager tasks of visible projects, employee their own.",
)
def tasks(ctx: Needs("view_dashboard"), db: DbSession, limit: Annotated[int, Query(ge=1, le=50)] = 10, company_id: CompanyId = None):
    return ok(service.tasks_summary(db, ctx, limit))


@router.get(
    "/clients",
    response_model=Envelope[ClientsOut],
    summary="Client counts by status, top clients by revenue and new clients per month (admin only)",
)
def clients(
    ctx: Needs("view_dashboard"), db: DbSession,
    limit: Annotated[int, Query(ge=1, le=50)] = 5, months: Months = 6, company_id: CompanyId = None,
):
    return ok(service.clients_summary(db, ctx, limit, months))


@router.get(
    "/tickets",
    response_model=Envelope[TicketsOut],
    summary="Ticket counts, monthly opened-vs-resolved trend and average resolution time",
)
def tickets(ctx: Needs("view_dashboard"), db: DbSession, months: Months = 6, company_id: CompanyId = None):
    return ok(service.tickets_summary(db, ctx, months))


@router.get(
    "/activities",
    response_model=Envelope[list[ActivityItem]],
    summary="Latest audit-trail entries",
    description="Admin and manager: company-wide. Employee: only their own actions. Client: always empty.",
)
def activities(ctx: Needs("view_dashboard"), db: DbSession, limit: Annotated[int, Query(ge=1, le=100)] = 10, company_id: CompanyId = None):
    return ok(service.activities(db, ctx, limit))
