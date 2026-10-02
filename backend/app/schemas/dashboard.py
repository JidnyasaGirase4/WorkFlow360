"""Response shapes for the dashboards. Money is emitted as JSON numbers (2 dp) so charts can bind directly."""
from datetime import date, datetime, time
from typing import Annotated, Literal

from pydantic import Field

from app.schemas.common import ORMModel


class CountItem(ORMModel):
    key: str
    name: str
    value: int


class TaskBrief(ORMModel):
    id: int
    title: str
    project_id: int
    project_name: str
    priority: str
    status: str
    due_date: date | None
    assignee: str | None


class ProjectBrief(ORMModel):
    id: int
    project_code: str
    name: str
    client_name: str | None
    status: str
    progress: int
    end_date: date | None


# ---- overview ---------------------------------------------------------------

class RevenueBlock(ORMModel):
    current: float
    previous: float
    percentage_change: float | None


class Sparklines(ORMModel):
    revenue: list[float] | None
    outstanding: list[float] | None
    clients: list[int] | None
    projects: list[int]
    tasks: list[int]
    tickets: list[int]


class AdminOverview(ORMModel):
    """Company-wide numbers. Managers get the same shape with finance/client blocks set to null
    and every other number restricted to the projects they can see."""

    view: Literal["admin", "manager"]
    revenue: RevenueBlock | None
    outstanding: float | None
    active_clients: int | None
    active_projects: int
    pending_tasks: int
    open_tickets: int
    overdue_invoices: int | None
    overdue_tasks: int
    sparklines: Sparklines


class TaskCounts(ORMModel):
    by_status: list[CountItem]
    total: int
    pending: int
    overdue: int


class AttendanceToday(ORMModel):
    status: str
    check_in: str | None
    check_out: str | None


class LeaveSummary(ORMModel):
    approved_days_this_year: dict[str, float]
    pending_requests: int


class EmployeeOverview(ORMModel):
    view: Literal["employee"]
    tasks: TaskCounts
    my_projects: int
    upcoming_deadlines: list[TaskBrief]
    open_tickets: int
    attendance_today: AttendanceToday | None
    leave: LeaveSummary


class MeetingBrief(ORMModel):
    id: int
    title: str
    meeting_date: date
    start_time: time
    meeting_type: str


class InvoiceBrief(ORMModel):
    id: int
    invoice_number: str
    issue_date: date
    due_date: date
    total_amount: float
    balance_amount: float
    status: str


class PaymentBrief(ORMModel):
    id: int
    invoice_id: int
    amount: float
    payment_date: date
    payment_method: str


class ClientOverview(ORMModel):
    view: Literal["client"]
    active_projects: int
    outstanding_balance: float
    open_tickets: int
    next_meeting: MeetingBrief | None
    recent_invoices: list[InvoiceBrief]
    recent_payments: list[PaymentBrief]


Overview = Annotated[AdminOverview | EmployeeOverview | ClientOverview, Field(discriminator="view")]


# ---- detail widgets -----------------------------------------------------------

class MonthlyRevenue(ORMModel):
    month: str
    label: str
    revenue: float
    invoiced: float
    outstanding: float


class RevenueTotals(ORMModel):
    revenue: float
    invoiced: float
    outstanding: float


class RevenueOut(ORMModel):
    months: list[MonthlyRevenue]
    totals: RevenueTotals


class ProjectsOut(ORMModel):
    total: int
    by_status: list[CountItem]
    top: list[ProjectBrief]


class WorkloadItem(ORMModel):
    employee_id: int
    name: str
    tasks: int


class TasksOut(ORMModel):
    total: int
    by_status: list[CountItem]
    by_priority: list[CountItem]
    overdue: int
    due_this_week: list[TaskBrief]
    workload: list[WorkloadItem]


class TopClient(ORMModel):
    id: int
    company_name: str
    revenue: float
    payments: int


class NewClientsMonth(ORMModel):
    month: str
    label: str
    clients: int


class ClientsOut(ORMModel):
    total: int
    by_status: list[CountItem]
    top_by_revenue: list[TopClient]
    new_per_month: list[NewClientsMonth]


class TicketMonth(ORMModel):
    month: str
    label: str
    opened: int
    resolved: int


class TicketsOut(ORMModel):
    total: int
    open: int
    by_status: list[CountItem]
    by_priority: list[CountItem]
    trend: list[TicketMonth]
    avg_resolution_hours: float | None


class ActivityItem(ORMModel):
    id: int
    user_id: int | None
    actor: str | None
    action: str
    entity_type: str
    entity_id: int | None
    description: str | None
    created_at: datetime
