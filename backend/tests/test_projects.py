from datetime import date, timedelta

from app.core.enums import RoleName
from app.models import ActivityLog, Document, Expense, Notification, Task
from tests.conftest import auth

BASE = "/api/v1/projects"
TASKS = "/api/v1/tasks"


def make_employee(factory, company, name="Extra Dev"):
    return factory.make_employee(factory.make_user(company, RoleName.EMPLOYEE, name=name), designation="Developer")


def create_project(client, headers, world, **over):
    body = {"name": "Website Redesign", "client_id": world.a.client_record.id, "manager_id": world.a.manager_emp.id, "budget": "50000.00", **over}
    res = client.post(BASE, json=body, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()["data"]


def create_task(client, headers, project_id, **over):
    res = client.post(TASKS, json={"project_id": project_id, "title": "A task", **over}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()["data"]


def set_status(client, headers, task_id, status):
    res = client.patch(f"{TASKS}/{task_id}/status", json={"status": status}, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()["data"]


# ---- CRUD, codes, validation ---------------------------------------------

def test_crud_and_code_generation(client, world):
    h = auth(world.a.admin)
    first = create_project(client, h, world)
    assert first["project_code"] == "PRJ-001" and first["status"] == "planning" and first["progress"] == 0
    assert first["client_name"] == world.a.client_record.company_name
    assert first["manager_name"] == world.a.manager.name
    # the manager is a member automatically
    assert [(m["employee_id"], m["name"], m["role"]) for m in first["members"]] == [(world.a.manager_emp.id, world.a.manager.name, "Project Manager")]
    assert first["task_count"] == 0 and first["spent"] == "0.00"

    second = create_project(client, h, world, name="Second")
    assert second["project_code"] == "PRJ-002"
    # company B has its own sequence and may reuse an explicit code
    b_first = client.post(BASE, json={"name": "B project"}, headers=auth(world.b.admin)).json()["data"]
    assert b_first["project_code"] == "PRJ-001"

    got = client.get(f"{BASE}/{first['id']}", headers=h).json()["data"]
    assert got["name"] == "Website Redesign"

    upd = client.put(f"{BASE}/{first['id']}", json={"status": "active", "description": "New scope"}, headers=h)
    assert upd.status_code == 200 and upd.json()["data"]["status"] == "active"

    assert client.delete(f"{BASE}/{second['id']}", headers=h).status_code == 200
    assert client.get(f"{BASE}/{second['id']}", headers=h).status_code == 404


def test_code_uniqueness_per_company(client, world):
    h = auth(world.a.admin)
    assert client.post(BASE, json={"name": "P1", "project_code": "ABC-1"}, headers=h).status_code == 201
    assert client.post(BASE, json={"name": "P2", "project_code": "ABC-1"}, headers=h).status_code == 409
    assert client.post(BASE, json={"name": "P3", "project_code": "ABC-1"}, headers=auth(world.b.admin)).status_code == 201
    other = client.post(BASE, json={"name": "P4"}, headers=h).json()["data"]
    assert client.put(f"{BASE}/{other['id']}", json={"project_code": "ABC-1"}, headers=h).status_code == 409
    assert client.put(f"{BASE}/{other['id']}", json={"project_code": "ABC-9"}, headers=h).status_code == 200


def test_validation(client, world):
    h = auth(world.a.admin)
    today = date.today()

    def post(**over):
        return client.post(BASE, json={"name": "V", **over}, headers=h).status_code

    assert post(start_date=str(today), end_date=str(today - timedelta(days=1))) == 422
    assert post(start_date=str(today), end_date=str(today)) == 201
    assert post(budget="-1") == 422
    assert post(progress=101) == 422
    assert post(progress=-1) == 422
    assert post(status="finished") == 422
    assert post(name="") == 422
    assert post(company_id=5) == 422  # unknown fields rejected

    project = client.post(BASE, json={"name": "W", "start_date": str(today)}, headers=h).json()["data"]
    assert client.put(f"{BASE}/{project['id']}", json={"end_date": str(today - timedelta(days=3))}, headers=h).status_code == 422
    assert client.put(f"{BASE}/{project['id']}", json={"name": None}, headers=h).status_code == 422
    assert client.put(f"{BASE}/{project['id']}", json={"progress": 150}, headers=h).status_code == 422


def test_cross_company_references_rejected(client, world, factory):
    h = auth(world.a.admin)
    b_employee = make_employee(factory, world.b.company)
    assert client.post(BASE, json={"name": "X", "client_id": world.b.client_record.id}, headers=h).status_code == 404
    assert client.post(BASE, json={"name": "X", "manager_id": world.b.manager_emp.id}, headers=h).status_code == 404
    assert client.post(BASE, json={"name": "X", "member_ids": [b_employee.id]}, headers=h).status_code == 404
    project = create_project(client, h, world)
    assert client.put(f"{BASE}/{project['id']}", json={"client_id": world.b.client_record.id}, headers=h).status_code == 404
    assert client.put(f"{BASE}/{project['id']}", json={"manager_id": b_employee.id}, headers=h).status_code == 404
    assert client.post(f"{BASE}/{project['id']}/members", json={"employee_id": b_employee.id}, headers=h).status_code == 404


def test_manager_creating_project_becomes_manager(client, world):
    project = client.post(BASE, json={"name": "Mine"}, headers=auth(world.a.manager)).json()["data"]
    assert project["manager_id"] == world.a.manager_emp.id
    assert [m["employee_id"] for m in project["members"]] == [world.a.manager_emp.id]
    assert client.get(f"{BASE}/{project['id']}", headers=auth(world.a.manager)).status_code == 200


def test_changing_manager_adds_them_to_the_team(client, world, db):
    h = auth(world.a.admin)
    project = create_project(client, h, world)
    upd = client.put(f"{BASE}/{project['id']}", json={"manager_id": world.a.employee_emp.id}, headers=h).json()["data"]
    assert {m["employee_id"] for m in upd["members"]} == {world.a.manager_emp.id, world.a.employee_emp.id}
    assert upd["manager_name"] == world.a.employee.name
    db.rollback()  # end the session's old snapshot to see what the API committed
    assert db.query(Notification).filter_by(user_id=world.a.employee.id, reference_id=project["id"]).count() == 1


def test_list_filters_search_sort_and_pagination(client, world):
    h = auth(world.a.admin)
    for i, st in enumerate(["active", "active", "planning"]):
        create_project(client, h, world, name=f"Alpha {i}", status=st)
    create_project(client, h, world, name="Beta", client_id=None)
    res = client.get(BASE, params={"search": "alpha", "status": "active"}, headers=h).json()
    assert res["total"] == 2
    res = client.get(BASE, params={"limit": 2, "page": 2, "sort_by": "name", "sort_order": "asc"}, headers=h).json()
    assert [p["name"] for p in res["data"]] == ["Alpha 2", "Beta"] and res["total"] == 4
    assert client.get(BASE, params={"client_id": world.a.client_record.id}, headers=h).json()["total"] == 3
    assert client.get(BASE, params={"sort_by": "password; drop"}, headers=h).status_code == 422


# ---- progress -------------------------------------------------------------

def test_progress_is_derived_from_tasks(client, world):
    h = auth(world.a.admin)
    project = create_project(client, h, world, progress=30)
    pid = project["id"]
    assert client.get(f"{BASE}/{pid}", headers=h).json()["data"]["progress"] == 30  # manual value while there are no tasks
    tasks = [create_task(client, h, pid, title=f"T{i}") for i in range(4)]
    assert client.get(f"{BASE}/{pid}", headers=h).json()["data"]["progress"] == 0

    set_status(client, h, tasks[0]["id"], "completed")
    got = client.get(f"{BASE}/{pid}", headers=h).json()["data"]
    assert got["progress"] == 25 and got["task_count"] == 4 and got["completed_task_count"] == 1
    set_status(client, h, tasks[1]["id"], "completed")
    assert client.get(f"{BASE}/{pid}", headers=h).json()["data"]["progress"] == 50

    # a manual value is ignored once tasks exist
    upd = client.put(f"{BASE}/{pid}", json={"progress": 99}, headers=h).json()["data"]
    assert upd["progress"] == 50

    set_status(client, h, tasks[1]["id"], "in_progress")
    assert client.get(f"{BASE}/{pid}", headers=h).json()["data"]["progress"] == 25
    assert client.delete(f"{TASKS}/{tasks[0]['id']}", headers=h).status_code == 200
    assert client.get(f"{BASE}/{pid}", headers=h).json()["data"]["progress"] == 0  # 0 of 3 left completed
    create_task(client, h, pid, title="Done already", status="completed")
    assert client.get(f"{BASE}/{pid}", headers=h).json()["data"]["progress"] == 25  # 1 of 4


# ---- members --------------------------------------------------------------

def test_members_add_duplicate_remove_and_manager_guard(client, world, db):
    h = auth(world.a.admin)
    project = create_project(client, h, world)
    url = f"{BASE}/{project['id']}/members"

    added = client.post(url, json={"employee_id": world.a.employee_emp.id, "role": "Developer"}, headers=h)
    assert added.status_code == 201
    assert added.json()["data"] == {"employee_id": world.a.employee_emp.id, "user_id": world.a.employee.id, "name": world.a.employee.name, "designation": None, "role": "Developer"}
    assert client.post(url, json={"employee_id": world.a.employee_emp.id}, headers=h).status_code == 409
    assert client.post(url, json={"employee_id": 999999}, headers=h).status_code == 404
    assert client.post(url, json={}, headers=h).status_code == 422
    assert len(client.get(url, headers=h).json()["data"]) == 2

    db.rollback()
    note = db.query(Notification).filter_by(user_id=world.a.employee.id, type="project", reference_id=project["id"]).one()
    assert "added" in note.title.lower()

    # the manager cannot be removed
    assert client.delete(f"{url}/{world.a.manager_emp.id}", headers=h).status_code == 409
    assert client.delete(f"{url}/{world.a.employee_emp.id}", headers=h).status_code == 200
    assert client.delete(f"{url}/{world.a.employee_emp.id}", headers=h).status_code == 404
    assert len(client.get(url, headers=h).json()["data"]) == 1


def test_members_permissions(client, world, factory):
    admin = auth(world.a.admin)
    project = create_project(client, admin, world)
    other_manager = factory.make_user(world.a.company, RoleName.MANAGER, name="Other Manager")
    other_emp = factory.make_employee(other_manager)
    url = f"{BASE}/{project['id']}/members"
    body = {"employee_id": world.a.employee_emp.id}

    assert client.post(url, json=body, headers=auth(world.a.employee)).status_code == 403
    assert client.post(url, json=body, headers=auth(world.a.client_user)).status_code == 403
    assert client.post(url, json=body, headers=auth(other_manager)).status_code == 404  # cannot even see the project
    assert client.post(url, json=body, headers=auth(world.a.manager)).status_code == 201  # manages it
    # a manager who is only a member (not the manager) may not change the team
    assert client.post(url, json={"employee_id": other_emp.id}, headers=admin).status_code == 201
    assert client.post(url, json={"employee_id": world.a.manager_emp.id}, headers=auth(other_manager)).status_code == 403
    assert client.post(url, json=body, headers=auth(world.b.admin)).status_code == 404


def test_removed_member_is_unassigned_from_tasks(client, world):
    h = auth(world.a.admin)
    project = create_project(client, h, world, member_ids=[world.a.employee_emp.id])
    task = create_task(client, h, project["id"], assigned_to=world.a.employee_emp.id)
    assert client.delete(f"{BASE}/{project['id']}/members/{world.a.employee_emp.id}", headers=h).status_code == 200
    assert client.get(f"{TASKS}/{task['id']}", headers=h).json()["data"]["assigned_to"] is None


# ---- milestones -----------------------------------------------------------

def test_milestones_crud_and_progress(client, world, db):
    h = auth(world.a.admin)
    project = create_project(client, h, world)
    url = f"{BASE}/{project['id']}/milestones"
    yesterday = str(date.today() - timedelta(days=1))

    created = client.post(url, json={"name": "Design signed off", "due_date": yesterday, "progress": 20}, headers=h)
    assert created.status_code == 201, created.text
    ms = created.json()["data"]
    assert ms["status"] == "pending" and ms["progress"] == 20 and ms["task_count"] == 0 and ms["is_overdue"] is True

    future = client.post(url, json={"name": "Launch", "due_date": str(date.today() + timedelta(days=30))}, headers=h).json()["data"]
    assert future["is_overdue"] is False
    listing = client.get(url, params={"sort_by": "name", "sort_order": "asc"}, headers=h).json()
    assert listing["total"] == 2 and [m["name"] for m in listing["data"]] == ["Design signed off", "Launch"]

    assert client.post(url, json={"name": "Bad", "progress": 101}, headers=h).status_code == 422
    assert client.post(url, json={"name": "Bad", "status": "done"}, headers=h).status_code == 422

    # progress follows the tasks once there are some
    t1 = create_task(client, h, project["id"], milestone_id=ms["id"])
    t2 = create_task(client, h, project["id"], milestone_id=ms["id"])
    got = client.get(f"/api/v1/milestones/{ms['id']}", headers=h).json()["data"]
    assert got["task_count"] == 2 and got["progress"] == 0
    set_status(client, h, t1["id"], "completed")
    got = client.get(f"/api/v1/milestones/{ms['id']}", headers=h).json()["data"]
    assert got["progress"] == 50 and got["completed_task_count"] == 1
    upd = client.put(f"/api/v1/milestones/{ms['id']}", json={"status": "in_progress", "progress": 90, "name": "Renamed"}, headers=h).json()["data"]
    assert upd["status"] == "in_progress" and upd["progress"] == 50 and upd["name"] == "Renamed"
    set_status(client, h, t1["id"], "completed")
    set_status(client, h, t2["id"], "completed")
    upd = client.put(f"/api/v1/milestones/{ms['id']}", json={"status": "completed"}, headers=h).json()["data"]
    assert upd["progress"] == 100 and upd["is_overdue"] is False  # completed milestones are never overdue

    # deleting the milestone keeps its tasks
    assert client.delete(f"/api/v1/milestones/{ms['id']}", headers=h).status_code == 200
    assert client.get(f"/api/v1/milestones/{ms['id']}", headers=h).status_code == 404
    assert client.get(f"{TASKS}/{t1['id']}", headers=h).json()["data"]["milestone_id"] is None
    db.rollback()
    assert db.query(Task).filter_by(project_id=project["id"]).count() == 2


def test_milestone_permissions_and_isolation(client, world):
    admin = auth(world.a.admin)
    project = create_project(client, admin, world, member_ids=[world.a.employee_emp.id])
    url = f"{BASE}/{project['id']}/milestones"
    ms = client.post(url, json={"name": "M"}, headers=admin).json()["data"]

    for user in (world.a.employee, world.a.client_user):
        assert client.post(url, json={"name": "X"}, headers=auth(user)).status_code == 403
        assert client.put(f"/api/v1/milestones/{ms['id']}", json={"name": "X"}, headers=auth(user)).status_code == 403
        assert client.delete(f"/api/v1/milestones/{ms['id']}", headers=auth(user)).status_code == 403
        assert client.get(url, headers=auth(user)).status_code == 200  # read-only access for members / the client
    assert client.post(url, json={"name": "By manager"}, headers=auth(world.a.manager)).status_code == 201

    b = auth(world.b.admin)
    assert client.get(url, headers=b).status_code == 404
    assert client.post(url, json={"name": "X"}, headers=b).status_code == 404
    assert client.get(f"/api/v1/milestones/{ms['id']}", headers=b).status_code == 404
    assert client.put(f"/api/v1/milestones/{ms['id']}", json={"name": "X"}, headers=b).status_code == 404
    assert client.delete(f"/api/v1/milestones/{ms['id']}", headers=b).status_code == 404


# ---- visibility -----------------------------------------------------------

def test_visibility_per_role(client, world, factory):
    admin = auth(world.a.admin)
    other_client = factory.make_client(world.a.company, "Other Client")
    managed = create_project(client, admin, world, name="Managed by manager")
    member_of = create_project(client, admin, world, name="Employee is member", manager_id=None, member_ids=[world.a.employee_emp.id])
    other = create_project(client, admin, world, name="Someone else's", client_id=other_client.id, manager_id=None)
    manager_member = create_project(client, admin, world, name="Manager only member", manager_id=None, member_ids=[world.a.manager_emp.id])

    def ids(user):
        return {p["id"] for p in client.get(BASE, headers=auth(user)).json()["data"]}

    assert ids(world.a.admin) == {managed["id"], member_of["id"], other["id"], manager_member["id"]}
    assert ids(world.a.manager) == {managed["id"], manager_member["id"]}
    assert ids(world.a.employee) == {member_of["id"]}
    assert ids(world.a.client_user) == {managed["id"], member_of["id"], manager_member["id"]}  # all belong to the client of company A
    assert ids(world.b.admin) == set()

    assert client.get(f"{BASE}/{other['id']}", headers=auth(world.a.manager)).status_code == 404
    assert client.get(f"{BASE}/{managed['id']}", headers=auth(world.a.employee)).status_code == 404
    assert client.get(f"{BASE}/{other['id']}", headers=auth(world.a.client_user)).status_code == 404
    assert client.get(f"{BASE}/{member_of['id']}", headers=auth(world.a.employee)).status_code == 200
    assert client.get(f"{BASE}/{managed['id']}", headers=auth(world.b.admin)).status_code == 404
    assert client.get(BASE).status_code == 401


def test_write_permissions(client, world):
    admin = auth(world.a.admin)
    project = create_project(client, admin, world, member_ids=[world.a.employee_emp.id])
    url = f"{BASE}/{project['id']}"
    for user in (world.a.employee, world.a.client_user):
        assert client.post(BASE, json={"name": "X"}, headers=auth(user)).status_code == 403
        assert client.put(url, json={"name": "X"}, headers=auth(user)).status_code == 403
        assert client.delete(url, headers=auth(user)).status_code == 403
    assert client.delete(url, headers=auth(world.a.manager)).status_code == 403  # only admins delete
    assert client.put(url, json={"name": "Renamed"}, headers=auth(world.a.manager)).status_code == 200


def test_budget_and_spent_hidden_from_client(client, world, db):
    admin = auth(world.a.admin)
    project = create_project(client, admin, world, budget="120000.50")
    db.add(Expense(company_id=world.a.company.id, title="Hosting", amount="1500.25", expense_date=date.today(), project_id=project["id"]))
    db.add(Expense(company_id=world.a.company.id, title="Licences", amount="500.00", expense_date=date.today(), project_id=project["id"]))
    db.commit()

    internal = client.get(f"{BASE}/{project['id']}", headers=admin).json()["data"]
    assert internal["budget"] == "120000.50" and internal["spent"] == "2000.25"

    c = auth(world.a.client_user)
    for data in (client.get(f"{BASE}/{project['id']}", headers=c).json()["data"], client.get(BASE, headers=c).json()["data"][0]):
        assert data["budget"] is None and data["spent"] is None and data["name"] == "Website Redesign"
    assert client.get(BASE, params={"sort_by": "budget"}, headers=c).status_code == 422
    assert client.get(f"{BASE}/{project['id']}", headers=auth(world.a.manager)).json()["data"]["spent"] == "2000.25"


# ---- delete guard ---------------------------------------------------------

def test_delete_blocked_by_related_records(client, world, db):
    h = auth(world.a.admin)
    with_expense = create_project(client, h, world, name="Has expense")
    with_document = create_project(client, h, world, name="Has document")
    clean = create_project(client, h, world, name="Clean")
    db.add(Expense(company_id=world.a.company.id, title="X", amount="10.00", expense_date=date.today(), project_id=with_expense["id"]))
    db.add(Document(company_id=world.a.company.id, name="Spec", file_name="spec.pdf", file_path="x/spec.pdf", file_type="application/pdf", file_size=10, project_id=with_document["id"]))
    db.commit()

    for project in (with_expense, with_document):
        res = client.delete(f"{BASE}/{project['id']}", headers=h)
        assert res.status_code == 409 and "cancelled" in res.json()["message"]
        assert client.get(f"{BASE}/{project['id']}", headers=h).status_code == 200
    assert client.put(f"{BASE}/{with_expense['id']}", json={"status": "cancelled"}, headers=h).status_code == 200

    # tasks / milestones / members go with the project
    client.post(f"{BASE}/{clean['id']}/milestones", json={"name": "M"}, headers=h)
    create_task(client, h, clean["id"])
    assert client.delete(f"{BASE}/{clean['id']}", headers=h).status_code == 200
    db.rollback()
    assert db.query(Task).filter_by(project_id=clean["id"]).count() == 0
    assert client.delete(f"{BASE}/{clean['id']}", headers=auth(world.b.admin)).status_code == 404


# ---- activity feed --------------------------------------------------------

def test_activity_feed(client, world):
    h = auth(world.a.admin)
    project = create_project(client, h, world, member_ids=[world.a.employee_emp.id])
    other = create_project(client, h, world, name="Unrelated")
    ms = client.post(f"{BASE}/{project['id']}/milestones", json={"name": "M1"}, headers=h).json()["data"]
    task = create_task(client, h, project["id"], milestone_id=ms["id"], assigned_to=world.a.employee_emp.id)
    set_status(client, h, task["id"], "in_progress")
    create_task(client, h, other["id"], title="elsewhere")

    res = client.get(f"{BASE}/{project['id']}/activity", headers=h).json()
    types = [(r["entity_type"], r["action"]) for r in res["data"]]
    assert ("project", "created") in types and ("milestone", "created") in types
    assert ("task", "created") in types and ("task", "status_changed") in types and ("task", "assigned") not in types
    assert res["total"] == len(res["data"]) == 4
    assert all(r["user_name"] == world.a.admin.name for r in res["data"])
    assert all("elsewhere" not in (r["description"] or "") for r in res["data"])
    stamps = [(r["created_at"], r["id"]) for r in res["data"]]
    assert stamps == sorted(stamps, reverse=True)
    assert client.get(f"{BASE}/{project['id']}/activity", params={"limit": 2}, headers=h).json()["total_pages"] >= 2

    assert client.get(f"{BASE}/{project['id']}/activity", headers=auth(world.a.client_user)).status_code == 403
    assert client.get(f"{BASE}/{other['id']}/activity", headers=auth(world.a.employee)).status_code == 404
    assert client.get(f"{BASE}/{project['id']}/activity", headers=auth(world.b.admin)).status_code == 404


def test_activity_rows_are_scoped_to_the_project(client, world, db):
    h = auth(world.a.admin)
    project = create_project(client, h, world)
    # an audit row of another company that happens to reuse the id must not leak
    db.add(ActivityLog(company_id=world.b.company.id, action="updated", entity_type="project", entity_id=project["id"], description="foreign"))
    db.commit()
    rows = client.get(f"{BASE}/{project['id']}/activity", headers=h).json()["data"]
    assert all(r["description"] != "foreign" for r in rows)


# ---- /clients/{id}/projects, /employees/{id}/projects|tasks ---------------

def test_client_projects(client, world, factory):
    admin = auth(world.a.admin)
    create_project(client, admin, world)
    other_client = factory.make_client(world.a.company, "Second Client")
    create_project(client, admin, world, name="Other", client_id=other_client.id)
    url = f"/api/v1/clients/{world.a.client_record.id}/projects"

    res = client.get(url, headers=admin).json()
    assert res["total"] == 1 and res["data"][0]["client_name"] == world.a.client_record.company_name
    own = client.get(url, headers=auth(world.a.client_user))
    assert own.status_code == 200 and own.json()["data"][0]["budget"] is None
    assert client.get(f"/api/v1/clients/{other_client.id}/projects", headers=auth(world.a.client_user)).status_code == 404
    assert client.get(url, headers=auth(world.b.admin)).status_code == 404
    assert client.get(url, headers=auth(world.a.employee)).json()["total"] == 0  # not a member of anything
    assert client.get(f"/api/v1/clients/{other_client.id}/projects", headers=auth(world.a.manager)).json()["total"] == 1  # manages it
    assert client.get("/api/v1/clients/999999/projects", headers=admin).status_code == 404


def test_employee_projects_and_tasks_access(client, world, factory):
    admin = auth(world.a.admin)
    project = create_project(client, admin, world, member_ids=[world.a.employee_emp.id])
    task = create_task(client, admin, project["id"], assigned_to=world.a.employee_emp.id)
    create_task(client, admin, project["id"], title="Unassigned")
    hidden = client.post(BASE, json={"name": "Hidden from manager"}, headers=admin).json()["data"]
    client.post(f"{BASE}/{hidden['id']}/members", json={"employee_id": world.a.employee_emp.id}, headers=admin)
    emp = world.a.employee_emp.id

    projects_url, tasks_url = f"/api/v1/employees/{emp}/projects", f"/api/v1/employees/{emp}/tasks"
    assert {p["id"] for p in client.get(projects_url, headers=admin).json()["data"]} == {project["id"], hidden["id"]}
    # a manager only sees the projects visible to them
    assert [p["id"] for p in client.get(projects_url, headers=auth(world.a.manager)).json()["data"]] == [project["id"]]
    assert client.get(projects_url, headers=auth(world.a.employee)).json()["total"] == 2
    assert [t["id"] for t in client.get(tasks_url, headers=admin).json()["data"]] == [task["id"]]
    assert [t["id"] for t in client.get(tasks_url, headers=auth(world.a.manager)).json()["data"]] == [task["id"]]
    assert client.get(tasks_url, headers=auth(world.a.employee)).json()["total"] == 1

    manager_emp = world.a.manager_emp.id
    assert client.get(f"/api/v1/employees/{manager_emp}/projects", headers=auth(world.a.employee)).status_code == 403
    assert client.get(f"/api/v1/employees/{manager_emp}/tasks", headers=auth(world.a.employee)).status_code == 403
    assert client.get(projects_url, headers=auth(world.a.client_user)).status_code == 403
    assert client.get(tasks_url, headers=auth(world.a.client_user)).status_code == 403
    assert client.get(projects_url, headers=auth(world.b.admin)).status_code == 404
    assert client.get(tasks_url, headers=auth(world.b.admin)).status_code == 404
    assert client.get("/api/v1/employees/999999/projects", headers=admin).status_code == 404
