"""Report builders. Each returns a `ReportResult` (summary + paginated rows + chart) computed with SQL aggregation.

Access: revenue / invoices / payments / clients are admin-only; projects / tasks / tickets / employees are open to
managers too, limited to the projects they can see. Salary is never selected by any query in this module.
"""
import csv
import io
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from enum import Enum

from sqlalchemy import Select, and_, case, exists, func, literal_column, or_, select
from sqlalchemy.orm import Session, aliased

from app.core.deps import Ctx
from app.core.enums import InvoiceStatus, PaymentMethod, Priority, ProjectStatus, TaskStatus, TicketStatus
from app.core.exceptions import ForbiddenError, UnprocessableError
from app.models.client import Client
from app.models.department import Department
from app.models.employee import Employee
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.project import Project, ProjectMember
from app.models.task import Task
from app.models.ticket import Ticket
from app.models.user import User
from app.services.access import project_visibility, visible_project_ids
from app.services.dashboard import (
    NON_BILLABLE_INVOICE_STATUSES,
    OPEN_TICKET_STATUSES,
    UNPAID_INVOICE_STATUSES,
    Month,
    add_months,
    company_clause,
    dt,
    f2,
    label_of,
    month_key,
    month_of,
    task_filter,
    ticket_filter,
    today,
)
from app.utils.pagination import PageParams

ADMIN_ONLY = {"revenue", "invoices", "payments", "clients"}
ADMIN_OR_MANAGER = {"projects", "tasks", "tickets", "employees"}
REPORT_NAMES = sorted(ADMIN_ONLY | ADMIN_OR_MANAGER)
MAX_EXPORT_ROWS = 50_000
MAX_CHART_MONTHS = 120


@dataclass
class Filters:
    start_date: date | None = None
    end_date: date | None = None
    project_id: int | None = None
    client_id: int | None = None
    department_id: int | None = None

    def validate(self) -> "Filters":
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise UnprocessableError("Validation failed", {"end_date": "end_date must be on or after start_date"})
        return self


@dataclass
class ReportResult:
    columns: list[str]
    rows: list[dict]
    total: int
    summary: dict = field(default_factory=dict)
    chart: list[dict] = field(default_factory=list)


# ---- helpers -------------------------------------------------------------------------

def _check_access(ctx: Ctx, name: str) -> None:
    if name in ADMIN_ONLY and not ctx.is_admin:
        raise ForbiddenError()
    if name in ADMIN_OR_MANAGER and not (ctx.is_admin or ctx.is_manager):
        raise ForbiddenError()


def _clean(value):
    if isinstance(value, Decimal):
        return f2(value)
    if isinstance(value, Enum):
        return value.value
    return value


def _fetch(db: Session, stmt: Select, page: PageParams | None) -> tuple[list, int]:
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    stmt = stmt.limit(page.limit).offset(page.offset) if page else stmt.limit(MAX_EXPORT_ROWS)
    return db.execute(stmt).all(), total


def _rows(columns: list[str], fetched: list, extra=None) -> list[dict]:
    out = []
    for r in fetched:
        row = {c: _clean(getattr(r, c)) for c in columns if hasattr(r, c)}
        if extra:
            row.update(extra(r))
        out.append({c: row.get(c) for c in columns})
    return out


def _date_bounds(column, f: Filters) -> list:
    conds = []
    if f.start_date:
        conds.append(column >= f.start_date)
    if f.end_date:
        conds.append(column <= f.end_date)
    return conds


def _datetime_bounds(column, f: Filters) -> list:
    conds = []
    if f.start_date:
        conds.append(column >= dt(f.start_date))
    if f.end_date:
        conds.append(column < dt(f.end_date + timedelta(days=1)))
    return conds


def _month_series(values: dict[str, Decimal], f: Filters, extra: dict[str, dict] | None = None) -> list[dict]:
    """Gap-free monthly points between the filter bounds (or the data's own first/last month)."""
    keys = sorted(values)
    first = f.start_date or (date.fromisoformat(f"{keys[0]}-01") if keys else None)
    last = f.end_date or (date.fromisoformat(f"{keys[-1]}-01") if keys else None)
    if first is None or last is None:
        return []
    current, points = first.replace(day=1), []
    while current <= last and len(points) < MAX_CHART_MONTHS:
        m: Month = month_of(current)
        point = {"month": m.key, "label": current.strftime("%b %Y"), "value": f2(values.get(m.key, 0))}
        for name, series in (extra or {}).items():
            point[name] = series.get(m.key, 0)
        points.append(point)
        current = add_months(current, 1)
    return points


def _enum_counts(found: dict, members: type[Enum]) -> list[dict]:
    return [{"key": m.value, "name": label_of(m), "value": int(found.get(m, 0))} for m in members]


def _num(value) -> int:
    return int(value or 0)


# ---- revenue ---------------------------------------------------------------------------

def _revenue(db: Session, ctx: Ctx, f: Filters, page: PageParams | None) -> ReportResult:
    pay_where = [company_clause(ctx, Payment), *_date_bounds(Payment.payment_date, f)]
    inv_where = [company_clause(ctx, Invoice), Invoice.status.notin_(NON_BILLABLE_INVOICE_STATUSES), *_date_bounds(Invoice.issue_date, f)]
    if f.client_id:
        pay_where.append(Payment.client_id == f.client_id)
        inv_where.append(Invoice.client_id == f.client_id)
    if f.project_id:
        pay_where.append(Invoice.project_id == f.project_id)
        inv_where.append(Invoice.project_id == f.project_id)
    payments = Payment.__table__.join(Invoice.__table__, Invoice.id == Payment.invoice_id)

    revenue = func.sum(Payment.amount)
    total, count, clients = db.execute(
        select(func.coalesce(revenue, 0), func.count(Payment.id), func.count(func.distinct(Payment.client_id))).select_from(payments).where(*pay_where)
    ).one()
    invoiced, outstanding = db.execute(
        select(func.coalesce(func.sum(Invoice.total_amount), 0), func.coalesce(func.sum(Invoice.total_amount - Invoice.paid_amount), 0)).where(*inv_where)
    ).one()

    stmt = (
        select(Client.id.label("client_id"), Client.company_name.label("client"), revenue.label("revenue"), func.count(Payment.id).label("payments"))
        .select_from(payments).join(Client, Client.id == Payment.client_id)
        .where(*pay_where).group_by(Client.id, Client.company_name).order_by(revenue.desc(), Client.id)
    )
    fetched, n_rows = _fetch(db, stmt, page)
    total_d = Decimal(total)
    columns = ["client_id", "client", "revenue", "share_percentage", "payments"]
    rows = _rows(columns, fetched, lambda r: {"share_percentage": float((Decimal(r.revenue) / total_d * 100).quantize(Decimal("0.1"))) if total_d else 0.0, "payments": int(r.payments)})

    key = month_key(Payment.payment_date)
    monthly = {k: Decimal(v) for k, v in db.execute(select(key, func.sum(Payment.amount)).select_from(payments).where(*pay_where).group_by(key)).all()}
    return ReportResult(
        columns, rows, n_rows,
        summary={
            "total_revenue": f2(total), "payments_count": int(count), "clients_billed": int(clients),
            "total_invoiced": f2(invoiced), "total_outstanding": f2(outstanding),
        },
        chart=_month_series(monthly, f),
    )


# ---- invoices --------------------------------------------------------------------------

AGING_BUCKETS = [("current", "Current"), ("days_1_30", "1-30 days"), ("days_31_60", "31-60 days"), ("days_61_90", "61-90 days"), ("days_90_plus", "90+ days")]


def _invoices(db: Session, ctx: Ctx, f: Filters, page: PageParams | None) -> ReportResult:
    ref = today()
    where = [company_clause(ctx, Invoice), *_date_bounds(Invoice.issue_date, f)]
    if f.client_id:
        where.append(Invoice.client_id == f.client_id)
    if f.project_id:
        where.append(Invoice.project_id == f.project_id)
    billable = Invoice.status.notin_(NON_BILLABLE_INVOICE_STATUSES)
    balance = Invoice.total_amount - Invoice.paid_amount
    days_late = func.datediff(ref, Invoice.due_date)
    unpaid = and_(Invoice.status.in_(UNPAID_INVOICE_STATUSES), balance > 0)

    stmt = (
        select(
            Invoice.id.label("invoice_id"), Invoice.invoice_number, Client.company_name.label("client"), Invoice.issue_date, Invoice.due_date,
            Invoice.total_amount, Invoice.paid_amount, balance.label("balance_amount"), Invoice.status,
            case((unpaid & (days_late > 0), days_late), else_=0).label("days_overdue"),
        )
        .join(Client, Client.id == Invoice.client_id).where(*where).order_by(Invoice.issue_date.desc(), Invoice.id.desc())
    )
    fetched, n_rows = _fetch(db, stmt, page)
    columns = ["invoice_id", "invoice_number", "client", "issue_date", "due_date", "total_amount", "paid_amount", "balance_amount", "status", "days_overdue"]
    rows = _rows(columns, fetched, lambda r: {"balance_amount": f2(r.balance_amount if r.status not in NON_BILLABLE_INVOICE_STATUSES else 0), "days_overdue": int(r.days_overdue)})

    invoiced, paid, outstanding, overdue_amount = db.execute(
        select(
            func.coalesce(func.sum(case((billable, Invoice.total_amount), else_=0)), 0),
            func.coalesce(func.sum(case((billable, Invoice.paid_amount), else_=0)), 0),
            func.coalesce(func.sum(case((billable, balance), else_=0)), 0),
            func.coalesce(func.sum(case((unpaid & (days_late > 0), balance), else_=0)), 0),
        ).where(*where)
    ).one()
    found = {
        s: (c, t, p) for s, c, t, p in db.execute(
            select(Invoice.status, func.count(), func.sum(Invoice.total_amount), func.sum(Invoice.paid_amount)).where(*where).group_by(Invoice.status)
        )
    }
    by_status = []
    for status in InvoiceStatus:
        c, t, p = found.get(status, (0, 0, 0))
        counts = status not in NON_BILLABLE_INVOICE_STATUSES
        by_status.append({
            "key": status.value, "name": label_of(status), "count": int(c), "total": f2(t), "paid": f2(p),
            "outstanding": f2(Decimal(t or 0) - Decimal(p or 0)) if counts else 0.0,
        })

    conditions = {
        "current": days_late <= 0, "days_1_30": days_late.between(1, 30), "days_31_60": days_late.between(31, 60),
        "days_61_90": days_late.between(61, 90), "days_90_plus": days_late > 90,
    }
    aging_row = db.execute(
        select(*[expr for key, _ in AGING_BUCKETS for expr in (
            func.coalesce(func.sum(case((and_(unpaid, conditions[key]), 1), else_=0)), 0),
            func.coalesce(func.sum(case((and_(unpaid, conditions[key]), balance), else_=0)), 0),
        )]).where(*where)
    ).one()
    aging = [
        {"key": key, "label": label, "count": int(aging_row[2 * i]), "amount": f2(aging_row[2 * i + 1])}
        for i, (key, label) in enumerate(AGING_BUCKETS)
    ]
    return ReportResult(
        columns, rows, n_rows,
        summary={
            "total_invoices": n_rows, "total_invoiced": f2(invoiced), "total_paid": f2(paid),
            "total_outstanding": f2(outstanding), "overdue_amount": f2(overdue_amount), "by_status": by_status, "aging": aging,
        },
        chart=[{"label": a["label"], "value": a["amount"], "count": a["count"]} for a in aging],
    )


# ---- payments --------------------------------------------------------------------------

def _payments(db: Session, ctx: Ctx, f: Filters, page: PageParams | None) -> ReportResult:
    where = [company_clause(ctx, Payment), *_date_bounds(Payment.payment_date, f)]
    if f.client_id:
        where.append(Payment.client_id == f.client_id)
    if f.project_id:
        where.append(Invoice.project_id == f.project_id)
    source = Payment.__table__.join(Invoice.__table__, Invoice.id == Payment.invoice_id).join(Client.__table__, Client.id == Payment.client_id)

    stmt = (
        select(
            Payment.id.label("payment_id"), Invoice.invoice_number, Client.company_name.label("client"), Payment.amount,
            Payment.payment_date, Payment.payment_method, Payment.reference_number,
        )
        .select_from(source).where(*where).order_by(Payment.payment_date.desc(), Payment.id.desc())
    )
    fetched, n_rows = _fetch(db, stmt, page)
    columns = ["payment_id", "invoice_number", "client", "amount", "payment_date", "payment_method", "reference_number"]
    rows = _rows(columns, fetched)

    total, count = db.execute(select(func.coalesce(func.sum(Payment.amount), 0), func.count()).select_from(source).where(*where)).one()
    found = {m: (c, t) for m, c, t in db.execute(select(Payment.payment_method, func.count(), func.sum(Payment.amount)).select_from(source).where(*where).group_by(Payment.payment_method))}
    by_method = [{"key": m.value, "name": label_of(m), "count": int(found.get(m, (0, 0))[0]), "total": f2(found.get(m, (0, 0))[1])} for m in PaymentMethod]
    key = month_key(Payment.payment_date)
    monthly = {k: (int(c), Decimal(t)) for k, c, t in db.execute(select(key, func.count(), func.sum(Payment.amount)).select_from(source).where(*where).group_by(key))}
    chart = _month_series({k: v[1] for k, v in monthly.items()}, f, {"count": {k: v[0] for k, v in monthly.items()}})
    return ReportResult(
        columns, rows, n_rows,
        summary={
            "total_amount": f2(total), "payments_count": int(count),
            "average_payment": f2(Decimal(total) / count) if count else 0.0, "by_method": by_method,
        },
        chart=chart,
    )


# ---- clients ---------------------------------------------------------------------------

def _clients(db: Session, ctx: Ctx, f: Filters, page: PageParams | None) -> ReportResult:
    billable = Invoice.status.notin_(NON_BILLABLE_INVOICE_STATUSES)
    inv_where = [company_clause(ctx, Invoice), billable, *_date_bounds(Invoice.issue_date, f)]
    prj_where = [company_clause(ctx, Project)]
    where = [company_clause(ctx, Client)]
    if f.project_id:
        inv_where.append(Invoice.project_id == f.project_id)
        prj_where.append(Project.id == f.project_id)
        where.append(Client.id.in_(select(Project.client_id).where(Project.id == f.project_id, company_clause(ctx, Project))))
    if f.client_id:
        where.append(Client.id == f.client_id)
    invoices = (
        select(Invoice.client_id.label("cid"), func.sum(Invoice.total_amount).label("billed"), func.sum(Invoice.paid_amount).label("paid"))
        .where(*inv_where).group_by(Invoice.client_id).subquery()
    )
    projects = select(Project.client_id.label("cid"), func.count().label("projects")).where(*prj_where).group_by(Project.client_id).subquery()
    billed, paid = func.coalesce(invoices.c.billed, 0), func.coalesce(invoices.c.paid, 0)
    stmt = (
        select(Client.id.label("client_id"), Client.company_name.label("client"), Client.status, billed.label("billed"), paid.label("paid"),
               (billed - paid).label("outstanding"), func.coalesce(projects.c.projects, 0).label("projects"))
        .outerjoin(invoices, invoices.c.cid == Client.id).outerjoin(projects, projects.c.cid == Client.id)
        .where(*where).order_by(billed.desc(), Client.id)
    )
    fetched, n_rows = _fetch(db, stmt, page)
    columns = ["client_id", "client", "status", "billed", "paid", "outstanding", "projects"]
    rows = _rows(columns, fetched, lambda r: {"projects": int(r.projects)})

    sub = stmt.order_by(None).subquery()
    t_billed, t_paid, t_out, t_projects = db.execute(
        select(func.coalesce(func.sum(sub.c.billed), 0), func.coalesce(func.sum(sub.c.paid), 0), func.coalesce(func.sum(sub.c.outstanding), 0), func.coalesce(func.sum(sub.c.projects), 0))
    ).one()
    chart = [
        {"label": r["client"], "value": r["billed"], "paid": r["paid"], "outstanding": r["outstanding"]}
        for r in _rows(columns, db.execute(stmt.limit(10)).all())
    ]
    return ReportResult(
        columns, rows, n_rows,
        summary={"total_clients": n_rows, "total_billed": f2(t_billed), "total_paid": f2(t_paid), "total_outstanding": f2(t_out), "total_projects": int(t_projects)},
        chart=chart,
    )


# ---- projects --------------------------------------------------------------------------

def _projects(db: Session, ctx: Ctx, f: Filters, page: PageParams | None) -> ReportResult:
    ref = today()
    done_case = case((Task.status == TaskStatus.COMPLETED, 1), else_=0)
    late_case = case((and_(Task.status != TaskStatus.COMPLETED, Task.due_date < ref), 1), else_=0)
    tasks = (
        select(Task.project_id.label("pid"), func.count().label("total"), func.sum(done_case).label("done"), func.sum(late_case).label("late"))
        .group_by(Task.project_id).subquery()
    )
    total_tasks, done = func.coalesce(tasks.c.total, 0), func.coalesce(tasks.c.done, 0)
    completion = case((total_tasks == 0, 0), else_=func.round(done * 100.0 / total_tasks, 1))
    manager_emp, manager_user = aliased(Employee), aliased(User)

    where = [project_visibility(ctx)]
    if f.project_id:
        where.append(Project.id == f.project_id)
    if f.client_id:
        where.append(Project.client_id == f.client_id)
    if f.department_id:
        where.append(exists().where(ProjectMember.project_id == Project.id, ProjectMember.employee_id == Employee.id, Employee.department_id == f.department_id))
    # a project is in the period when its [start, end] window overlaps it; missing dates are open-ended
    if f.end_date:
        where.append(or_(Project.start_date.is_(None), Project.start_date <= f.end_date))
    if f.start_date:
        where.append(or_(Project.end_date.is_(None), Project.end_date >= f.start_date))

    stmt = (
        select(
            Project.id.label("project_id"), Project.project_code, Project.name.label("project"), Client.company_name.label("client"),
            manager_user.name.label("manager"), Project.status, Project.progress, Project.start_date, Project.end_date,
            total_tasks.label("total_tasks"), done.label("completed_tasks"), func.coalesce(tasks.c.late, 0).label("overdue_tasks"),
            completion.label("completion_percentage"),
        )
        .select_from(Project)
        .outerjoin(Client, Client.id == Project.client_id)
        .outerjoin(manager_emp, manager_emp.id == Project.manager_id)
        .outerjoin(manager_user, manager_user.id == manager_emp.user_id)
        .outerjoin(tasks, tasks.c.pid == Project.id)
        .where(*where).order_by(Project.id.desc())
    )
    fetched, n_rows = _fetch(db, stmt, page)
    columns = ["project_id", "project_code", "project", "client", "manager", "status", "progress", "start_date", "end_date",
               "total_tasks", "completed_tasks", "overdue_tasks", "completion_percentage"]
    rows = _rows(columns, fetched, lambda r: {"total_tasks": int(r.total_tasks), "completed_tasks": int(r.completed_tasks), "overdue_tasks": int(r.overdue_tasks)})

    sub = stmt.order_by(None).subquery()
    grouped = {
        s: (n, comp, tt, ct, lt) for s, n, comp, tt, ct, lt in db.execute(
            select(sub.c.status, func.count(), func.sum(sub.c.completion_percentage), func.sum(sub.c.total_tasks), func.sum(sub.c.completed_tasks), func.sum(sub.c.overdue_tasks)).group_by(sub.c.status)
        )
    }
    by_status = _enum_counts({s: v[0] for s, v in grouped.items()}, ProjectStatus)
    total_completion = sum(Decimal(v[1] or 0) for v in grouped.values())
    return ReportResult(
        columns, rows, n_rows,
        summary={
            "total_projects": n_rows,
            "avg_completion_percentage": float((total_completion / n_rows).quantize(Decimal("0.1"))) if n_rows else 0.0,
            "total_tasks": sum(_num(v[2]) for v in grouped.values()),
            "completed_tasks": sum(_num(v[3]) for v in grouped.values()),
            "overdue_tasks": sum(_num(v[4]) for v in grouped.values()),
            "by_status": by_status,
        },
        chart=[{"label": i["name"], "key": i["key"], "value": i["value"]} for i in by_status],
    )


# ---- tasks -----------------------------------------------------------------------------

def _tasks(db: Session, ctx: Ctx, f: Filters, page: PageParams | None) -> ReportResult:
    ref = today()
    open_ = Task.status != TaskStatus.COMPLETED
    overdue = and_(open_, Task.due_date < ref)
    where = [task_filter(ctx), *_date_bounds(Task.due_date, f)]
    if f.project_id:
        where.append(Task.project_id == f.project_id)
    if f.client_id:
        where.append(Project.client_id == f.client_id)
    if f.department_id:
        where.append(Employee.department_id == f.department_id)

    stmt = (
        select(
            Task.id.label("task_id"), Task.title, Project.name.label("project"), User.name.label("assignee"), Department.name.label("department"),
            Task.priority, Task.status, Task.due_date, Task.assigned_to,
            case((overdue, 1), else_=0).label("is_overdue"), case((overdue, func.datediff(ref, Task.due_date)), else_=0).label("days_overdue"),
        )
        .select_from(Task).join(Project, Project.id == Task.project_id)
        .outerjoin(Employee, Employee.id == Task.assigned_to).outerjoin(User, User.id == Employee.user_id)
        .outerjoin(Department, Department.id == Employee.department_id)
        .where(*where).order_by(Task.due_date.is_(None), Task.due_date, Task.id)
    )
    fetched, n_rows = _fetch(db, stmt, page)
    columns = ["task_id", "title", "project", "assignee", "department", "priority", "status", "due_date", "is_overdue", "days_overdue"]
    rows = _rows(columns, fetched, lambda r: {"is_overdue": bool(r.is_overdue), "days_overdue": int(r.days_overdue)})

    sub = stmt.order_by(None).subquery()
    status_counts = dict(db.execute(select(sub.c.status, func.count()).group_by(sub.c.status)).all())
    priority_counts = dict(db.execute(select(sub.c.priority, func.count()).group_by(sub.c.priority)).all())
    overdue_total = db.scalar(select(func.coalesce(func.sum(sub.c.is_overdue), 0))) or 0
    completed_col = case((sub.c.status == TaskStatus.COMPLETED, 1), else_=0)
    by_assignee = [
        {"employee_id": r.assigned_to, "name": r.assignee or "Unassigned", "total": int(r.total), "completed": int(r.completed), "overdue": int(r.late)}
        for r in db.execute(
            select(sub.c.assigned_to, sub.c.assignee, func.count().label("total"), func.sum(completed_col).label("completed"), func.sum(sub.c.is_overdue).label("late"))
            .group_by(sub.c.assigned_to, sub.c.assignee).order_by(func.count().desc(), sub.c.assigned_to).limit(50)
        )
    ]
    by_status = _enum_counts(status_counts, TaskStatus)
    return ReportResult(
        columns, rows, n_rows,
        summary={
            "total_tasks": n_rows, "overdue_tasks": int(overdue_total), "by_status": by_status,
            "by_priority": _enum_counts(priority_counts, Priority), "by_assignee": by_assignee,
        },
        chart=[{"label": i["name"], "key": i["key"], "value": i["value"]} for i in by_status],
    )


# ---- tickets ---------------------------------------------------------------------------

def _tickets(db: Session, ctx: Ctx, f: Filters, page: PageParams | None) -> ReportResult:
    assignee = aliased(User)
    where = [ticket_filter(ctx), *_datetime_bounds(Ticket.created_at, f)]
    if f.project_id:
        where.append(Ticket.project_id == f.project_id)
    if f.client_id:
        where.append(Ticket.client_id == f.client_id)
    if f.department_id:
        where.append(Ticket.assigned_to.in_(select(Employee.user_id).where(Employee.department_id == f.department_id)))

    seconds = func.timestampdiff(literal_column("SECOND"), Ticket.created_at, Ticket.resolved_at)
    stmt = (
        select(
            Ticket.id.label("ticket_id"), Ticket.ticket_number, Ticket.subject, Client.company_name.label("client"), Project.name.label("project"),
            assignee.name.label("assignee"), Ticket.priority, Ticket.status, Ticket.created_at, Ticket.resolved_at, seconds.label("resolution_seconds"),
            Ticket.client_id,
        )
        .select_from(Ticket).join(Client, Client.id == Ticket.client_id)
        .outerjoin(Project, Project.id == Ticket.project_id).outerjoin(assignee, assignee.id == Ticket.assigned_to)
        .where(*where).order_by(Ticket.created_at.desc(), Ticket.id.desc())
    )
    fetched, n_rows = _fetch(db, stmt, page)
    columns = ["ticket_id", "ticket_number", "subject", "client", "project", "assignee", "priority", "status", "created_at", "resolved_at", "resolution_hours"]
    rows = _rows(columns, fetched, lambda r: {"resolution_hours": None if r.resolution_seconds is None else round(float(r.resolution_seconds) / 3600, 1)})

    sub = stmt.order_by(None).subquery()
    status_counts = dict(db.execute(select(sub.c.status, func.count()).group_by(sub.c.status)).all())
    priority_counts = dict(db.execute(select(sub.c.priority, func.count()).group_by(sub.c.priority)).all())
    avg_seconds = db.scalar(select(func.avg(sub.c.resolution_seconds)))
    by_client = [
        {"client_id": r.client_id, "client": r.client, "tickets": int(r.n)}
        for r in db.execute(select(sub.c.client_id, sub.c.client, func.count().label("n")).group_by(sub.c.client_id, sub.c.client).order_by(func.count().desc(), sub.c.client_id).limit(10))
    ]
    by_status = _enum_counts(status_counts, TicketStatus)
    return ReportResult(
        columns, rows, n_rows,
        summary={
            "total_tickets": n_rows, "open_tickets": sum(i["value"] for i in by_status if i["key"] in {s.value for s in OPEN_TICKET_STATUSES}),
            "avg_resolution_hours": None if avg_seconds is None else round(float(avg_seconds) / 3600, 1),
            "by_status": by_status, "by_priority": _enum_counts(priority_counts, Priority), "by_client": by_client,
        },
        chart=[{"label": i["name"], "key": i["key"], "value": i["value"]} for i in by_status],
    )


# ---- employees -------------------------------------------------------------------------

def _employees(db: Session, ctx: Ctx, f: Filters, page: PageParams | None) -> ReportResult:
    project_scope = [project_visibility(ctx)]
    if f.project_id:
        project_scope.append(Project.id == f.project_id)
    if f.client_id:
        project_scope.append(Project.client_id == f.client_id)

    task_where = [company_clause(ctx, Task), *_date_bounds(Task.due_date, f)]
    if not ctx.is_admin:  # a manager's numbers only cover work on projects they can see
        task_where.append(Task.project_id.in_(visible_project_ids(ctx)))
    if f.project_id:
        task_where.append(Task.project_id == f.project_id)
    if f.client_id:
        task_where.append(Task.project_id.in_(select(Project.id).where(Project.client_id == f.client_id)))

    done = Task.status == TaskStatus.COMPLETED
    with_due = and_(done, Task.due_date.is_not(None))
    finished_day = func.date(func.coalesce(Task.completed_at, Task.updated_at))
    tasks = (
        select(
            Task.assigned_to.label("eid"), func.count().label("assigned"),
            func.sum(case((done, 1), else_=0)).label("completed"),
            func.sum(case((with_due, 1), else_=0)).label("completed_with_due"),
            func.sum(case((and_(with_due, finished_day <= Task.due_date), 1), else_=0)).label("on_time"),
        )
        .where(*task_where, Task.assigned_to.is_not(None)).group_by(Task.assigned_to).subquery()
    )
    memberships = (
        select(ProjectMember.employee_id.label("eid"), func.count(func.distinct(ProjectMember.project_id)).label("projects"))
        .where(ProjectMember.project_id.in_(select(Project.id).where(*project_scope))).group_by(ProjectMember.employee_id).subquery()
    )

    where = [company_clause(ctx, Employee)]
    if not ctx.is_admin or f.project_id or f.client_id:
        in_scope = select(Project.id).where(*project_scope)
        where.append(or_(
            Employee.id.in_(select(ProjectMember.employee_id).where(ProjectMember.project_id.in_(in_scope))),
            Employee.id.in_(select(Project.manager_id).where(*project_scope, Project.manager_id.is_not(None))),
        ))
    if f.department_id:
        where.append(Employee.department_id == f.department_id)

    assigned, completed = func.coalesce(tasks.c.assigned, 0), func.coalesce(tasks.c.completed, 0)
    stmt = (
        select(
            Employee.id.label("employee_id"), Employee.employee_code, User.name.label("name"), Department.name.label("department"), Employee.designation,
            func.coalesce(memberships.c.projects, 0).label("projects"), assigned.label("tasks_assigned"), completed.label("tasks_completed"),
            func.coalesce(tasks.c.completed_with_due, 0).label("completed_with_due"), func.coalesce(tasks.c.on_time, 0).label("on_time"),
        )
        .select_from(Employee).join(User, User.id == Employee.user_id).outerjoin(Department, Department.id == Employee.department_id)
        .outerjoin(tasks, tasks.c.eid == Employee.id).outerjoin(memberships, memberships.c.eid == Employee.id)
        .where(*where).order_by(assigned.desc(), User.name, Employee.id)
    )
    fetched, n_rows = _fetch(db, stmt, page)
    columns = ["employee_id", "employee_code", "name", "department", "designation", "projects", "tasks_assigned", "tasks_completed", "on_time_percentage"]
    rows = _rows(columns, fetched, lambda r: {
        "projects": int(r.projects), "tasks_assigned": int(r.tasks_assigned), "tasks_completed": int(r.tasks_completed),
        "on_time_percentage": _on_time(r.on_time, r.completed_with_due),
    })

    sub = stmt.order_by(None).subquery()
    t_projects, t_assigned, t_completed, t_on_time, t_with_due = db.execute(
        select(*[func.coalesce(func.sum(c), 0) for c in (sub.c.projects, sub.c.tasks_assigned, sub.c.tasks_completed, sub.c.on_time, sub.c.completed_with_due)])
    ).one()
    top = db.execute(stmt.order_by(None).order_by(completed.desc(), User.name).limit(10)).all()
    return ReportResult(
        columns, rows, n_rows,
        summary={
            "total_employees": n_rows, "tasks_assigned": int(t_assigned), "tasks_completed": int(t_completed),
            "on_time_percentage": _on_time(t_on_time, t_with_due),
        },
        chart=[{"label": r.name, "value": int(r.tasks_completed), "assigned": int(r.tasks_assigned)} for r in top],
    )


def _on_time(on_time, completed_with_due) -> float | None:
    """Share of completed tasks (that had a deadline) finished on or before it; None when there is nothing to judge."""
    if not completed_with_due:
        return None
    return float((Decimal(on_time) / Decimal(completed_with_due) * 100).quantize(Decimal("0.1")))


BUILDERS = {
    "revenue": _revenue, "projects": _projects, "clients": _clients, "employees": _employees,
    "tasks": _tasks, "invoices": _invoices, "payments": _payments, "tickets": _tickets,
}


def run_report(db: Session, ctx: Ctx, name: str, filters: Filters, page: PageParams | None) -> ReportResult:
    """`page=None` returns every row (up to MAX_EXPORT_ROWS) for CSV export."""
    _check_access(ctx, name)
    return BUILDERS[name](db, ctx, filters.validate(), page)


# ---- CSV ------------------------------------------------------------------------------------

def _csv_cell(value) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float):
        return f"{value:.2f}"
    if hasattr(value, "isoformat"):
        return value.isoformat()
    text = str(value)
    # neutralise spreadsheet formula injection from user-controlled text (client names, subjects, ...)
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


def csv_lines(result: ReportResult) -> Iterator[str]:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(result.columns)
    yield buffer.getvalue()
    for row in result.rows:
        buffer.seek(0)
        buffer.truncate()
        writer.writerow([_csv_cell(row.get(c)) for c in result.columns])
        yield buffer.getvalue()
