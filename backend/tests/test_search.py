"""Global search: validation, permission-aware categories, row-level rules per role, wildcard escaping, isolation."""
import pytest

from app.core.enums import InvoiceStatus, LeadStatus, ProjectStatus, TaskStatus, TicketStatus
from app.core.permissions import clear_permission_cache
from app.models import Client, Lead, Role
from tests.conftest import auth
from tests.test_dashboard import mk_invoice, mk_project, mk_task, mk_ticket

URL = "/api/v1/search"
ALL_CATEGORIES = {"clients", "leads", "projects", "employees", "tasks", "invoices", "tickets"}


def search(client, user, q, **params):
    return client.get(URL, params={"q": q, **params}, headers=auth(user))


def data(res):
    assert res.status_code == 200, res.text
    return res.json()["data"]


def titles(hits):
    return sorted(h["title"] for h in hits)


@pytest.fixture
def seeded(db, world):
    """Company A: a client, lead, three projects (manager-owned, employee-member, hidden), tasks, invoices, tickets."""
    a = world.a
    extra = Client(company_id=a.company.id, company_name="React Studio", contact_name="Rita")
    lead = Lead(company_id=a.company.id, company_name="React Lead Co", contact_name="Lena", status=LeadStatus.NEW)
    db.add_all([extra, lead])
    db.commit()
    mine = mk_project(db, a, name="React Dashboard", manager=a.manager_emp, members=[a.employee_emp])
    client_proj = mk_project(db, a, name="React Portal", client=a.client_record, status=ProjectStatus.ACTIVE)
    hidden = mk_project(db, a, name="React Hidden")
    t_emp = mk_task(db, a, mine, a.employee_emp, TaskStatus.TODO, title="Fix React bug")
    t_mgr = mk_task(db, a, mine, a.manager_emp, TaskStatus.TODO, title="React review")
    t_hidden = mk_task(db, a, hidden, a.manager_emp, TaskStatus.TODO, title="React secret task")
    inv_client = mk_invoice(db, a, a.client_record, 100, 0, InvoiceStatus.SENT, project=client_proj)
    inv_draft = mk_invoice(db, a, a.client_record, 100, 0, InvoiceStatus.DRAFT, project=client_proj)
    inv_extra = mk_invoice(db, a, extra, 100, 0, InvoiceStatus.SENT, project=hidden)
    inv_mine = mk_invoice(db, a, extra, 100, 0, InvoiceStatus.SENT, project=mine)
    tk_client = mk_ticket(db, a, a.client_record, subject="React widget broken")
    tk_other = mk_ticket(db, a, extra, subject="React question")
    tk_emp = mk_ticket(db, a, extra, subject="React assigned", assigned_user=a.employee)
    tk_mgr_proj = mk_ticket(db, a, extra, subject="React on mine", project=mine)
    return dict(extra=extra, lead=lead, mine=mine, client_proj=client_proj, hidden=hidden, t_emp=t_emp, t_mgr=t_mgr, t_hidden=t_hidden,
                inv_client=inv_client, inv_draft=inv_draft, inv_extra=inv_extra, inv_mine=inv_mine,
                tk_client=tk_client, tk_other=tk_other, tk_emp=tk_emp, tk_mgr_proj=tk_mgr_proj)


# ---- validation ------------------------------------------------------------------------------

def test_requires_auth_and_valid_query(client, world):
    assert client.get(URL, params={"q": "react"}).status_code == 401
    assert search(client, world.a.admin, "a").status_code == 422  # too short
    assert search(client, world.a.admin, "  a ").status_code == 422  # too short once trimmed
    assert client.get(URL, headers=auth(world.a.admin)).status_code == 422  # missing q
    assert search(client, world.a.admin, "react", limit=0).status_code == 422
    assert search(client, world.a.admin, "react", limit=21).status_code == 422
    assert search(client, world.a.admin, "x" * 101).status_code == 422
    assert search(client, world.a.admin, "zz").status_code == 200


# ---- shape & admin -----------------------------------------------------------------------------

def test_admin_sees_every_category(client, world, seeded):
    d = data(search(client, world.a.admin, "react"))
    assert d["query"] == "react"
    assert set(d) - {"query", "total_results"} == ALL_CATEGORIES
    assert titles(d["clients"]) == ["React Studio"]
    assert d["clients"][0] == {"id": seeded["extra"].id, "title": "React Studio", "subtitle": "Rita", "status": "active"}
    assert titles(d["leads"]) == ["React Lead Co"]
    assert titles(d["projects"]) == ["React Dashboard", "React Hidden", "React Portal"]
    assert titles(d["tasks"]) == ["Fix React bug", "React review", "React secret task"]
    assert titles(d["tickets"]) == ["React assigned", "React on mine", "React question", "React widget broken"]
    assert d["employees"] == []  # nobody is named "react": the category is present (permitted) but empty
    assert sorted(h["id"] for h in d["invoices"]) == sorted([seeded["inv_extra"].id, seeded["inv_mine"].id])  # matched via the client's name
    assert d["invoices"][0]["subtitle"] == "React Studio"
    assert d["total_results"] == 1 + 1 + 3 + 3 + 4 + 2


def test_search_matches_other_fields_and_is_case_insensitive(client, world, seeded):
    a = world.a
    inv = seeded["inv_client"]
    assert [h["id"] for h in data(search(client, a.admin, inv.invoice_number.lower()))["invoices"]] == [inv.id]
    hit = data(search(client, a.admin, a.employee.name.upper()))["employees"]
    assert [h["id"] for h in hit] == [a.employee_emp.id] and hit[0]["status"] == "active"
    assert set(hit[0]) == {"id", "title", "subtitle", "status"}  # no salary / contact columns
    proj = seeded["mine"]
    assert [h["id"] for h in data(search(client, a.admin, proj.project_code))["projects"]] == [proj.id]
    ticket = seeded["tk_client"]
    found = data(search(client, a.admin, ticket.ticket_number))["tickets"]
    assert [h["id"] for h in found] == [ticket.id] and found[0]["status"] == TicketStatus.OPEN.value


def test_limit_caps_each_category(client, db, world):
    a = world.a
    db.add_all([Client(company_id=a.company.id, company_name=f"Bulk {i}") for i in range(8)])
    db.commit()
    for i in range(8):
        mk_project(db, a, name=f"Bulk project {i}")
    d = data(search(client, a.admin, "bulk", limit=3))
    assert len(d["clients"]) == 3 and len(d["projects"]) == 3 and d["total_results"] == 6
    assert len(data(search(client, a.admin, "bulk"))["clients"]) == 5  # default limit
    assert len(data(search(client, a.admin, "bulk", limit=20))["clients"]) == 8


def test_wildcards_in_the_query_are_literal(client, db, world):
    a = world.a
    db.add_all([
        Client(company_id=a.company.id, company_name="Save 50%_off Ltd"),
        Client(company_id=a.company.id, company_name="Save 500 dollars"),
        Client(company_id=a.company.id, company_name="Under_score Inc"),
        Client(company_id=a.company.id, company_name="Underscore Inc"),
    ])
    db.commit()
    assert titles(data(search(client, a.admin, "%_"))["clients"]) == ["Save 50%_off Ltd"]
    assert titles(data(search(client, a.admin, "0%"))["clients"]) == ["Save 50%_off Ltd"]  # not "starts with 0"
    assert titles(data(search(client, a.admin, "r_s"))["clients"]) == ["Under_score Inc"]  # "_" is not "any character"
    assert data(search(client, a.admin, "%%"))["clients"] == []
    assert data(search(client, a.admin, "\\\\"))["clients"] == []
    # a lone wildcard character is below the minimum length and never becomes "match everything"
    assert search(client, a.admin, "%").status_code == 422


# ---- permission-aware categories ------------------------------------------------------------------

def test_categories_follow_role_permissions(client, world, seeded):
    a = world.a
    assert set(data(search(client, a.manager, "react"))) - {"query", "total_results"} == ALL_CATEGORIES
    assert set(data(search(client, a.employee, "react"))) - {"query", "total_results"} == {"employees", "projects", "tasks", "tickets"}
    assert set(data(search(client, a.client_user, "react"))) - {"query", "total_results"} == {"projects", "invoices", "tickets"}


def test_revoking_a_permission_removes_the_category(client, db, world, seeded):
    a = world.a
    role = db.query(Role).filter_by(name="manager").one()
    revoked = next(p for p in role.permissions if p.code == "view_leads")
    role.permissions.remove(revoked)
    db.commit()
    clear_permission_cache()
    try:
        d = data(search(client, a.manager, "react"))
        assert "leads" not in d and "clients" in d
        assert "leads" in data(search(client, a.admin, "react"))
    finally:
        role.permissions.append(revoked)
        db.commit()
        clear_permission_cache()


# ---- row-level rules -------------------------------------------------------------------------------

def test_employee_only_finds_own_projects_and_assigned_tasks(client, world, seeded):
    d = data(search(client, world.a.employee, "react"))
    assert titles(d["projects"]) == ["React Dashboard"]  # member of it; not the hidden or the client's project
    assert titles(d["tasks"]) == ["Fix React bug"]  # assigned to them; not a colleague's task
    assert titles(d["tickets"]) == ["React assigned"]
    assert "clients" not in d and "leads" not in d and "invoices" not in d
    colleagues = data(search(client, world.a.employee, world.a.manager.name))["employees"]
    assert [h["id"] for h in colleagues] == [world.a.manager_emp.id]  # directory is visible to employees


def test_manager_sees_visible_projects_and_their_tasks(client, world, seeded):
    a = world.a
    d = data(search(client, a.manager, "react"))
    assert titles(d["projects"]) == ["React Dashboard"]
    assert titles(d["tasks"]) == ["Fix React bug", "React review"]  # tasks of visible projects, whoever they are assigned to
    assert titles(d["tickets"]) == ["React on mine"]
    assert [h["id"] for h in d["invoices"]] == [seeded["inv_mine"].id]  # the "React Studio" invoice of the hidden project is not listed
    assert data(search(client, a.manager, seeded["inv_extra"].invoice_number))["invoices"] == []
    assert titles(d["clients"]) == ["React Studio"] and titles(d["leads"]) == ["React Lead Co"]


def test_client_only_finds_their_own_records(client, world, seeded):
    a = world.a
    d = data(search(client, a.client_user, "react"))
    assert titles(d["projects"]) == ["React Portal"]
    assert titles(d["tickets"]) == ["React widget broken"]
    sent = data(search(client, a.client_user, seeded["inv_client"].invoice_number))["invoices"]
    assert [h["id"] for h in sent] == [seeded["inv_client"].id]
    assert data(search(client, a.client_user, seeded["inv_draft"].invoice_number))["invoices"] == []  # drafts stay internal
    assert data(search(client, a.client_user, seeded["inv_extra"].invoice_number))["invoices"] == []  # another client's invoice
    assert not ({"clients", "leads", "employees", "tasks"} & set(d))


# ---- company isolation ------------------------------------------------------------------------------------------

def test_company_isolation_and_super_admin(client, db, world, seeded):
    a, b = world.a, world.b
    db.add(Client(company_id=b.company.id, company_name="React Beta"))
    db.add(Lead(company_id=b.company.id, company_name="React B Lead", contact_name="Bo"))
    db.commit()
    mk_project(db, b, name="React B project")
    pb = mk_project(db, b, name="React B second", members=[b.employee_emp])
    mk_task(db, b, pb, b.employee_emp, title="React B task")
    mk_ticket(db, b, b.client_record, subject="React B ticket")
    inv_b = mk_invoice(db, b, b.client_record, 10, 0, InvoiceStatus.SENT)

    d = data(search(client, a.admin, "react"))
    assert "React Beta" not in titles(d["clients"]) and not any("React B" in t for t in titles(d["projects"]) + titles(d["tasks"]) + titles(d["tickets"]) + titles(d["leads"]))
    assert data(search(client, a.admin, inv_b.invoice_number))["invoices"] == []
    assert data(search(client, a.admin, b.employee.name))["employees"] == []
    assert titles(data(search(client, b.admin, "react"))["clients"]) == ["React Beta"]

    sup = data(search(client, world.super_admin, "react"))
    assert titles(sup["clients"]) == ["React Beta", "React Studio"]
    assert len(sup["projects"]) == 5
    only_a = data(search(client, world.super_admin, "react", company_id=a.company.id))
    assert titles(only_a["clients"]) == ["React Studio"]
