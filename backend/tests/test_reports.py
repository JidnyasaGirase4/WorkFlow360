"""Reports: exact numbers, filters, access matrix, CSV export, company isolation."""
import csv
import io
from datetime import datetime, timedelta

import pytest

from app.core.enums import InvoiceStatus, PaymentMethod, Priority, ProjectStatus, TaskStatus, TicketStatus
from app.models import Client, Department
from tests.conftest import auth
from tests.test_dashboard import (
    PREV_MONTH_DAY,
    THIS_MONTH,
    TODAY,
    by_key,
    mk_invoice,
    mk_payment,
    mk_project,
    mk_task,
    mk_ticket,
)

BASE = "/api/v1/reports"
ADMIN_ONLY = ["revenue", "invoices", "payments", "clients"]
MANAGER_OK = ["projects", "tasks", "tickets", "employees"]


def report(client, name, user, **params):
    return client.get(f"{BASE}/{name}", params=params, headers=auth(user))


def data(res):
    assert res.status_code == 200, res.text
    return res.json()["data"]


# ---- access matrix ------------------------------------------------------------------------

@pytest.mark.parametrize("name", ADMIN_ONLY + MANAGER_OK)
def test_access_matrix(client, world, name):
    assert client.get(f"{BASE}/{name}").status_code == 401
    assert report(client, name, world.a.admin).status_code == 200
    assert report(client, name, world.super_admin).status_code == 200
    assert report(client, name, world.a.employee).status_code == 403
    assert report(client, name, world.a.client_user).status_code == 403
    assert report(client, name, world.a.manager).status_code == (403 if name in ADMIN_ONLY else 200)


def test_envelope_and_pagination_shape(client, db, world):
    a = world.a
    for i in range(5):
        mk_project(db, a, name=f"P{i}")
    res = report(client, "projects", a.admin, page=2, limit=2).json()
    assert res["success"] is True and set(res["data"]) == {"summary", "rows", "chart"}
    assert (res["page"], res["limit"], res["total"], res["total_pages"]) == (2, 2, 5, 3)
    assert len(res["data"]["rows"]) == 2
    assert res["data"]["summary"]["total_projects"] == 5  # the summary covers all rows, not just the page
    assert report(client, "projects", a.admin, limit=101).status_code == 422


# ---- date validation --------------------------------------------------------------------------

@pytest.mark.parametrize("name", ADMIN_ONLY + MANAGER_OK)
def test_date_range_is_validated(client, world, name):
    bad = report(client, name, world.a.admin, start_date="2026-05-10", end_date="2026-05-01")
    assert bad.status_code == 422 and "end_date" in bad.json()["errors"]
    assert report(client, name, world.a.admin, start_date="not-a-date").status_code == 422
    assert report(client, name, world.a.admin, start_date="2026-05-10", end_date="2026-05-10").status_code == 200
    assert report(client, name, world.a.admin, format="xml").status_code == 422
    # permission is checked before the parameters
    assert report(client, name, world.a.employee, start_date="2026-05-10", end_date="2026-05-01").status_code == 403


# ---- revenue ----------------------------------------------------------------------------------------

def _second_client(db, tenant, name="Big Spender"):
    c = Client(company_id=tenant.company.id, company_name=name)
    db.add(c)
    db.commit()
    return c


def test_revenue_report(client, db, world):
    a = world.a
    c1, c2 = a.client_record, _second_client(db, a)
    p = mk_project(db, a, client=c1)
    inv1 = mk_invoice(db, a, c1, 1000, 600, InvoiceStatus.PARTIALLY_PAID, issue=THIS_MONTH, project=p)
    inv2 = mk_invoice(db, a, c2, 4000, 4000, InvoiceStatus.PAID, issue=PREV_MONTH_DAY)
    mk_invoice(db, a, c2, 700, 0, InvoiceStatus.DRAFT, issue=THIS_MONTH)  # ignored for billing figures
    mk_payment(db, inv1, 200, THIS_MONTH)
    mk_payment(db, inv1, 400, THIS_MONTH)
    mk_payment(db, inv2, 4000, PREV_MONTH_DAY)
    other = mk_invoice(db, world.b, world.b.client_record, 9999, 9999, InvoiceStatus.PAID)
    mk_payment(db, other, 9999, THIS_MONTH)

    d = data(report(client, "revenue", a.admin))
    assert d["summary"] == {
        "total_revenue": 4600.0, "payments_count": 3, "clients_billed": 2, "total_invoiced": 5000.0, "total_outstanding": 400.0,
    }
    assert [(r["client"], r["revenue"], r["payments"], r["share_percentage"]) for r in d["rows"]] == [
        ("Big Spender", 4000.0, 1, 87.0), (c1.company_name, 600.0, 2, 13.0),
    ]
    months = {c["month"]: c["value"] for c in d["chart"]}
    assert months[THIS_MONTH.strftime("%Y-%m")] == 600.0 and months[PREV_MONTH_DAY.strftime("%Y-%m")] == 4000.0

    only_client = data(report(client, "revenue", a.admin, client_id=c1.id))
    assert only_client["summary"]["total_revenue"] == 600.0 and len(only_client["rows"]) == 1
    only_project = data(report(client, "revenue", a.admin, project_id=p.id))
    assert only_project["summary"]["total_revenue"] == 600.0
    this_month_only = data(report(client, "revenue", a.admin, start_date=THIS_MONTH.isoformat(), end_date=TODAY.isoformat()))
    assert this_month_only["summary"]["total_revenue"] == 600.0
    assert [c["month"] for c in this_month_only["chart"]] == [THIS_MONTH.strftime("%Y-%m")]


def test_revenue_chart_fills_empty_months(client, db, world):
    a = world.a
    inv = mk_invoice(db, a, a.client_record, 100, 100, InvoiceStatus.PAID)
    mk_payment(db, inv, 100, TODAY)
    d = data(report(client, "revenue", a.admin, start_date=(THIS_MONTH - timedelta(days=70)).isoformat(), end_date=TODAY.isoformat()))
    assert len(d["chart"]) >= 3 and d["chart"][-1]["value"] == 100.0 and d["chart"][0]["value"] == 0.0


# ---- invoices / aging ---------------------------------------------------------------------------------

def test_invoice_report_status_totals_and_aging_buckets(client, db, world):
    a = world.a
    c = a.client_record
    mk_invoice(db, a, c, 100, 0, InvoiceStatus.SENT, due=TODAY + timedelta(days=5))  # current
    mk_invoice(db, a, c, 200, 50, InvoiceStatus.PARTIALLY_PAID, due=TODAY)  # due today -> current
    mk_invoice(db, a, c, 300, 0, InvoiceStatus.OVERDUE, due=TODAY - timedelta(days=1))  # 1-30
    mk_invoice(db, a, c, 400, 100, InvoiceStatus.SENT, due=TODAY - timedelta(days=30))  # 1-30 (edge)
    mk_invoice(db, a, c, 500, 0, InvoiceStatus.SENT, due=TODAY - timedelta(days=31))  # 31-60
    mk_invoice(db, a, c, 600, 0, InvoiceStatus.OVERDUE, due=TODAY - timedelta(days=60))  # 31-60 (edge)
    mk_invoice(db, a, c, 700, 0, InvoiceStatus.OVERDUE, due=TODAY - timedelta(days=61))  # 61-90
    mk_invoice(db, a, c, 800, 0, InvoiceStatus.OVERDUE, due=TODAY - timedelta(days=90))  # 61-90 (edge)
    oldest = mk_invoice(db, a, c, 900, 0, InvoiceStatus.OVERDUE, due=TODAY - timedelta(days=91))  # 90+
    paid = mk_invoice(db, a, c, 1000, 1000, InvoiceStatus.PAID, due=TODAY - timedelta(days=200))  # paid: not aged
    mk_invoice(db, a, c, 5000, 0, InvoiceStatus.DRAFT, due=TODAY - timedelta(days=200))  # draft: not aged
    mk_invoice(db, a, c, 6000, 0, InvoiceStatus.CANCELLED, due=TODAY - timedelta(days=200))
    mk_invoice(db, world.b, world.b.client_record, 7777, 0, InvoiceStatus.OVERDUE, due=TODAY - timedelta(days=500))

    d = data(report(client, "invoices", a.admin))
    s = d["summary"]
    aging = {b["key"]: (b["count"], b["amount"]) for b in s["aging"]}
    assert aging == {
        "current": (2, 250.0),  # 100 + (200-50)
        "days_1_30": (2, 600.0),  # 300 + (400-100)
        "days_31_60": (2, 1100.0),
        "days_61_90": (2, 1500.0),
        "days_90_plus": (1, 900.0),
    }
    assert [(p["label"], p["value"]) for p in d["chart"]][0] == ("Current", 250.0)
    assert s["total_invoices"] == 12 and d["summary"]["total_invoices"] == report(client, "invoices", a.admin).json()["total"]
    # billable = everything except draft/cancelled
    assert s["total_invoiced"] == 100 + 200 + 300 + 400 + 500 + 600 + 700 + 800 + 900 + 1000
    assert s["total_paid"] == 50 + 100 + 1000
    assert s["total_outstanding"] == 250 + 600 + 1100 + 1500 + 900
    assert s["overdue_amount"] == 600 + 1100 + 1500 + 900
    st = {i["key"]: i for i in s["by_status"]}
    assert st["draft"]["count"] == 1 and st["draft"]["total"] == 5000.0 and st["draft"]["outstanding"] == 0.0
    assert st["overdue"]["count"] == 5 and st["overdue"]["outstanding"] == 300 + 600 + 700 + 800 + 900
    assert st["paid"]["count"] == 1 and st["paid"]["outstanding"] == 0.0
    days = {r["invoice_number"]: r["days_overdue"] for r in d["rows"]}
    assert days[oldest.invoice_number] == 91
    assert days[paid.invoice_number] == 0  # nothing owed, so never overdue
    assert sorted(days.values()) == [0, 0, 0, 0, 0, 1, 30, 31, 60, 61, 90, 91]


def test_invoice_report_filters(client, db, world):
    a = world.a
    c1, c2 = a.client_record, _second_client(db, a)
    mk_invoice(db, a, c1, 100, 0, InvoiceStatus.SENT, issue=TODAY - timedelta(days=40))
    keep = mk_invoice(db, a, c2, 200, 0, InvoiceStatus.SENT, issue=TODAY - timedelta(days=2))
    d = data(report(client, "invoices", a.admin, start_date=(TODAY - timedelta(days=5)).isoformat()))
    assert [r["invoice_number"] for r in d["rows"]] == [keep.invoice_number]
    d = data(report(client, "invoices", a.admin, client_id=c1.id))
    assert d["summary"]["total_invoiced"] == 100.0
    assert data(report(client, "invoices", a.admin, end_date=(TODAY - timedelta(days=41)).isoformat()))["rows"] == []


# ---- payments ---------------------------------------------------------------------------------------------

def test_payment_report(client, db, world):
    a = world.a
    inv = mk_invoice(db, a, a.client_record, 1000, 600, InvoiceStatus.PARTIALLY_PAID)
    mk_payment(db, inv, 100, THIS_MONTH, PaymentMethod.CASH)
    mk_payment(db, inv, 200, THIS_MONTH, PaymentMethod.UPI)
    mk_payment(db, inv, 300, PREV_MONTH_DAY, PaymentMethod.UPI)
    other = mk_invoice(db, world.b, world.b.client_record, 50, 50, InvoiceStatus.PAID)
    mk_payment(db, other, 50)

    d = data(report(client, "payments", a.admin))
    s = d["summary"]
    assert s["total_amount"] == 600.0 and s["payments_count"] == 3 and s["average_payment"] == 200.0
    methods = {m["key"]: (m["count"], m["total"]) for m in s["by_method"]}
    assert methods["upi"] == (2, 500.0) and methods["cash"] == (1, 100.0) and methods["card"] == (0, 0.0)
    chart = {c["month"]: (c["value"], c["count"]) for c in d["chart"]}
    assert chart[THIS_MONTH.strftime("%Y-%m")] == (300.0, 2) and chart[PREV_MONTH_DAY.strftime("%Y-%m")] == (300.0, 1)
    assert len(d["rows"]) == 3 and d["rows"][0]["invoice_number"] == inv.invoice_number
    assert data(report(client, "payments", a.admin, start_date=THIS_MONTH.isoformat()))["summary"]["total_amount"] == 300.0


# ---- clients ------------------------------------------------------------------------------------------------

def test_client_report(client, db, world):
    a = world.a
    c1, c2 = a.client_record, _second_client(db, a, "Zed Corp")
    p1 = mk_project(db, a, client=c1)
    mk_project(db, a, client=c1)
    mk_invoice(db, a, c1, 1000, 400, InvoiceStatus.PARTIALLY_PAID, project=p1)
    mk_invoice(db, a, c1, 500, 500, InvoiceStatus.PAID)
    mk_invoice(db, a, c1, 900, 0, InvoiceStatus.DRAFT)
    mk_invoice(db, a, c1, 900, 0, InvoiceStatus.CANCELLED)
    d = data(report(client, "clients", a.admin))
    rows = {r["client"]: r for r in d["rows"]}
    assert (rows[c1.company_name]["billed"], rows[c1.company_name]["paid"], rows[c1.company_name]["outstanding"], rows[c1.company_name]["projects"]) == (1500.0, 900.0, 600.0, 2)
    assert (rows["Zed Corp"]["billed"], rows["Zed Corp"]["projects"]) == (0.0, 0)
    assert d["summary"] == {"total_clients": 2, "total_billed": 1500.0, "total_paid": 900.0, "total_outstanding": 600.0, "total_projects": 2}
    assert d["rows"][0]["client"] == c1.company_name  # biggest biller first
    assert data(report(client, "clients", a.admin, client_id=c2.id))["summary"]["total_clients"] == 1
    assert [r["client"] for r in data(report(client, "clients", a.admin, project_id=p1.id))["rows"]] == [c1.company_name]


# ---- projects -------------------------------------------------------------------------------------------------

def test_project_completion_report(client, db, world):
    a = world.a
    c = a.client_record
    full = mk_project(db, a, name="Full", client=c, manager=a.manager_emp, status=ProjectStatus.ACTIVE)
    third = mk_project(db, a, name="Third", client=c, status=ProjectStatus.ACTIVE, members=[a.employee_emp])
    empty = mk_project(db, a, name="Empty", status=ProjectStatus.PLANNING)
    mk_task(db, a, full, a.employee_emp, TaskStatus.COMPLETED)
    mk_task(db, a, full, a.employee_emp, TaskStatus.COMPLETED)
    mk_task(db, a, third, a.employee_emp, TaskStatus.COMPLETED)
    mk_task(db, a, third, a.employee_emp, TaskStatus.TODO, due=TODAY - timedelta(days=3))
    mk_task(db, a, third, a.employee_emp, TaskStatus.REVIEW)
    mk_project(db, world.b, name="Other company")

    d = data(report(client, "projects", a.admin))
    rows = {r["project"]: r for r in d["rows"]}
    assert rows["Full"]["completion_percentage"] == 100.0 and rows["Full"]["manager"] == a.manager.name and rows["Full"]["client"] == c.company_name
    assert (rows["Third"]["total_tasks"], rows["Third"]["completed_tasks"], rows["Third"]["completion_percentage"], rows["Third"]["overdue_tasks"]) == (3, 1, 33.3, 1)
    assert rows["Empty"]["completion_percentage"] == 0.0 and rows["Empty"]["total_tasks"] == 0
    s = d["summary"]
    assert s["total_projects"] == 3 and s["total_tasks"] == 5 and s["completed_tasks"] == 3 and s["overdue_tasks"] == 1
    assert s["avg_completion_percentage"] == 44.4  # (100 + 33.3 + 0) / 3
    assert by_key(s["by_status"]) == {"planning": 1, "active": 2, "on_hold": 0, "completed": 0, "cancelled": 0}
    assert data(report(client, "projects", a.admin, client_id=c.id))["summary"]["total_projects"] == 2
    assert [r["project"] for r in data(report(client, "projects", a.admin, project_id=empty.id))["rows"]] == ["Empty"]

    m = data(report(client, "projects", a.manager))  # manager: only projects they manage / belong to
    assert [r["project"] for r in m["rows"]] == ["Full"]
    assert data(report(client, "projects", a.admin, department_id=987654))["rows"] == []


def test_project_report_date_overlap(client, db, world):
    a = world.a
    mk_project(db, a, name="Old", start=TODAY - timedelta(days=100), end=TODAY - timedelta(days=50))
    mk_project(db, a, name="Current", start=TODAY - timedelta(days=10), end=TODAY + timedelta(days=10))
    mk_project(db, a, name="Open ended")
    names = lambda **kw: sorted(r["project"] for r in data(report(client, "projects", a.admin, **kw))["rows"])  # noqa: E731
    assert names(start_date=TODAY.isoformat(), end_date=TODAY.isoformat()) == ["Current", "Open ended"]
    assert names(start_date=(TODAY - timedelta(days=60)).isoformat(), end_date=(TODAY - timedelta(days=55)).isoformat()) == ["Old", "Open ended"]


# ---- tasks ----------------------------------------------------------------------------------------------------------

def test_task_report(client, db, world):
    a = world.a
    p = mk_project(db, a, manager=a.manager_emp)
    hidden = mk_project(db, a)
    mk_task(db, a, p, a.employee_emp, TaskStatus.TODO, Priority.HIGH, due=TODAY - timedelta(days=2), title="late")
    mk_task(db, a, p, a.employee_emp, TaskStatus.COMPLETED, Priority.LOW, due=TODAY - timedelta(days=9))
    mk_task(db, a, p, a.manager_emp, TaskStatus.IN_PROGRESS, Priority.HIGH, due=TODAY + timedelta(days=4))
    mk_task(db, a, p, None, TaskStatus.REVIEW, Priority.URGENT)
    mk_task(db, a, hidden, a.employee_emp, TaskStatus.TODO, Priority.MEDIUM, due=TODAY - timedelta(days=1))
    mk_task(db, world.b, mk_project(db, world.b), world.b.employee_emp, TaskStatus.TODO)

    d = data(report(client, "tasks", a.admin))
    s = d["summary"]
    assert s["total_tasks"] == 5 and s["overdue_tasks"] == 2
    assert by_key(s["by_status"]) == {"todo": 2, "in_progress": 1, "review": 1, "completed": 1}
    assert by_key(s["by_priority"]) == {"low": 1, "medium": 1, "high": 2, "urgent": 1}
    who = {x["name"]: (x["total"], x["completed"], x["overdue"]) for x in s["by_assignee"]}
    assert who == {a.employee.name: (3, 1, 2), a.manager.name: (1, 0, 0), "Unassigned": (1, 0, 0)}
    late = next(r for r in d["rows"] if r["title"] == "late")
    assert late["is_overdue"] is True and late["days_overdue"] == 2 and late["assignee"] == a.employee.name

    m = data(report(client, "tasks", a.manager))
    assert m["summary"]["total_tasks"] == 4 and m["summary"]["overdue_tasks"] == 1  # hidden project's tasks excluded
    assert data(report(client, "tasks", a.admin, project_id=hidden.id))["summary"]["total_tasks"] == 1
    assert data(report(client, "tasks", a.manager, project_id=hidden.id))["summary"]["total_tasks"] == 0
    assert data(report(client, "tasks", a.admin, start_date=TODAY.isoformat(), end_date=(TODAY + timedelta(days=10)).isoformat()))["summary"]["total_tasks"] == 1


def test_task_report_department_filter(client, db, world):
    a = world.a
    dept = Department(company_id=a.company.id, name="Engineering")
    db.add(dept)
    db.commit()
    a.employee_emp.department_id = dept.id
    db.commit()
    p = mk_project(db, a)
    mk_task(db, a, p, a.employee_emp)
    mk_task(db, a, p, a.manager_emp)
    d = data(report(client, "tasks", a.admin, department_id=dept.id))
    assert d["summary"]["total_tasks"] == 1 and d["rows"][0]["department"] == "Engineering"


# ---- tickets --------------------------------------------------------------------------------------------------------

def test_ticket_report(client, db, world):
    a = world.a
    c1, c2 = a.client_record, _second_client(db, a)
    now = datetime.utcnow()
    p = mk_project(db, a, manager=a.manager_emp)
    hidden = mk_project(db, a)
    mk_ticket(db, a, c1, TicketStatus.OPEN, Priority.HIGH, project=p, created_at=now)
    mk_ticket(db, a, c1, TicketStatus.RESOLVED, Priority.LOW, project=p, created_at=now - timedelta(hours=10), resolved_at=now - timedelta(hours=6))  # 4h
    mk_ticket(db, a, c2, TicketStatus.CLOSED, Priority.LOW, project=hidden, created_at=now - timedelta(hours=30), resolved_at=now - timedelta(hours=18))  # 12h
    mk_ticket(db, a, c2, TicketStatus.IN_PROGRESS, Priority.URGENT, created_at=now, assigned_user=a.employee)
    mk_ticket(db, world.b, world.b.client_record)

    d = data(report(client, "tickets", a.admin))
    s = d["summary"]
    assert s["total_tickets"] == 4 and s["open_tickets"] == 2 and s["avg_resolution_hours"] == 8.0
    assert by_key(s["by_status"]) == {"open": 1, "in_progress": 1, "waiting_for_client": 0, "resolved": 1, "closed": 1}
    assert by_key(s["by_priority"]) == {"low": 2, "medium": 0, "high": 1, "urgent": 1}
    assert {(c["client"], c["tickets"]) for c in s["by_client"]} == {(c1.company_name, 2), ("Big Spender", 2)}
    hours = sorted(r["resolution_hours"] for r in d["rows"] if r["resolution_hours"] is not None)
    assert hours == [4.0, 12.0]
    assert data(report(client, "tickets", a.admin, client_id=c1.id))["summary"]["total_tickets"] == 2
    assert data(report(client, "tickets", a.admin, project_id=hidden.id))["summary"]["total_tickets"] == 1
    assert data(report(client, "tickets", a.admin, start_date=(TODAY + timedelta(days=2)).isoformat()))["summary"]["total_tickets"] == 0
    assert data(report(client, "tickets", a.admin, end_date=(TODAY - timedelta(days=5)).isoformat()))["summary"]["total_tickets"] == 0

    m = data(report(client, "tickets", a.manager))
    assert m["summary"]["total_tickets"] == 2  # tickets of the visible project only (none assigned to the manager)


# ---- employees --------------------------------------------------------------------------------------------------------

def test_employee_report_and_no_salary(client, db, world):
    a = world.a
    a.employee_emp.salary = 123456
    db.commit()
    p1 = mk_project(db, a, manager=a.manager_emp, members=[a.employee_emp])
    p2 = mk_project(db, a, members=[a.employee_emp])
    now = datetime.utcnow()
    # employee: 4 tasks; 3 completed of which 2 had a due date and 1 of those was finished on time
    mk_task(db, a, p1, a.employee_emp, TaskStatus.COMPLETED, due=TODAY + timedelta(days=1), completed_at=now)  # on time
    mk_task(db, a, p1, a.employee_emp, TaskStatus.COMPLETED, due=TODAY - timedelta(days=3), completed_at=now)  # late
    mk_task(db, a, p2, a.employee_emp, TaskStatus.COMPLETED)  # no deadline: not judged
    mk_task(db, a, p2, a.employee_emp, TaskStatus.TODO)
    mk_task(db, a, p1, a.manager_emp, TaskStatus.TODO)

    d = data(report(client, "employees", a.admin))
    rows = {r["name"]: r for r in d["rows"]}
    e = rows[a.employee.name]
    assert (e["tasks_assigned"], e["tasks_completed"], e["on_time_percentage"], e["projects"]) == (4, 3, 50.0, 2)
    m = rows[a.manager.name]
    assert (m["tasks_assigned"], m["tasks_completed"], m["on_time_percentage"], m["projects"]) == (1, 0, None, 0)
    assert d["rows"][0]["name"] == a.employee.name  # most tasks first
    assert d["summary"]["total_employees"] == 2 and d["summary"]["tasks_assigned"] == 5 and d["summary"]["on_time_percentage"] == 50.0
    assert d["chart"][0] == {"label": a.employee.name, "value": 3, "assigned": 4}
    assert "salary" not in str(d).lower() and "123456" not in str(d)

    # manager: only members/managers of visible projects; tasks counted on visible projects only
    md = data(report(client, "employees", a.manager))
    mrows = {r["name"]: r for r in md["rows"]}
    assert set(mrows) == {a.employee.name, a.manager.name}
    assert mrows[a.employee.name]["tasks_assigned"] == 2 and mrows[a.employee.name]["projects"] == 1  # p2 is invisible to the manager
    assert data(report(client, "employees", a.admin, project_id=p2.id))["summary"]["total_employees"] == 1


def test_employee_report_department_and_isolation(client, db, world):
    a = world.a
    dept = Department(company_id=a.company.id, name="Design")
    db.add(dept)
    db.commit()
    a.employee_emp.department_id = dept.id
    db.commit()
    d = data(report(client, "employees", a.admin, department_id=dept.id))
    assert [r["name"] for r in d["rows"]] == [a.employee.name] and d["rows"][0]["department"] == "Design"
    # company B's staff never show up
    names = {r["name"] for r in data(report(client, "employees", a.admin))["rows"]}
    assert world.b.employee.name not in names and world.b.manager.name not in names
    sup = data(report(client, "employees", world.super_admin))
    assert sup["summary"]["total_employees"] == 4
    assert data(report(client, "employees", world.super_admin, company_id=world.b.company.id))["summary"]["total_employees"] == 2


# ---- CSV ----------------------------------------------------------------------------------------------------------------

def test_csv_export(client, db, world):
    a = world.a
    evil = Client(company_id=a.company.id, company_name="=HYPERLINK(\"http://x\")")
    db.add(evil)
    db.commit()
    for i in range(3):
        mk_invoice(db, a, a.client_record if i else evil, 100 + i, 0, InvoiceStatus.SENT)
    res = report(client, "invoices", a.admin, format="csv", limit=1)  # pagination is ignored for exports
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    assert "attachment" in res.headers["content-disposition"] and "invoices-report" in res.headers["content-disposition"]
    rows = list(csv.reader(io.StringIO(res.text)))
    assert rows[0] == ["invoice_id", "invoice_number", "client", "issue_date", "due_date", "total_amount", "paid_amount", "balance_amount", "status", "days_overdue"]
    assert len(rows) == 4
    clients_col = [r[2] for r in rows[1:]]
    assert "'=HYPERLINK(\"http://x\")" in clients_col  # formula neutralised
    assert {r[5] for r in rows[1:]} == {"100.00", "101.00", "102.00"}
    # JSON rows and CSV rows agree
    assert len(data(report(client, "invoices", a.admin, limit=100))["rows"]) == 3


def test_csv_empty_report_still_has_header_and_permissions_apply(client, world):
    res = report(client, "revenue", world.a.admin, format="csv")
    assert res.status_code == 200 and res.text.strip() == "client_id,client,revenue,share_percentage,payments"
    assert report(client, "revenue", world.a.manager, format="csv").status_code == 403


# ---- isolation --------------------------------------------------------------------------------------------------------------

def test_company_isolation_across_reports(client, db, world):
    a, b = world.a, world.b
    inv = mk_invoice(db, b, b.client_record, 500, 500, InvoiceStatus.PAID)
    mk_payment(db, inv, 500)
    pb = mk_project(db, b)
    mk_task(db, b, pb, b.employee_emp, due=TODAY - timedelta(days=1))
    mk_ticket(db, b, b.client_record)
    for name in ADMIN_ONLY + MANAGER_OK:
        d = data(report(client, name, a.admin))
        assert all(v in (0, 0.0, None, [], "") or isinstance(v, (list, dict)) for k, v in d["summary"].items() if k not in {"total_clients", "total_employees"}), (name, d["summary"])
        assert d["rows"] == [] or name in {"clients", "employees"}
    assert data(report(client, "revenue", b.admin))["summary"]["total_revenue"] == 500.0
    # a foreign project/client id filter yields nothing rather than another company's rows
    assert data(report(client, "tasks", a.admin, project_id=pb.id))["rows"] == []
    assert data(report(client, "revenue", a.admin, client_id=b.client_record.id))["rows"] == []
    assert data(report(client, "revenue", world.super_admin))["summary"]["total_revenue"] == 500.0
    # company_id is honoured only for the super admin; a company admin cannot switch tenants
    assert data(report(client, "revenue", a.admin, company_id=b.company.id))["summary"]["total_revenue"] == 0.0
