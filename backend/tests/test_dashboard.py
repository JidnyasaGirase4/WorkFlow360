"""Dashboard endpoints. Data is built straight through the models (other modules' routers may not exist yet)."""
import itertools
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from app.core.enums import (
    AttendanceStatus,
    ClientStatus,
    InvoiceStatus,
    LeaveStatus,
    LeaveType,
    MeetingStatus,
    PaymentMethod,
    Priority,
    ProjectStatus,
    TaskStatus,
    TicketStatus,
)
from app.models import (
    ActivityLog,
    AttendanceRecord,
    Client,
    Invoice,
    LeaveRequest,
    Meeting,
    Payment,
    Project,
    ProjectMember,
    Task,
    Ticket,
)
from tests.conftest import auth

BASE = "/api/v1/dashboard"
TODAY = date.today()
THIS_MONTH = TODAY.replace(day=1)
PREV_MONTH_DAY = (THIS_MONTH - timedelta(days=1)).replace(day=15)  # mid last month
_n = itertools.count(1)


# ---- builders shared with test_reports / test_search --------------------------------

def mk_project(db, tenant, name=None, status=ProjectStatus.ACTIVE, client=None, manager=None, members=(), progress=0, start=None, end=None, created_at=None):
    n = next(_n)
    project = Project(
        company_id=tenant.company.id, client_id=client.id if client else None, name=name or f"Project {n}", project_code=f"PRJ-{n:05d}",
        manager_id=manager.id if manager else None, status=status, progress=progress, start_date=start, end_date=end,
    )
    if created_at:
        project.created_at = created_at
    db.add(project)
    db.flush()
    for member in members:
        db.add(ProjectMember(project_id=project.id, employee_id=member.id))
    db.commit()
    return project


def mk_task(db, tenant, project, assignee=None, status=TaskStatus.TODO, priority=Priority.MEDIUM, due=None, title=None, created_at=None, completed_at=None):
    task = Task(
        company_id=tenant.company.id, project_id=project.id, assigned_to=assignee.id if assignee else None,
        title=title or f"Task {next(_n)}", status=status, priority=priority, due_date=due, completed_at=completed_at,
    )
    if created_at:
        task.created_at = created_at
    db.add(task)
    db.commit()
    return task


def mk_invoice(db, tenant, client, total, paid=0, status=InvoiceStatus.SENT, issue=None, due=None, project=None):
    n = next(_n)
    invoice = Invoice(
        company_id=tenant.company.id, client_id=client.id, project_id=project.id if project else None, invoice_number=f"INV-{n:05d}",
        issue_date=issue or TODAY, due_date=due or TODAY + timedelta(days=30), total_amount=Decimal(total), paid_amount=Decimal(paid),
        balance_amount=Decimal(total) - Decimal(paid), status=status,
    )
    db.add(invoice)
    db.commit()
    return invoice


def mk_payment(db, invoice, amount, day=None, method=PaymentMethod.BANK_TRANSFER):
    payment = Payment(
        company_id=invoice.company_id, invoice_id=invoice.id, client_id=invoice.client_id, amount=Decimal(amount),
        payment_date=day or TODAY, payment_method=method,
    )
    db.add(payment)
    db.commit()
    return payment


def mk_ticket(db, tenant, client, status=TicketStatus.OPEN, priority=Priority.MEDIUM, project=None, assigned_user=None, created_at=None, resolved_at=None, subject=None):
    n = next(_n)
    ticket = Ticket(
        company_id=tenant.company.id, ticket_number=f"TCK-{n:04d}", client_id=client.id, project_id=project.id if project else None,
        subject=subject or f"Ticket {n}", description="d", priority=priority, status=status,
        assigned_to=assigned_user.id if assigned_user else None, resolved_at=resolved_at,
    )
    if created_at:
        ticket.created_at = created_at
    db.add(ticket)
    db.commit()
    return ticket


def get(client, path, user, **params):
    return client.get(f"{BASE}{path}", params=params, headers=auth(user))


def by_key(items):
    return {i["key"]: i["value"] for i in items}


# ---- admin overview -------------------------------------------------------------------

def seed_finance(db, tenant):
    """Invoices: sent+overdue 1000, partially paid 2000 (500 paid), paid 3000, draft 999, cancelled 500.
    Payments: 1000 + 500 this month, 1000 last month."""
    c = tenant.client_record
    past, future = TODAY - timedelta(days=10), TODAY + timedelta(days=10)
    sent_overdue = mk_invoice(db, tenant, c, 1000, 0, InvoiceStatus.SENT, issue=past - timedelta(days=20), due=past)
    partial = mk_invoice(db, tenant, c, 2000, 500, InvoiceStatus.PARTIALLY_PAID, due=future)
    paid = mk_invoice(db, tenant, c, 3000, 3000, InvoiceStatus.PAID, due=future)
    mk_invoice(db, tenant, c, 999, 0, InvoiceStatus.DRAFT, due=past)
    mk_invoice(db, tenant, c, 500, 0, InvoiceStatus.CANCELLED, due=past)
    mk_payment(db, paid, 1000, THIS_MONTH)
    mk_payment(db, partial, 500, THIS_MONTH)
    mk_payment(db, paid, 1000, PREV_MONTH_DAY)
    return sent_overdue, partial, paid


def test_admin_overview_exact_numbers(client, db, world):
    a = world.a
    seed_finance(db, a)
    db.add_all([Client(company_id=a.company.id, company_name="Second active"),
                Client(company_id=a.company.id, company_name="Gone", status=ClientStatus.INACTIVE)])
    db.commit()
    p1 = mk_project(db, a, status=ProjectStatus.ACTIVE, manager=a.manager_emp)
    mk_project(db, a, status=ProjectStatus.ACTIVE)
    mk_project(db, a, status=ProjectStatus.COMPLETED)
    mk_task(db, a, p1, a.employee_emp, TaskStatus.TODO, due=TODAY - timedelta(days=1))  # overdue
    mk_task(db, a, p1, a.employee_emp, TaskStatus.IN_PROGRESS, due=TODAY + timedelta(days=3))
    mk_task(db, a, p1, None, TaskStatus.REVIEW)
    mk_task(db, a, p1, a.employee_emp, TaskStatus.COMPLETED, due=TODAY - timedelta(days=5))  # completed: not overdue
    mk_ticket(db, a, a.client_record, TicketStatus.OPEN)
    mk_ticket(db, a, a.client_record, TicketStatus.WAITING_FOR_CLIENT)
    mk_ticket(db, a, a.client_record, TicketStatus.RESOLVED, resolved_at=datetime.utcnow())

    res = get(client, "/overview", a.admin)
    assert res.status_code == 200, res.text
    d = res.json()["data"]
    assert d["view"] == "admin"
    assert d["revenue"] == {"current": 1500.0, "previous": 1000.0, "percentage_change": 50.0}
    assert d["outstanding"] == 2500.0  # 1000 (sent) + 1500 (partially paid); draft/cancelled/paid excluded
    assert d["overdue_invoices"] == 1
    assert d["active_clients"] == 2  # client_record + "Second active"; the inactive one is excluded
    assert d["active_projects"] == 2
    assert d["pending_tasks"] == 3 and d["overdue_tasks"] == 1
    assert d["open_tickets"] == 2
    spark = d["sparklines"]
    assert all(len(spark[k]) == 6 for k in spark)
    assert spark["revenue"][-1] == 1500.0 and spark["revenue"][-2] == 1000.0 and spark["revenue"][0] == 0.0
    assert spark["outstanding"][-1] == 2500.0
    assert spark["clients"][-1] == 2 and spark["projects"][-1] == 2 and spark["tasks"][-1] == 3 and spark["tickets"][-1] == 2


def test_percentage_change_null_when_no_previous_revenue(client, db, world):
    a = world.a
    inv = mk_invoice(db, a, a.client_record, 100, 100, InvoiceStatus.PAID)
    mk_payment(db, inv, 100, THIS_MONTH)
    d = get(client, "/overview", a.admin).json()["data"]
    assert d["revenue"] == {"current": 100.0, "previous": 0.0, "percentage_change": None}


def test_empty_company_overview_is_all_zero(client, world):
    d = get(client, "/overview", world.a.admin).json()["data"]
    assert d["revenue"] == {"current": 0.0, "previous": 0.0, "percentage_change": None}
    assert d["outstanding"] == 0.0 and d["pending_tasks"] == 0 and d["sparklines"]["tickets"] == [0] * 6


def test_overdue_invoice_uses_due_date_and_balance_not_stored_status(client, db, world):
    a = world.a
    c = a.client_record
    mk_invoice(db, a, c, 100, 0, InvoiceStatus.OVERDUE, due=TODAY - timedelta(days=1))  # counts
    mk_invoice(db, a, c, 100, 0, InvoiceStatus.OVERDUE, due=TODAY)  # due today is not overdue yet
    mk_invoice(db, a, c, 100, 100, InvoiceStatus.SENT, due=TODAY - timedelta(days=9))  # nothing owed
    mk_invoice(db, a, c, 100, 0, InvoiceStatus.PAID, due=TODAY - timedelta(days=9))
    mk_invoice(db, a, c, 100, 0, InvoiceStatus.DRAFT, due=TODAY - timedelta(days=9))
    assert get(client, "/overview", a.admin).json()["data"]["overdue_invoices"] == 1


def test_manager_overview_is_restricted_to_visible_projects(client, db, world):
    a = world.a
    seed_finance(db, a)
    mine = mk_project(db, a, manager=a.manager_emp)
    member_of = mk_project(db, a, members=[a.manager_emp])
    hidden = mk_project(db, a, status=ProjectStatus.ACTIVE)
    for p in (mine, member_of, hidden):
        mk_task(db, a, p, a.employee_emp, TaskStatus.TODO, due=TODAY - timedelta(days=2))
    mk_ticket(db, a, a.client_record, project=mine)
    mk_ticket(db, a, a.client_record, project=hidden)
    mk_ticket(db, a, a.client_record)  # no project, not assigned to the manager

    d = get(client, "/overview", a.manager).json()["data"]
    assert d["view"] == "manager"
    assert d["revenue"] is None and d["outstanding"] is None and d["active_clients"] is None and d["overdue_invoices"] is None
    assert d["sparklines"]["revenue"] is None and d["sparklines"]["outstanding"] is None and d["sparklines"]["clients"] is None
    assert d["active_projects"] == 2
    assert d["pending_tasks"] == 2 and d["overdue_tasks"] == 2
    assert d["open_tickets"] == 1
    # a ticket assigned to the manager counts even without a visible project
    mk_ticket(db, a, a.client_record, assigned_user=a.manager)
    assert get(client, "/overview", a.manager).json()["data"]["open_tickets"] == 2


def test_employee_overview(client, db, world):
    a = world.a
    project = mk_project(db, a, members=[a.employee_emp])
    other = mk_project(db, a)
    mk_task(db, a, project, a.employee_emp, TaskStatus.TODO, due=TODAY + timedelta(days=2), title="Soon")
    mk_task(db, a, project, a.employee_emp, TaskStatus.IN_PROGRESS, due=TODAY + timedelta(days=9), title="Later")
    mk_task(db, a, project, a.employee_emp, TaskStatus.COMPLETED, due=TODAY + timedelta(days=1))
    mk_task(db, a, project, a.employee_emp, TaskStatus.REVIEW, due=TODAY - timedelta(days=3))  # overdue
    mk_task(db, a, project, a.manager_emp, TaskStatus.TODO)  # someone else's
    mk_task(db, a, other, a.manager_emp, TaskStatus.TODO)
    mk_ticket(db, a, a.client_record, TicketStatus.OPEN, assigned_user=a.employee)
    mk_ticket(db, a, a.client_record, TicketStatus.RESOLVED, assigned_user=a.employee)
    mk_ticket(db, a, a.client_record, TicketStatus.OPEN)
    db.add(AttendanceRecord(company_id=a.company.id, employee_id=a.employee_emp.id, attendance_date=TODAY, check_in="09:05", status=AttendanceStatus.LATE))
    db.add(LeaveRequest(company_id=a.company.id, employee_id=a.employee_emp.id, leave_type=LeaveType.CASUAL, start_date=date(TODAY.year, 1, 10), end_date=date(TODAY.year, 1, 11), days=Decimal("2"), status=LeaveStatus.APPROVED))
    db.add(LeaveRequest(company_id=a.company.id, employee_id=a.employee_emp.id, leave_type=LeaveType.SICK, start_date=date(TODAY.year, 2, 10), end_date=date(TODAY.year, 2, 10), days=Decimal("1"), status=LeaveStatus.PENDING))
    db.commit()

    d = get(client, "/overview", a.employee).json()["data"]
    assert d["view"] == "employee"
    assert by_key(d["tasks"]["by_status"]) == {"todo": 1, "in_progress": 1, "review": 1, "completed": 1}
    assert d["tasks"]["total"] == 4 and d["tasks"]["pending"] == 3 and d["tasks"]["overdue"] == 1
    assert d["my_projects"] == 1
    assert [t["title"] for t in d["upcoming_deadlines"]] == ["Soon", "Later"]
    assert d["open_tickets"] == 1
    assert d["attendance_today"] == {"status": "late", "check_in": "09:05", "check_out": None}
    assert d["leave"] == {"approved_days_this_year": {"casual": 2.0, "sick": 0.0, "earned": 0.0}, "pending_requests": 1}
    assert "revenue" not in d and "outstanding" not in d


def test_client_overview(client, db, world):
    a, b = world.a, world.b
    c = a.client_record
    project = mk_project(db, a, client=c, status=ProjectStatus.ACTIVE)
    mk_project(db, a, status=ProjectStatus.ACTIVE)  # other client's project
    mk_project(db, a, client=c, status=ProjectStatus.COMPLETED)
    inv = mk_invoice(db, a, c, 1000, 400, InvoiceStatus.PARTIALLY_PAID, project=project)
    mk_invoice(db, a, c, 300, 0, InvoiceStatus.DRAFT)
    mk_payment(db, inv, 400)
    mk_ticket(db, a, c, TicketStatus.OPEN)
    mk_ticket(db, a, c, TicketStatus.CLOSED)
    db.add(Meeting(company_id=a.company.id, title="Kickoff", client_id=c.id, meeting_date=TODAY + timedelta(days=2), start_time=time(10, 0), status=MeetingStatus.SCHEDULED))
    db.add(Meeting(company_id=a.company.id, title="Later", client_id=c.id, meeting_date=TODAY + timedelta(days=5), start_time=time(9, 0), status=MeetingStatus.SCHEDULED))
    db.add(Meeting(company_id=a.company.id, title="Past", client_id=c.id, meeting_date=TODAY - timedelta(days=1), start_time=time(9, 0), status=MeetingStatus.SCHEDULED))
    db.commit()
    # b's data must not leak
    mk_ticket(db, b, b.client_record)

    d = get(client, "/overview", a.client_user).json()["data"]
    assert d["view"] == "client"
    assert d["active_projects"] == 1
    assert d["outstanding_balance"] == 600.0
    assert d["open_tickets"] == 1
    assert d["next_meeting"]["title"] == "Kickoff"
    assert len(d["recent_invoices"]) == 1 and d["recent_invoices"][0]["balance_amount"] == 600.0  # draft hidden
    assert [p["amount"] for p in d["recent_payments"]] == [400.0]


# ---- detail endpoints -------------------------------------------------------------------

def test_revenue_series_and_permissions(client, db, world):
    a = world.a
    seed_finance(db, a)
    res = get(client, "/revenue", a.admin, months=3)
    assert res.status_code == 200
    months = res.json()["data"]["months"]
    assert len(months) == 3 and months[-1]["month"] == THIS_MONTH.strftime("%Y-%m") and months[-1]["label"] == THIS_MONTH.strftime("%b")
    assert months[-1]["revenue"] == 1500.0
    prev_key = PREV_MONTH_DAY.strftime("%Y-%m")
    prev = next(m for m in months if m["month"] == prev_key)
    assert prev["revenue"] == 1000.0
    # invoices issued this month: partial (2000, 1500 owed) and paid (3000) [the overdue one was issued 30 days ago]
    totals = res.json()["data"]["totals"]
    assert totals["revenue"] == 2500.0
    assert get(client, "/revenue", a.manager).status_code == 403
    assert get(client, "/revenue", a.employee).status_code == 403
    assert get(client, "/revenue", a.client_user).status_code == 403
    assert get(client, "/revenue", world.super_admin, company_id=a.company.id).json()["data"]["totals"]["revenue"] == 2500.0
    assert get(client, "/revenue", a.admin, months=0).status_code == 422
    assert get(client, "/revenue", a.admin, months=25).status_code == 422
    assert client.get(f"{BASE}/revenue").status_code == 401


def test_revenue_invoiced_and_outstanding_columns(client, db, world):
    a = world.a
    c = a.client_record
    mk_invoice(db, a, c, 1000, 250, InvoiceStatus.PARTIALLY_PAID, issue=THIS_MONTH)
    mk_invoice(db, a, c, 400, 0, InvoiceStatus.DRAFT, issue=THIS_MONTH)  # excluded
    mk_invoice(db, a, c, 600, 0, InvoiceStatus.SENT, issue=PREV_MONTH_DAY)
    months = get(client, "/revenue", a.admin, months=2).json()["data"]["months"]
    assert (months[1]["invoiced"], months[1]["outstanding"]) == (1000.0, 750.0)
    assert (months[0]["invoiced"], months[0]["outstanding"]) == (600.0, 600.0)


def test_projects_widget(client, db, world):
    a = world.a
    mk_project(db, a, name="A", status=ProjectStatus.ACTIVE, progress=80, manager=a.manager_emp)
    mk_project(db, a, name="B", status=ProjectStatus.PLANNING, progress=10, members=[a.employee_emp])
    mk_project(db, a, name="C", status=ProjectStatus.ACTIVE, progress=95)
    mk_project(db, a, name="D", status=ProjectStatus.COMPLETED, progress=100)
    mk_project(db, world.b, name="Other company", status=ProjectStatus.ACTIVE, progress=99)

    d = get(client, "/projects", a.admin, limit=2).json()["data"]
    assert d["total"] == 4
    assert by_key(d["by_status"]) == {"planning": 1, "active": 2, "on_hold": 0, "completed": 1, "cancelled": 0}
    assert [p["name"] for p in d["top"]] == ["C", "A"]  # open projects by progress; completed excluded
    assert d["top"][0]["progress"] == 95

    mgr = get(client, "/projects", a.manager).json()["data"]
    assert mgr["total"] == 1 and [p["name"] for p in mgr["top"]] == ["A"]
    emp = get(client, "/projects", a.employee).json()["data"]
    assert emp["total"] == 1 and [p["name"] for p in emp["top"]] == ["B"]


def test_tasks_widget(client, db, world):
    a = world.a
    p = mk_project(db, a, manager=a.manager_emp, members=[a.employee_emp])
    hidden = mk_project(db, a)
    mk_task(db, a, p, a.employee_emp, TaskStatus.TODO, Priority.HIGH, due=TODAY - timedelta(days=2))
    mk_task(db, a, p, a.employee_emp, TaskStatus.IN_PROGRESS, Priority.HIGH, due=TODAY + timedelta(days=6), title="edge")
    mk_task(db, a, p, a.manager_emp, TaskStatus.REVIEW, Priority.LOW, due=TODAY + timedelta(days=7))  # outside the 7-day window
    mk_task(db, a, p, a.employee_emp, TaskStatus.COMPLETED, Priority.URGENT, due=TODAY + timedelta(days=1))
    mk_task(db, a, hidden, a.manager_emp, TaskStatus.TODO, Priority.MEDIUM, due=TODAY)

    d = get(client, "/tasks", a.admin).json()["data"]
    assert d["total"] == 5 and d["overdue"] == 1
    assert by_key(d["by_status"]) == {"todo": 2, "in_progress": 1, "review": 1, "completed": 1}
    assert by_key(d["by_priority"]) == {"low": 1, "medium": 1, "high": 2, "urgent": 1}
    assert [t["title"] for t in d["due_this_week"]][-1] == "edge" and len(d["due_this_week"]) == 2  # today's + edge
    assert d["workload"][0]["tasks"] == 2  # employee: 2 pending; manager: 2 pending -> tie, both present
    assert {w["name"] for w in d["workload"]} == {a.employee.name, a.manager.name}

    m = get(client, "/tasks", a.manager).json()["data"]
    assert m["total"] == 4  # the hidden project's task is excluded
    e = get(client, "/tasks", a.employee).json()["data"]
    assert e["total"] == 3 and e["workload"] == []
    c = get(client, "/tasks", a.client_user).json()["data"]
    assert c["total"] == 0 and c["workload"] == []


def test_clients_widget(client, db, world):
    a = world.a
    c1 = a.client_record
    c2 = Client(company_id=a.company.id, company_name="Big Spender")
    c3 = Client(company_id=a.company.id, company_name="Prospect", status=ClientStatus.PROSPECT)
    db.add_all([c2, c3])
    db.commit()
    inv1 = mk_invoice(db, a, c1, 500, 500, InvoiceStatus.PAID)
    inv2 = mk_invoice(db, a, c2, 5000, 5000, InvoiceStatus.PAID)
    mk_payment(db, inv1, 500)
    mk_payment(db, inv2, 3000)
    mk_payment(db, inv2, 2000, PREV_MONTH_DAY)
    other = mk_invoice(db, world.b, world.b.client_record, 99999, 99999, InvoiceStatus.PAID)
    mk_payment(db, other, 99999)

    d = get(client, "/clients", a.admin, limit=1).json()["data"]
    assert d["total"] == 3
    assert by_key(d["by_status"]) == {"active": 2, "inactive": 0, "prospect": 1, "archived": 0}
    assert d["top_by_revenue"] == [{"id": c2.id, "company_name": "Big Spender", "revenue": 5000.0, "payments": 2}]
    assert len(d["new_per_month"]) == 6 and d["new_per_month"][-1]["clients"] == 3
    assert get(client, "/clients", a.manager).status_code == 403
    assert get(client, "/clients", a.employee).status_code == 403
    assert get(client, "/clients", a.client_user).status_code == 403


def test_tickets_widget(client, db, world):
    a = world.a
    c = a.client_record
    now = datetime.utcnow()
    mk_ticket(db, a, c, TicketStatus.OPEN, Priority.HIGH, created_at=now)
    mk_ticket(db, a, c, TicketStatus.RESOLVED, Priority.LOW, created_at=now - timedelta(hours=10), resolved_at=now - timedelta(hours=4))  # 6h
    mk_ticket(db, a, c, TicketStatus.CLOSED, Priority.LOW, created_at=now - timedelta(hours=20), resolved_at=now - timedelta(hours=10))  # 10h
    mk_ticket(db, world.b, world.b.client_record, TicketStatus.OPEN)

    d = get(client, "/tickets", a.admin).json()["data"]
    assert d["total"] == 3 and d["open"] == 1
    assert by_key(d["by_status"])["open"] == 1 and by_key(d["by_status"])["closed"] == 1
    assert by_key(d["by_priority"]) == {"low": 2, "medium": 0, "high": 1, "urgent": 0}
    assert d["avg_resolution_hours"] == 8.0
    assert len(d["trend"]) == 6
    assert sum(t["opened"] for t in d["trend"]) == 3 and sum(t["resolved"] for t in d["trend"]) == 2
    # a client sees only their own tickets
    assert get(client, "/tickets", a.client_user).json()["data"]["total"] == 3
    assert get(client, "/tickets", world.b.client_user).json()["data"]["total"] == 1
    assert get(client, "/tickets", a.employee).json()["data"]["total"] == 0


def test_activities_visibility(client, db, world):
    a, b = world.a, world.b
    db.add_all([
        ActivityLog(company_id=a.company.id, user_id=a.admin.id, action="created", entity_type="client", entity_id=1, description="admin did"),
        ActivityLog(company_id=a.company.id, user_id=a.employee.id, action="updated", entity_type="task", entity_id=2, description="employee did"),
        ActivityLog(company_id=a.company.id, user_id=a.manager.id, action="created", entity_type="project", entity_id=3, description="manager did"),
        ActivityLog(company_id=b.company.id, user_id=b.admin.id, action="created", entity_type="client", entity_id=9, description="other company"),
    ])
    db.commit()
    admin = get(client, "/activities", a.admin).json()["data"]
    assert [r["description"] for r in admin] == ["manager did", "employee did", "admin did"]  # newest first, company scoped
    assert admin[1]["actor"] == a.employee.name
    assert len(get(client, "/activities", a.manager).json()["data"]) == 3  # company-wide for managers too
    assert [r["description"] for r in get(client, "/activities", a.employee).json()["data"]] == ["employee did"]
    assert get(client, "/activities", a.client_user).json()["data"] == []
    assert len(get(client, "/activities", a.admin, limit=2).json()["data"]) == 2
    assert get(client, "/activities", a.admin, limit=0).status_code == 422
    assert len(get(client, "/activities", world.super_admin).json()["data"]) == 4
    assert len(get(client, "/activities", world.super_admin, company_id=b.company.id).json()["data"]) == 1


# ---- company isolation ---------------------------------------------------------------------

def test_company_b_data_never_leaks_into_a(client, db, world):
    a, b = world.a, world.b
    seed_finance(db, b)
    pb = mk_project(db, b)
    mk_task(db, b, pb, b.employee_emp, due=TODAY - timedelta(days=4))
    mk_ticket(db, b, b.client_record)
    d = get(client, "/overview", a.admin).json()["data"]
    assert d["revenue"]["current"] == 0.0 and d["outstanding"] == 0.0 and d["overdue_invoices"] == 0
    assert d["active_projects"] == 0 and d["pending_tasks"] == 0 and d["overdue_tasks"] == 0 and d["open_tickets"] == 0
    assert d["active_clients"] == 1  # only a's own client_record
    assert get(client, "/revenue", a.admin).json()["data"]["totals"]["revenue"] == 0.0
    # b sees its own; super admin without company_id sees everything, with company_id just that company
    assert get(client, "/overview", b.admin).json()["data"]["revenue"]["current"] == 1500.0
    assert get(client, "/overview", world.super_admin).json()["data"]["revenue"]["current"] == 1500.0
    assert get(client, "/overview", world.super_admin, company_id=a.company.id).json()["data"]["revenue"]["current"] == 0.0
    assert get(client, "/overview", world.super_admin).json()["data"]["active_projects"] == 1


def test_dashboard_requires_permission_and_auth(client, world):
    assert client.get(f"{BASE}/overview").status_code == 401
    for path in ("overview", "revenue", "projects", "tasks", "clients", "tickets", "activities"):
        assert client.get(f"{BASE}/{path}").status_code == 401
