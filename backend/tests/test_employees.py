from contextlib import contextmanager
from datetime import date

import pytest

from app.core.enums import RoleName
from app.core.permissions import clear_permission_cache
from app.models import ActivityLog, Department, Employee, Permission, Project, ProjectMember, RefreshToken, Role, Task, User
from tests.conftest import PASSWORD, auth

BASE = "/api/v1/employees"
LOGIN = "/api/v1/auth/login"
PRIVATE = ("address", "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relation", "date_of_birth")


def payload(**over):
    return {
        "name": "Nina Patel", "email": "nina.patel@test.local", "phone": "+91 98450 12233", "designation": "Backend Developer",
        "salary": "85000.00", "address": "Baner, Pune", "date_of_birth": "1994-05-01", "gender": "Female", "location": "Pune HQ",
        "emergency_contact_name": "Ravi Patel", "emergency_contact_phone": "+91 98450 00000", "emergency_contact_relation": "Father",
        "skills": ["Python", "SQL"], **over,
    }


def create(client, headers=None, **over):
    return client.post(BASE, json=payload(**over), headers=headers)


def make_dept(db, company, name="Development"):
    dept = Department(company_id=company.id, name=name)
    db.add(dept)
    db.commit()
    return dept


@contextmanager
def granted(db, role_name: str, *codes: str):
    """Temporarily adds permissions to a role (reference tables are not reset between tests)."""
    role = db.query(Role).filter_by(name=role_name).one()
    perms = db.query(Permission).filter(Permission.code.in_(codes)).all()
    added = [p for p in perms if p not in role.permissions]
    role.permissions.extend(added)
    db.commit()
    clear_permission_cache()
    try:
        yield
    finally:
        for p in added:
            role.permissions.remove(p)
        db.commit()
        clear_permission_cache()


# ---- creation ---------------------------------------------------------------

def test_create_generates_code_and_temporary_password_that_can_log_in(client, world, db):
    h = auth(world.a.admin)
    res = create(client, h)
    assert res.status_code == 201, res.text
    data = res.json()["data"]
    assert data["employee_code"] == "EMP-0001" and data["role"] == "employee" and data["employment_status"] == "active"
    assert data["name"] == "Nina Patel" and data["email"] == "nina.patel@test.local" and data["salary"] == "85000.00"
    temp = data["temporary_password"]
    assert temp and len(temp) >= 12
    login = client.post(LOGIN, json={"email": "nina.patel@test.local", "password": temp})
    assert login.status_code == 200, login.text

    second = create(client, h, email="second@test.local", role="manager").json()["data"]
    assert second["employee_code"] == "EMP-0002" and second["role"] == "manager"
    assert client.get(f"{BASE}/{data['id']}", headers=h).json()["data"].get("temporary_password") is None  # shown once only

    db.commit()
    log = db.query(ActivityLog).filter_by(entity_type="employee", entity_id=data["id"], action="created").one()
    assert log.user_id == world.a.admin.id and log.company_id == world.a.company.id
    user = db.query(User).filter_by(email="nina.patel@test.local").one()
    assert user.company_id == world.a.company.id and user.password_hash != temp


def test_create_with_explicit_password_and_code(client, world):
    h = auth(world.a.admin)
    res = create(client, h, password="Chosen-Pass1", employee_code="TN-0042", joining_date="2026-01-05", employment_type="contract", manager_id=world.a.manager_emp.id)
    assert res.status_code == 201, res.text
    data = res.json()["data"]
    assert data["temporary_password"] is None and data["employee_code"] == "TN-0042"
    assert data["employment_type"] == "contract" and data["manager_id"] == world.a.manager_emp.id and data["manager_name"] == world.a.manager.name
    assert client.post(LOGIN, json={"email": "nina.patel@test.local", "password": "Chosen-Pass1"}).status_code == 200


def test_create_conflicts_and_validation(client, world, db):
    h = auth(world.a.admin)
    assert create(client, h, employee_code="X-1").status_code == 201
    assert create(client, h, email="other@test.local", employee_code="X-1").status_code == 409  # code per company
    assert create(client, h, employee_code="X-2").status_code == 409  # email
    assert create(client, auth(world.b.admin), employee_code="X-2").status_code == 409  # emails are global...
    assert create(client, auth(world.b.admin), email="b.person@test.local", employee_code="X-1").status_code == 201  # ...codes are per company
    assert db.query(User).filter_by(email="other@test.local").count() == 0  # failed create left nothing behind

    assert create(client, h, email="e1@test.local", role="company_admin").status_code == 422
    assert create(client, h, email="e2@test.local", role="client").status_code == 422
    assert create(client, h, email="e3@test.local", password="weak").status_code == 422
    assert create(client, h, email="not-an-email").status_code == 422
    assert create(client, h, email="e4@test.local", phone="abc").status_code == 422
    assert create(client, h, email="e5@test.local", salary="-5").status_code == 422
    assert create(client, h, email="e6@test.local", employment_status="terminated").status_code == 422
    assert create(client, h, email="e7@test.local", date_of_birth="2999-01-01").status_code == 422
    assert create(client, h, email="e8@test.local", company_id=1).status_code == 422  # unknown field
    assert client.post(BASE, json={"email": "e9@test.local"}, headers=h).status_code == 422


def test_create_rejects_other_companys_department_and_manager(client, world, db):
    foreign_dept = make_dept(db, world.b.company)
    h = auth(world.a.admin)
    assert create(client, h, department_id=foreign_dept.id).status_code == 404
    assert create(client, h, manager_id=world.b.manager_emp.id).status_code == 404
    assert db.query(User).filter_by(email="nina.patel@test.local").count() == 0
    own = make_dept(db, world.a.company)
    ok = create(client, h, department_id=own.id)
    assert ok.status_code == 201 and ok.json()["data"]["department_name"] == "Development"


def test_create_permissions(client, world):
    for user in (world.a.manager, world.a.employee, world.a.client_user):
        assert create(client, auth(user)).status_code == 403
    assert create(client).status_code == 401
    assert client.post(BASE, json=payload(), headers=auth(world.super_admin)).status_code == 400  # needs ?company_id
    ok = client.post(BASE, params={"company_id": world.a.company.id}, json=payload(), headers=auth(world.super_admin))
    assert ok.status_code == 201 and ok.json()["data"]["company_id"] == world.a.company.id


# ---- listing ----------------------------------------------------------------

def test_list_filters_search_sort_pagination(client, world, db):
    dev, design = make_dept(db, world.a.company, "Development"), make_dept(db, world.a.company, "Design")
    h = auth(world.a.admin)
    create(client, h, name="Aarav Shah", email="aarav@test.local", department_id=dev.id, designation="Frontend Developer")
    create(client, h, name="Bela Rao", email="bela@test.local", department_id=dev.id, employment_type="intern")
    create(client, h, name="Chirag Das", email="chirag@test.local", department_id=design.id, designation="UI Designer")
    inactive = create(client, h, name="Dev Null", email="devnull@test.local").json()["data"]["id"]
    client.delete(f"{BASE}/{inactive}", headers=h)

    def names(**params):
        res = client.get(BASE, params={"sort_by": "name", "sort_order": "asc", **params}, headers=h).json()
        return [e["name"] for e in res["data"]]

    assert names(department="development") == ["Aarav Shah", "Bela Rao"]
    assert names(department="DESIGN") == ["Chirag Das"]
    assert names(department_id=design.id) == ["Chirag Das"]
    assert names(status="terminated") == ["Dev Null"]
    assert names(employment_type="intern") == ["Bela Rao"]
    assert names(search="frontend") == ["Aarav Shah"]  # designation
    assert names(search="chirag@") == ["Chirag Das"]  # email
    assert names(search="EMP-0002") == ["Bela Rao"]  # code
    assert names(search="Rao") == ["Bela Rao"]
    assert names(search="nobody") == []
    assert "Aarav Shah" in names() and world.a.manager.name in names()
    by_dept = client.get(BASE, params={"sort_by": "department", "sort_order": "asc"}, headers=h).json()["data"]
    assert [e["department_name"] for e in by_dept if e["department_name"]] == ["Design", "Development", "Development"]

    page = client.get(BASE, params={"limit": 2, "page": 2, "sort_by": "name", "sort_order": "asc", "search": "@test.local"}, headers=h).json()
    assert page["limit"] == 2 and page["page"] == 2 and page["total"] == 6 and page["total_pages"] == 3 and len(page["data"]) == 2
    assert client.get(BASE, params={"sort_by": "salary"}, headers=h).status_code == 422  # salary is not sortable
    assert client.get(BASE, params={"status": "retired"}, headers=h).status_code == 422


def test_list_is_company_scoped_and_blocked_for_clients(client, world):
    create(client, auth(world.a.admin))
    b_names = [e["name"] for e in client.get(BASE, headers=auth(world.b.admin)).json()["data"]]
    assert "Nina Patel" not in b_names
    assert client.get(BASE, headers=auth(world.a.client_user)).status_code == 403
    assert client.get(BASE).status_code == 401
    assert client.get(BASE, headers=auth(world.super_admin)).json()["total"] >= 4  # all companies


# ---- field visibility -------------------------------------------------------

def test_field_visibility_per_role(client, world, db):
    h_admin = auth(world.a.admin)
    target = create(client, h_admin, department_id=make_dept(db, world.a.company).id, manager_id=world.a.manager_emp.id).json()["data"]
    tid = target["id"]

    def view(user):
        res = client.get(f"{BASE}/{tid}", headers=auth(user))
        assert res.status_code == 200, res.text
        return res.json()["data"]

    admin_view = view(world.a.admin)
    assert admin_view["salary"] == "85000.00" and admin_view["address"] == "Baner, Pune" and admin_view["date_of_birth"] == "1994-05-01"
    assert admin_view["emergency_contact_name"] == "Ravi Patel" and admin_view["stats"] is not None

    manager_view = view(world.a.manager)
    assert manager_view["salary"] is None
    assert manager_view["address"] == "Baner, Pune" and manager_view["emergency_contact_phone"] == "+91 98450 00000" and manager_view["date_of_birth"] == "1994-05-01"

    directory = view(world.a.employee)  # another employee's profile: directory fields only
    assert directory["name"] == "Nina Patel" and directory["email"] == "nina.patel@test.local" and directory["phone"]
    assert directory["designation"] == "Backend Developer" and directory["department_name"] == "Development" and directory["location"] == "Pune HQ"
    assert directory["salary"] is None and directory["stats"] is None
    assert all(directory[f] is None for f in PRIVATE)

    listed = next(e for e in client.get(BASE, headers=auth(world.a.employee)).json()["data"] if e["id"] == tid)
    assert listed["salary"] is None and all(listed[f] is None for f in PRIVATE)
    listed_by_mgr = next(e for e in client.get(BASE, headers=auth(world.a.manager)).json()["data"] if e["id"] == tid)
    assert listed_by_mgr["salary"] is None and listed_by_mgr["address"] == "Baner, Pune"
    listed_by_admin = next(e for e in client.get(BASE, headers=h_admin).json()["data"] if e["id"] == tid)
    assert listed_by_admin["salary"] == "85000.00"


def test_employee_sees_own_salary_and_private_fields(client, world, db):
    emp = world.a.employee_emp
    emp.salary, emp.address, emp.date_of_birth = 50000, "Kothrud, Pune", date(1995, 2, 2)
    db.commit()
    h = auth(world.a.employee)
    for url in (f"{BASE}/{emp.id}", f"{BASE}/me"):
        data = client.get(url, headers=h).json()["data"]
        assert data["id"] == emp.id and data["salary"] == "50000.00" and data["address"] == "Kothrud, Pune" and data["date_of_birth"] == "1995-02-02"
    mine_in_list = next(e for e in client.get(BASE, headers=h).json()["data"] if e["id"] == emp.id)
    assert mine_in_list["salary"] == "50000.00"
    manager_view = client.get(f"{BASE}/{emp.id}", headers=auth(world.a.manager)).json()["data"]
    assert manager_view["salary"] is None and manager_view["address"] == "Kothrud, Pune"


def test_view_salary_permission_is_what_gates_salary(client, world, db):
    emp = world.a.employee_emp
    emp.salary = 50000
    db.commit()
    with granted(db, RoleName.MANAGER.value, "view_salary"):
        assert client.get(f"{BASE}/{emp.id}", headers=auth(world.a.manager)).json()["data"]["salary"] == "50000.00"
    assert client.get(f"{BASE}/{emp.id}", headers=auth(world.a.manager)).json()["data"]["salary"] is None


def test_me_and_detail_access_rules(client, world):
    assert client.get(f"{BASE}/me", headers=auth(world.a.client_user)).status_code == 403
    assert client.get(f"{BASE}/me", headers=auth(world.super_admin)).status_code == 404  # no employee profile
    assert client.get(f"{BASE}/me", headers=auth(world.a.admin)).status_code == 404
    assert client.get(f"{BASE}/{world.a.employee_emp.id}", headers=auth(world.a.client_user)).status_code == 403
    assert client.get(f"{BASE}/{world.b.employee_emp.id}", headers=auth(world.a.admin)).status_code == 404
    assert client.get(f"{BASE}/{world.b.employee_emp.id}", headers=auth(world.a.employee)).status_code == 404
    assert client.get(f"{BASE}/99999", headers=auth(world.a.admin)).status_code == 404


def test_profile_stats(client, world, db):
    emp, company = world.a.employee_emp, world.a.company
    project = Project(company_id=company.id, name="P", project_code="P-1")
    db.add(project)
    db.flush()
    db.add(ProjectMember(project_id=project.id, employee_id=emp.id))
    for i, status in enumerate(["todo", "in_progress", "completed"]):
        db.add(Task(company_id=company.id, project_id=project.id, assigned_to=emp.id, title=f"T{i}", status=status))
    db.commit()
    stats = client.get(f"{BASE}/{emp.id}", headers=auth(world.a.admin)).json()["data"]["stats"]
    assert stats["project_count"] == 1 and stats["open_task_count"] == 2
    assert stats["leave_balance"]["casual"] == {"total": 12, "used": 0, "pending": 0, "remaining": 12}
    assert stats["leave_balance"]["earned"]["total"] == 18 and stats["leave_balance"]["sick"]["total"] == 10


# ---- update -----------------------------------------------------------------

def test_admin_updates_profile_and_linked_user(client, world, db):
    h = auth(world.a.admin)
    dept = make_dept(db, world.a.company)
    eid = world.a.employee_emp.id
    res = client.put(
        f"{BASE}/{eid}",
        json={"name": "Renamed Person", "phone": "+91 90000 11111", "email": "Renamed@Test.local", "designation": "Lead", "salary": "99000", "department_id": dept.id, "skills": ["Go"]},
        headers=h,
    )
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["name"] == "Renamed Person" and data["email"] == "renamed@test.local" and data["salary"] == "99000.00"
    assert data["department_name"] == "Development" and data["skills"] == ["Go"]
    db.commit()
    user = db.get(User, world.a.employee.id)
    db.refresh(user)
    assert user.name == "Renamed Person" and user.phone == "+91 90000 11111" and user.email == "renamed@test.local"
    assert db.query(ActivityLog).filter_by(entity_type="employee", entity_id=eid, action="updated").count() == 1


def test_update_conflicts_and_bad_references(client, world, db):
    h = auth(world.a.admin)
    eid = world.a.employee_emp.id
    assert client.put(f"{BASE}/{eid}", json={"email": world.a.manager.email}, headers=h).status_code == 409
    assert client.put(f"{BASE}/{eid}", json={"email": world.b.manager.email}, headers=h).status_code == 409
    assert client.put(f"{BASE}/{eid}", json={"employee_code": world.a.manager_emp.employee_code}, headers=h).status_code == 409
    assert client.put(f"{BASE}/{eid}", json={"employee_code": world.a.employee_emp.employee_code}, headers=h).status_code == 200  # own code
    assert client.put(f"{BASE}/{eid}", json={"manager_id": eid}, headers=h).status_code == 400
    assert client.put(f"{BASE}/{eid}", json={"manager_id": world.b.manager_emp.id}, headers=h).status_code == 404
    assert client.put(f"{BASE}/{eid}", json={"department_id": make_dept(db, world.b.company).id}, headers=h).status_code == 404
    assert client.put(f"{BASE}/{eid}", json={"name": None}, headers=h).status_code == 422
    assert client.put(f"{BASE}/{eid}", json={"role": "company_admin"}, headers=h).status_code == 422  # role is not editable here
    assert client.put(f"{BASE}/{world.b.employee_emp.id}", json={"designation": "x"}, headers=h).status_code == 404


def test_update_permissions_and_salary_rule(client, world, db):
    eid = world.a.employee_emp.id
    # default matrix: only admins hold edit_employees
    assert client.put(f"{BASE}/{eid}", json={"designation": "X"}, headers=auth(world.a.manager)).status_code == 403
    assert client.put(f"{BASE}/{eid}", json={"designation": "X"}, headers=auth(world.a.employee)).status_code == 403
    assert client.put(f"{BASE}/{eid}", json={"designation": "X"}, headers=auth(world.a.client_user)).status_code == 403

    with granted(db, RoleName.MANAGER.value, "edit_employees"):
        h = auth(world.a.manager)
        ok = client.put(f"{BASE}/{eid}", json={"designation": "Senior", "address": "New address"}, headers=h)
        assert ok.status_code == 200 and ok.json()["data"]["designation"] == "Senior" and ok.json()["data"]["salary"] is None
        assert client.put(f"{BASE}/{eid}", json={"salary": "1"}, headers=h).status_code == 403  # salary needs view_salary
        db.commit()
        db.refresh(world.a.employee_emp)
        assert world.a.employee_emp.salary is None


def test_manager_cannot_edit_or_deactivate_admin_employee(client, world, factory, db):
    admin_emp = factory.make_employee(world.a.admin, "A-ADM")
    with granted(db, RoleName.MANAGER.value, "edit_employees", "delete_employees"):
        h = auth(world.a.manager)
        assert client.put(f"{BASE}/{admin_emp.id}", json={"designation": "x"}, headers=h).status_code == 403
        assert client.delete(f"{BASE}/{admin_emp.id}", headers=h).status_code == 403


def test_setting_status_inactive_via_put_blocks_login_and_reinstating_restores_it(client, world, db):
    h = auth(world.a.admin)
    res = client.put(f"{BASE}/{world.a.employee_emp.id}", json={"employment_status": "inactive"}, headers=h)
    assert res.status_code == 200 and res.json()["data"]["user_status"] == "inactive"
    assert client.post(LOGIN, json={"email": world.a.employee.email, "password": PASSWORD}).status_code == 403
    back = client.put(f"{BASE}/{world.a.employee_emp.id}", json={"employment_status": "active"}, headers=h)
    assert back.json()["data"]["user_status"] == "active"
    assert client.post(LOGIN, json={"email": world.a.employee.email, "password": PASSWORD}).status_code == 200


# ---- deactivation -----------------------------------------------------------

def test_delete_deactivates_and_blocks_login(client, world, db):
    login = client.post(LOGIN, json={"email": world.a.employee.email, "password": PASSWORD})
    assert login.status_code == 200
    h = auth(world.a.admin)
    res = client.delete(f"{BASE}/{world.a.employee_emp.id}", headers=h)
    assert res.status_code == 200, res.text

    got = client.get(f"{BASE}/{world.a.employee_emp.id}", headers=h).json()["data"]  # record survives
    assert got["employment_status"] == "terminated" and got["user_status"] == "inactive"
    assert client.post(LOGIN, json={"email": world.a.employee.email, "password": PASSWORD}).status_code == 403
    assert client.get(f"{BASE}/me", headers=auth(world.a.employee)).status_code == 403  # existing access token dies too
    refresh = login.json()["data"]["refresh_token"]
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": refresh}).status_code == 401
    db.commit()
    assert db.query(RefreshToken).filter_by(user_id=world.a.employee.id, revoked_at=None).count() == 0
    assert db.query(ActivityLog).filter_by(entity_type="employee", entity_id=world.a.employee_emp.id, action="deleted").count() == 1
    assert db.query(Employee).filter_by(id=world.a.employee_emp.id).count() == 1  # never hard deleted


def test_cannot_deactivate_yourself_and_delete_permissions(client, world, factory, db):
    own = factory.make_employee(world.a.admin, "A-ADM")
    assert client.delete(f"{BASE}/{own.id}", headers=auth(world.a.admin)).status_code == 403
    assert db.get(User, world.a.admin.id).status.value == "active"
    for user in (world.a.manager, world.a.employee, world.a.client_user):
        assert client.delete(f"{BASE}/{world.a.employee_emp.id}", headers=auth(user)).status_code == 403
    assert client.delete(f"{BASE}/{world.b.employee_emp.id}", headers=auth(world.a.admin)).status_code == 404


# ---- activity ---------------------------------------------------------------

def test_employee_activity_feed(client, world, db):
    # a real action performed by the employee ends up in their feed
    assert client.post("/api/v1/attendance/check-in", headers=auth(world.a.employee)).status_code == 201
    emp = world.a.employee_emp
    url = f"{BASE}/{emp.id}/activity"
    res = client.get(url, headers=auth(world.a.admin))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] >= 1 and body["data"][0]["action"] == "checked_in"
    assert client.get(url, headers=auth(world.a.employee)).status_code == 200  # themself
    assert client.get(url, headers=auth(world.a.manager)).status_code == 200
    assert client.get(f"{BASE}/{world.a.manager_emp.id}/activity", headers=auth(world.a.employee)).status_code == 403
    assert client.get(url, headers=auth(world.a.client_user)).status_code == 403
    assert client.get(url, headers=auth(world.b.admin)).status_code == 404
    assert client.get(url, params={"sort_by": "password"}, headers=auth(world.a.admin)).status_code == 422
    rows = client.get(url, params={"limit": 1}, headers=auth(world.a.admin)).json()
    assert rows["limit"] == 1 and len(rows["data"]) == 1


@pytest.mark.parametrize("method,suffix", [("get", ""), ("put", ""), ("delete", "")])
def test_requires_authentication(client, method, suffix):
    assert getattr(client, method)(f"{BASE}/1{suffix}").status_code == 401
