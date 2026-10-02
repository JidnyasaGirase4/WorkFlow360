"""Dashboard metrics. Everything is aggregated in SQL (GROUP BY / conditional SUM) — never by looping over tables.

The scope helpers at the top (`task_filter`, `ticket_filter`, `invoice_filter`, month helpers, overdue rule) are
shared with the reports and search services so row-level rules and definitions cannot drift apart.
"""
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from enum import Enum

from sqlalchemy import ColumnElement, and_, case, false, func, literal_column, or_, select, true
from sqlalchemy.orm import Session

from app.core.deps import Ctx
from app.core.enums import (
    ClientStatus,
    InvoiceStatus,
    LeaveStatus,
    MeetingStatus,
    Priority,
    ProjectStatus,
    TaskStatus,
    TicketStatus,
)
from app.core.exceptions import ForbiddenError
from app.models.activity import ActivityLog
from app.models.client import Client
from app.models.employee import AttendanceRecord, Employee, LeaveRequest
from app.models.invoice import Invoice
from app.models.meeting import Meeting
from app.models.payment import Payment
from app.models.project import Project
from app.models.task import Task
from app.models.ticket import Ticket
from app.models.user import User
from app.services.access import project_visibility, visible_project_ids

OPEN_TICKET_STATUSES = (TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_FOR_CLIENT)
UNPAID_INVOICE_STATUSES = (InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE)
NON_BILLABLE_INVOICE_STATUSES = (InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED)
OPEN_PROJECT_STATUSES = (ProjectStatus.PLANNING, ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD)


# ---- shared helpers --------------------------------------------------------------

def today() -> date:
    return date.today()


def f2(value) -> float:
    """Money/decimal -> JSON number rounded half-up to 2 places."""
    if value is None:
        return 0.0
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def pct_change(current: Decimal, previous: Decimal) -> float | None:
    if not previous:
        return None
    return float(((current - previous) / previous * 100).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def label_of(member: Enum) -> str:
    return member.value.replace("_", " ").title()


def dt(day: date) -> datetime:
    return datetime.combine(day, time.min)


@dataclass(frozen=True)
class Month:
    key: str  # "2026-09"
    label: str  # "Sep"
    start: date
    end: date  # first day of the next month (exclusive bound)


def add_months(first_of_month: date, n: int) -> date:
    index = first_of_month.year * 12 + first_of_month.month - 1 + n
    return date(index // 12, index % 12 + 1, 1)


def month_of(first_of_month: date) -> Month:
    return Month(first_of_month.strftime("%Y-%m"), first_of_month.strftime("%b"), first_of_month, add_months(first_of_month, 1))


def last_months(n: int, ref: date) -> list[Month]:
    """The `n` calendar months ending with the month of `ref`, oldest first."""
    current = ref.replace(day=1)
    return [month_of(add_months(current, -i)) for i in range(n - 1, -1, -1)]


def month_key(column):
    return func.date_format(column, "%Y-%m")


def company_clause(ctx: Ctx, model) -> ColumnElement[bool]:
    return model.company_id == ctx.company_id if ctx.company_id is not None else true()


def overdue_invoice_clause(ref: date) -> ColumnElement[bool]:
    """Overdue = still owed, past its due date. Computed on the fly, independent of the stored `overdue` status."""
    return and_(
        Invoice.status.in_(UNPAID_INVOICE_STATUSES),
        Invoice.due_date < ref,
        Invoice.total_amount - Invoice.paid_amount > 0,
    )


def task_filter(ctx: Ctx) -> ColumnElement[bool]:
    """Tasks the caller may count: admin all, employee their own, manager/client the tasks of visible projects."""
    company = company_clause(ctx, Task)
    if ctx.is_admin:
        return company
    if ctx.is_employee:
        return and_(company, Task.assigned_to == ctx.employee_id) if ctx.employee_id else false()
    return and_(company, Task.project_id.in_(visible_project_ids(ctx)))


def ticket_filter(ctx: Ctx) -> ColumnElement[bool]:
    """Tickets the caller may count. Manager: tickets of visible projects plus those assigned to them."""
    company = company_clause(ctx, Ticket)
    if ctx.is_admin:
        return company
    if ctx.is_client:
        return and_(company, Ticket.client_id == ctx.client_id) if ctx.client_id else false()
    if ctx.is_employee:
        return and_(company, or_(Ticket.assigned_to == ctx.user.id, Ticket.created_by == ctx.user.id))
    return and_(company, or_(Ticket.project_id.in_(visible_project_ids(ctx)), Ticket.assigned_to == ctx.user.id))


def invoice_filter(ctx: Ctx) -> ColumnElement[bool]:
    """Invoices the caller may see. Client: own, non-draft. Manager: those of visible projects. Employee: none."""
    company = company_clause(ctx, Invoice)
    if ctx.is_admin:
        return company
    if ctx.is_client:
        return and_(company, Invoice.client_id == ctx.client_id, Invoice.status != InvoiceStatus.DRAFT) if ctx.client_id else false()
    if ctx.is_manager:
        return and_(company, Invoice.project_id.in_(visible_project_ids(ctx)))
    return false()


def _count(db: Session, model, *where) -> int:
    return db.scalar(select(func.count()).select_from(model).where(*where)) or 0


def _group_counts(db: Session, model, column, where, members: type[Enum]) -> list[dict]:
    """Zero-filled [{key, name, value}] for every member of an enum column."""
    found = dict(db.execute(select(column, func.count()).select_from(model).where(where).group_by(column)).all())
    return [{"key": m.value, "name": label_of(m), "value": int(found.get(m, 0))} for m in members]


def task_rows(db: Session, ctx: Ctx, where, order: list, limit: int) -> list[dict]:
    stmt = (
        select(Task.id, Task.title, Task.project_id, Project.name.label("project_name"), Task.priority, Task.status, Task.due_date, User.name.label("assignee"))
        .join(Project, Project.id == Task.project_id)
        .outerjoin(Employee, Employee.id == Task.assigned_to)
        .outerjoin(User, User.id == Employee.user_id)
        .where(where)
        .order_by(*order)
        .limit(limit)
    )
    return [
        {
            "id": r.id, "title": r.title, "project_id": r.project_id, "project_name": r.project_name,
            "priority": r.priority.value, "status": r.status.value, "due_date": r.due_date,
            "assignee": None if ctx.is_client else r.assignee,  # clients never see internal staff names
        }
        for r in db.execute(stmt)
    ]


def _monthly_sums(db: Session, ctx: Ctx, months: list[Month]) -> dict[str, Decimal]:
    key = month_key(Payment.payment_date)
    stmt = (
        select(key, func.sum(Payment.amount))
        .where(company_clause(ctx, Payment), Payment.payment_date >= months[0].start, Payment.payment_date < months[-1].end)
        .group_by(key)
    )
    return {k: Decimal(v) for k, v in db.execute(stmt).all()}


# ---- overview ----------------------------------------------------------------------

def _outstanding_now(db: Session, ctx: Ctx) -> Decimal:
    stmt = select(func.coalesce(func.sum(Invoice.total_amount - Invoice.paid_amount), 0)).where(
        company_clause(ctx, Invoice), Invoice.status.in_(UNPAID_INVOICE_STATUSES)
    )
    return Decimal(db.scalar(stmt))


def _revenue_block(db: Session, ctx: Ctx, ref: date) -> dict:
    this_start = ref.replace(day=1)
    prev_start, next_start = add_months(this_start, -1), add_months(this_start, 1)
    current = case((and_(Payment.payment_date >= this_start, Payment.payment_date < next_start), Payment.amount), else_=0)
    previous = case((and_(Payment.payment_date >= prev_start, Payment.payment_date < this_start), Payment.amount), else_=0)
    cur, prev = db.execute(
        select(func.coalesce(func.sum(current), 0), func.coalesce(func.sum(previous), 0)).where(company_clause(ctx, Payment))
    ).one()
    cur, prev = Decimal(cur), Decimal(prev)
    return {"current": f2(cur), "previous": f2(prev), "percentage_change": pct_change(cur, prev)}


def _stock_series(db: Session, model, where, created_col, months: list[Month], still_counted=None) -> list[int]:
    """Number of rows that existed at each month end (and, optionally, were still 'open' then)."""
    columns = []
    for m in months:
        cond = created_col < dt(m.end)
        if still_counted is not None:
            cond = and_(cond, still_counted(m))
        columns.append(func.coalesce(func.sum(case((cond, 1), else_=0)), 0))
    row = db.execute(select(*columns).select_from(model).where(where)).one()
    return [int(v) for v in row]


def _outstanding_series(db: Session, ctx: Ctx, months: list[Month], live: Decimal) -> list[float]:
    """Month-end receivable = billed to date - collected to date; the last point is the live figure."""
    billable = Invoice.status.notin_(NON_BILLABLE_INVOICE_STATUSES)
    billed = db.execute(
        select(*[func.coalesce(func.sum(case((Invoice.issue_date < m.end, Invoice.total_amount), else_=0)), 0) for m in months]).where(company_clause(ctx, Invoice), billable)
    ).one()
    collected = db.execute(
        select(*[func.coalesce(func.sum(case((Payment.payment_date < m.end, Payment.amount), else_=0)), 0) for m in months])
        .select_from(Payment)
        .join(Invoice, Invoice.id == Payment.invoice_id)
        .where(company_clause(ctx, Payment), billable)
    ).one()
    series = [f2(Decimal(b) - Decimal(c)) for b, c in zip(billed, collected)]
    series[-1] = f2(live)
    return series


def _live_or(series: list[int], live: int) -> list[int]:
    series[-1] = live  # the newest point is always the live value, like the mock's `withLatest`
    return series


def _admin_overview(db: Session, ctx: Ctx, ref: date) -> dict:
    finance = ctx.is_admin
    months = last_months(6, ref)
    tasks_where, tickets_where = task_filter(ctx), ticket_filter(ctx)
    projects_where = and_(project_visibility(ctx), Project.status == ProjectStatus.ACTIVE)

    active_projects = _count(db, Project, projects_where)
    pending_tasks = _count(db, Task, tasks_where, Task.status != TaskStatus.COMPLETED)
    open_tickets = _count(db, Ticket, tickets_where, Ticket.status.in_(OPEN_TICKET_STATUSES))
    overdue_tasks = _count(db, Task, tasks_where, Task.status != TaskStatus.COMPLETED, Task.due_date < ref)

    task_open_at = lambda m: or_(Task.status != TaskStatus.COMPLETED, func.coalesce(Task.completed_at, Task.updated_at) >= dt(m.end))  # noqa: E731
    ticket_open_at = lambda m: or_(Ticket.status.in_(OPEN_TICKET_STATUSES), func.coalesce(Ticket.resolved_at, Ticket.updated_at) >= dt(m.end))  # noqa: E731
    sparklines = {
        "revenue": None, "outstanding": None, "clients": None,
        "projects": _live_or(_stock_series(db, Project, projects_where, Project.created_at, months), active_projects),
        "tasks": _live_or(_stock_series(db, Task, tasks_where, Task.created_at, months, task_open_at), pending_tasks),
        "tickets": _live_or(_stock_series(db, Ticket, tickets_where, Ticket.created_at, months, ticket_open_at), open_tickets),
    }
    data = {
        "view": "admin" if finance else "manager",
        "revenue": None, "outstanding": None, "active_clients": None, "overdue_invoices": None,
        "active_projects": active_projects, "pending_tasks": pending_tasks, "open_tickets": open_tickets,
        "overdue_tasks": overdue_tasks, "sparklines": sparklines,
    }
    if finance:
        outstanding = _outstanding_now(db, ctx)
        clients_where = and_(company_clause(ctx, Client), Client.status == ClientStatus.ACTIVE)
        active_clients = _count(db, Client, clients_where)
        paid = _monthly_sums(db, ctx, months)
        data.update(
            revenue=_revenue_block(db, ctx, ref),
            outstanding=f2(outstanding),
            active_clients=active_clients,
            overdue_invoices=_count(db, Invoice, company_clause(ctx, Invoice), overdue_invoice_clause(ref)),
        )
        sparklines["revenue"] = [f2(paid.get(m.key, 0)) for m in months]
        sparklines["outstanding"] = _outstanding_series(db, ctx, months, outstanding)
        sparklines["clients"] = _live_or(_stock_series(db, Client, clients_where, Client.created_at, months), active_clients)
    return data


def _employee_overview(db: Session, ctx: Ctx, ref: date) -> dict:
    tasks_where = task_filter(ctx)
    by_status = _group_counts(db, Task, Task.status, tasks_where, TaskStatus)
    total = sum(i["value"] for i in by_status)
    completed = next(i["value"] for i in by_status if i["key"] == TaskStatus.COMPLETED.value)
    overdue = _count(db, Task, tasks_where, Task.status != TaskStatus.COMPLETED, Task.due_date < ref)
    upcoming = task_rows(
        db, ctx, and_(tasks_where, Task.status != TaskStatus.COMPLETED, Task.due_date >= ref),
        [Task.due_date, Task.id], 5,
    )
    my_projects = _count(db, Project, project_visibility(ctx), Project.status.in_(OPEN_PROJECT_STATUSES))
    open_tickets = _count(db, Ticket, Ticket.company_id == ctx.company_id, Ticket.assigned_to == ctx.user.id, Ticket.status.in_(OPEN_TICKET_STATUSES))

    attendance = None
    approved = {"casual": 0.0, "sick": 0.0, "earned": 0.0}
    pending_leaves = 0
    if ctx.employee_id:
        record = db.scalars(select(AttendanceRecord).where(AttendanceRecord.employee_id == ctx.employee_id, AttendanceRecord.attendance_date == ref)).first()
        if record:
            attendance = {"status": record.status.value, "check_in": record.check_in, "check_out": record.check_out}
        year_start, year_end = date(ref.year, 1, 1), date(ref.year + 1, 1, 1)
        for leave_type, days in db.execute(
            select(LeaveRequest.leave_type, func.sum(LeaveRequest.days)).where(
                LeaveRequest.employee_id == ctx.employee_id, LeaveRequest.status == LeaveStatus.APPROVED,
                LeaveRequest.start_date >= year_start, LeaveRequest.start_date < year_end,
            ).group_by(LeaveRequest.leave_type)
        ):
            approved[leave_type.value] = float(days)
        pending_leaves = _count(db, LeaveRequest, LeaveRequest.employee_id == ctx.employee_id, LeaveRequest.status == LeaveStatus.PENDING)

    return {
        "view": "employee",
        "tasks": {"by_status": by_status, "total": total, "pending": total - completed, "overdue": overdue},
        "my_projects": my_projects,
        "upcoming_deadlines": upcoming,
        "open_tickets": open_tickets,
        "attendance_today": attendance,
        "leave": {"approved_days_this_year": approved, "pending_requests": pending_leaves},
    }


def _client_overview(db: Session, ctx: Ctx, ref: date) -> dict:
    invoices_where = invoice_filter(ctx)
    outstanding = db.scalar(
        select(func.coalesce(func.sum(Invoice.total_amount - Invoice.paid_amount), 0)).where(invoices_where, Invoice.status.in_(UNPAID_INVOICE_STATUSES))
    )
    meeting = None
    if ctx.client_id:
        row = db.execute(
            select(Meeting.id, Meeting.title, Meeting.meeting_date, Meeting.start_time, Meeting.meeting_type)
            .where(
                company_clause(ctx, Meeting), Meeting.client_id == ctx.client_id,
                Meeting.status == MeetingStatus.SCHEDULED, Meeting.meeting_date >= ref,
            )
            .order_by(Meeting.meeting_date, Meeting.start_time, Meeting.id)
            .limit(1)
        ).first()
        if row:
            meeting = {"id": row.id, "title": row.title, "meeting_date": row.meeting_date, "start_time": row.start_time, "meeting_type": row.meeting_type.value}
    invoices = db.execute(
        select(Invoice.id, Invoice.invoice_number, Invoice.issue_date, Invoice.due_date, Invoice.total_amount, Invoice.paid_amount, Invoice.status)
        .where(invoices_where).order_by(Invoice.issue_date.desc(), Invoice.id.desc()).limit(5)
    ).all()
    payments = db.execute(
        select(Payment.id, Payment.invoice_id, Payment.amount, Payment.payment_date, Payment.payment_method)
        .where(company_clause(ctx, Payment), Payment.client_id == ctx.client_id if ctx.client_id else false())
        .order_by(Payment.payment_date.desc(), Payment.id.desc()).limit(5)
    ).all()
    return {
        "view": "client",
        "active_projects": _count(db, Project, project_visibility(ctx), Project.status == ProjectStatus.ACTIVE),
        "outstanding_balance": f2(outstanding),
        "open_tickets": _count(db, Ticket, ticket_filter(ctx), Ticket.status.in_(OPEN_TICKET_STATUSES)),
        "next_meeting": meeting,
        "recent_invoices": [
            {"id": i.id, "invoice_number": i.invoice_number, "issue_date": i.issue_date, "due_date": i.due_date,
             "total_amount": f2(i.total_amount), "balance_amount": f2(i.total_amount - i.paid_amount), "status": i.status.value}
            for i in invoices
        ],
        "recent_payments": [
            {"id": p.id, "invoice_id": p.invoice_id, "amount": f2(p.amount), "payment_date": p.payment_date, "payment_method": p.payment_method.value}
            for p in payments
        ],
    }


def overview(db: Session, ctx: Ctx) -> dict:
    ref = today()
    if ctx.is_client:
        return _client_overview(db, ctx, ref)
    if ctx.is_employee:
        return _employee_overview(db, ctx, ref)
    return _admin_overview(db, ctx, ref)


# ---- detail widgets ----------------------------------------------------------------

def _require_admin(ctx: Ctx) -> None:
    if not ctx.is_admin:
        raise ForbiddenError()


def revenue_series(db: Session, ctx: Ctx, months_count: int) -> dict:
    _require_admin(ctx)
    months = last_months(months_count, today())
    paid = _monthly_sums(db, ctx, months)
    key = month_key(Invoice.issue_date)
    invoiced = {
        k: (Decimal(total), Decimal(owed))
        for k, total, owed in db.execute(
            select(key, func.sum(Invoice.total_amount), func.sum(Invoice.total_amount - Invoice.paid_amount))
            .where(
                company_clause(ctx, Invoice), Invoice.status.notin_(NON_BILLABLE_INVOICE_STATUSES),
                Invoice.issue_date >= months[0].start, Invoice.issue_date < months[-1].end,
            )
            .group_by(key)
        )
    }
    rows = []
    for m in months:
        billed, owed = invoiced.get(m.key, (Decimal(0), Decimal(0)))
        rows.append({"month": m.key, "label": m.label, "revenue": f2(paid.get(m.key, 0)), "invoiced": f2(billed), "outstanding": f2(owed)})
    totals = {name: f2(sum(Decimal(str(r[name])) for r in rows)) for name in ("revenue", "invoiced", "outstanding")}
    return {"months": rows, "totals": totals}


def projects_summary(db: Session, ctx: Ctx, limit: int) -> dict:
    where = project_visibility(ctx)
    by_status = _group_counts(db, Project, Project.status, where, ProjectStatus)
    stmt = (
        select(Project.id, Project.project_code, Project.name, Client.company_name, Project.status, Project.progress, Project.end_date)
        .outerjoin(Client, Client.id == Project.client_id)
        .where(where, Project.status.in_(OPEN_PROJECT_STATUSES))
        .order_by(Project.progress.desc(), Project.id)
        .limit(limit)
    )
    top = [
        {"id": r.id, "project_code": r.project_code, "name": r.name, "client_name": r.company_name, "status": r.status.value, "progress": r.progress, "end_date": r.end_date}
        for r in db.execute(stmt)
    ]
    return {"total": sum(i["value"] for i in by_status), "by_status": by_status, "top": top}


def tasks_summary(db: Session, ctx: Ctx, limit: int) -> dict:
    ref = today()
    where = task_filter(ctx)
    by_status = _group_counts(db, Task, Task.status, where, TaskStatus)
    by_priority = _group_counts(db, Task, Task.priority, where, Priority)
    open_ = Task.status != TaskStatus.COMPLETED
    due_week = task_rows(db, ctx, and_(where, open_, Task.due_date >= ref, Task.due_date <= ref + timedelta(days=6)), [Task.due_date, Task.id], limit)
    workload = []
    if ctx.is_admin or ctx.is_manager:
        stmt = (
            select(Employee.id, User.name, func.count(Task.id).label("n"))
            .select_from(Task)
            .join(Employee, Employee.id == Task.assigned_to)
            .join(User, User.id == Employee.user_id)
            .where(where, open_)
            .group_by(Employee.id, User.name)
            .order_by(func.count(Task.id).desc(), Employee.id)
            .limit(10)
        )
        workload = [{"employee_id": r.id, "name": r.name, "tasks": r.n} for r in db.execute(stmt)]
    return {
        "total": sum(i["value"] for i in by_status),
        "by_status": by_status,
        "by_priority": by_priority,
        "overdue": _count(db, Task, where, open_, Task.due_date < ref),
        "due_this_week": due_week,
        "workload": workload,
    }


def clients_summary(db: Session, ctx: Ctx, limit: int, months_count: int) -> dict:
    _require_admin(ctx)
    where = company_clause(ctx, Client)
    by_status = _group_counts(db, Client, Client.status, where, ClientStatus)
    revenue = func.sum(Payment.amount)
    top = [
        {"id": r.id, "company_name": r.company_name, "revenue": f2(r.revenue), "payments": r.n}
        for r in db.execute(
            select(Client.id, Client.company_name, revenue.label("revenue"), func.count(Payment.id).label("n"))
            .join(Payment, Payment.client_id == Client.id)
            .where(where)
            .group_by(Client.id, Client.company_name)
            .order_by(revenue.desc(), Client.id)
            .limit(limit)
        )
    ]
    months = last_months(months_count, today())
    key = month_key(Client.created_at)
    created = dict(
        db.execute(
            select(key, func.count()).where(where, Client.created_at >= dt(months[0].start), Client.created_at < dt(months[-1].end)).group_by(key)
        ).all()
    )
    return {
        "total": sum(i["value"] for i in by_status),
        "by_status": by_status,
        "top_by_revenue": top,
        "new_per_month": [{"month": m.key, "label": m.label, "clients": int(created.get(m.key, 0))} for m in months],
    }


def tickets_summary(db: Session, ctx: Ctx, months_count: int) -> dict:
    where = ticket_filter(ctx)
    by_status = _group_counts(db, Ticket, Ticket.status, where, TicketStatus)
    months = last_months(months_count, today())
    lo, hi = dt(months[0].start), dt(months[-1].end)
    opened_key, resolved_key = month_key(Ticket.created_at), month_key(Ticket.resolved_at)
    opened = dict(db.execute(select(opened_key, func.count()).where(where, Ticket.created_at >= lo, Ticket.created_at < hi).group_by(opened_key)).all())
    resolved = dict(db.execute(select(resolved_key, func.count()).where(where, Ticket.resolved_at >= lo, Ticket.resolved_at < hi).group_by(resolved_key)).all())
    avg_seconds = db.scalar(
        select(func.avg(func.timestampdiff(literal_column("SECOND"), Ticket.created_at, Ticket.resolved_at))).where(where, Ticket.resolved_at.is_not(None))
    )
    return {
        "total": sum(i["value"] for i in by_status),
        "open": sum(i["value"] for i in by_status if i["key"] in {s.value for s in OPEN_TICKET_STATUSES}),
        "by_status": by_status,
        "by_priority": _group_counts(db, Ticket, Ticket.priority, where, Priority),
        "trend": [{"month": m.key, "label": m.label, "opened": int(opened.get(m.key, 0)), "resolved": int(resolved.get(m.key, 0))} for m in months],
        "avg_resolution_hours": None if avg_seconds is None else round(float(avg_seconds) / 3600, 1),
    }


def activities(db: Session, ctx: Ctx, limit: int) -> list[dict]:
    if ctx.is_client:
        return []
    stmt = select(
        ActivityLog.id, ActivityLog.user_id, User.name.label("actor"), ActivityLog.action, ActivityLog.entity_type,
        ActivityLog.entity_id, ActivityLog.description, ActivityLog.created_at,
    ).outerjoin(User, User.id == ActivityLog.user_id)
    stmt = ctx.scope(stmt, ActivityLog)
    if ctx.is_employee:
        stmt = stmt.where(ActivityLog.user_id == ctx.user.id)
    stmt = stmt.order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc()).limit(limit)
    return [dict(r._mapping) for r in db.execute(stmt)]

