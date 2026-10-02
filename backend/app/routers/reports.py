from dataclasses import dataclass
from datetime import date
from math import ceil
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from app.core.deps import DbSession, Needs
from app.schemas.report import ReportPage
from app.services import reports as service
from app.utils.pagination import Pagination
from app.utils.responses import ERROR_RESPONSES

router = APIRouter(
    prefix="/reports", tags=["Reports"],
    responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403], 422: ERROR_RESPONSES[422]},
)


@dataclass
class ReportParams:
    filters: service.Filters
    as_csv: bool


def report_params(
    start_date: Annotated[date | None, Query(description="Inclusive lower bound (YYYY-MM-DD)")] = None,
    end_date: Annotated[date | None, Query(description="Inclusive upper bound; must be >= start_date")] = None,
    company_id: Annotated[int | None, Query(description="Super admin only: restrict to one company; ignored for everyone else")] = None,
    project_id: int | None = None,
    client_id: int | None = None,
    department_id: int | None = None,
    format_: Annotated[str, Query(alias="format", pattern="^(json|csv)$", description="`csv` streams the same rows as text/csv (unpaginated)")] = "json",
) -> ReportParams:
    return ReportParams(service.Filters(start_date, end_date, project_id, client_id, department_id), format_ == "csv")


Params = Annotated[ReportParams, Depends(report_params)]


def _respond(name: str, ctx, db, params: ReportParams, pagination):
    result = service.run_report(db, ctx, name, params.filters, None if params.as_csv else pagination)
    if params.as_csv:
        headers = {"Content-Disposition": f'attachment; filename="{name}-report-{date.today():%Y%m%d}.csv"'}
        return StreamingResponse(service.csv_lines(result), media_type="text/csv", headers=headers)
    return {
        "success": True, "message": "OK",
        "data": {"summary": result.summary, "rows": result.rows, "chart": result.chart},
        "page": pagination.page, "limit": pagination.limit, "total": result.total,
        "total_pages": ceil(result.total / pagination.limit) if result.total else 0,
    }


_DESC = "Response: `summary` (totals), `rows` (paginated with page/limit/total), `chart` (label/value points). `?format=csv` downloads all rows."


@router.get("/revenue", response_model=ReportPage, summary="Revenue report (admin only)",
            description=f"Payments received, grouped by client (rows) and by month (chart). Filters: dates on payment date, client_id, project_id. {_DESC}")
def revenue(ctx: Needs("view_reports"), db: DbSession, params: Params, pagination: Pagination):
    return _respond("revenue", ctx, db, params, pagination)


@router.get("/projects", response_model=ReportPage, summary="Project completion report (admin; manager: visible projects)",
            description=f"Completion % = completed tasks / total tasks * 100 (0 when no tasks). Dates select projects whose start-end window overlaps the period. {_DESC}")
def projects(ctx: Needs("view_reports"), db: DbSession, params: Params, pagination: Pagination):
    return _respond("projects", ctx, db, params, pagination)


@router.get("/clients", response_model=ReportPage, summary="Client billing report (admin only)",
            description=f"Per client: billed, paid, outstanding (draft/cancelled invoices excluded) and project count. Dates apply to invoice issue date. {_DESC}")
def clients(ctx: Needs("view_reports"), db: DbSession, params: Params, pagination: Pagination):
    return _respond("clients", ctx, db, params, pagination)


@router.get("/employees", response_model=ReportPage, summary="Employee performance report (admin; manager: members of visible projects)",
            description=f"Tasks assigned/completed, on-time % and project count per employee. Salary is never included. Dates apply to task due date. {_DESC}")
def employees(ctx: Needs("view_reports"), db: DbSession, params: Params, pagination: Pagination):
    return _respond("employees", ctx, db, params, pagination)


@router.get("/tasks", response_model=ReportPage, summary="Task report (admin; manager: visible projects)",
            description=f"Rows are tasks; summary breaks them down by status, priority and assignee with overdue counts. Dates apply to task due date. {_DESC}")
def tasks(ctx: Needs("view_reports"), db: DbSession, params: Params, pagination: Pagination):
    return _respond("tasks", ctx, db, params, pagination)


@router.get("/invoices", response_model=ReportPage, summary="Invoice report with aging (admin only)",
            description=f"Summary has totals, per-status figures and aging buckets (current, 1-30, 31-60, 61-90, 90+ days overdue). Dates apply to issue date. {_DESC}")
def invoices(ctx: Needs("view_reports"), db: DbSession, params: Params, pagination: Pagination):
    return _respond("invoices", ctx, db, params, pagination)


@router.get("/payments", response_model=ReportPage, summary="Payment report (admin only)",
            description=f"Payments by method (summary) and by month (chart). Dates apply to payment date. {_DESC}")
def payments(ctx: Needs("view_reports"), db: DbSession, params: Params, pagination: Pagination):
    return _respond("payments", ctx, db, params, pagination)


@router.get("/tickets", response_model=ReportPage, summary="Support ticket report (admin; manager: visible projects)",
            description=f"By status, priority and client with average resolution time. Dates apply to the ticket creation date. {_DESC}")
def tickets(ctx: Needs("view_reports"), db: DbSession, params: Params, pagination: Pagination):
    return _respond("tickets", ctx, db, params, pagination)
