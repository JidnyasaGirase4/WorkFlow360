from app.models import ActivityLog, Department
from tests.conftest import auth

BASE = "/api/v1/departments"


def make(client, headers, name="Engineering", **over):
    return client.post(BASE, json={"name": name, **over}, headers=headers)


def test_admin_crud_and_audit(client, world, db):
    h = auth(world.a.admin)
    res = make(client, h, description="Builds things")
    assert res.status_code == 201, res.text
    body = res.json()["data"]
    assert body["employee_count"] == 0 and body["status"] == "active" and body["company_id"] == world.a.company.id
    did = body["id"]

    assert client.get(f"{BASE}/{did}", headers=h).json()["data"]["name"] == "Engineering"
    upd = client.put(f"{BASE}/{did}", json={"name": "Product Engineering", "status": "inactive"}, headers=h)
    assert upd.status_code == 200 and upd.json()["data"]["status"] == "inactive"
    assert client.delete(f"{BASE}/{did}", headers=h).status_code == 200
    assert client.get(f"{BASE}/{did}", headers=h).status_code == 404

    db.commit()  # end the session's stale snapshot before reading what the API wrote
    actions = [a.action for a in db.query(ActivityLog).filter_by(entity_type="department", entity_id=did).order_by(ActivityLog.id)]
    assert actions == ["created", "updated", "deleted"]


def test_list_search_status_pagination_and_employee_count(client, world, factory, db):
    h = auth(world.a.admin)
    dev = make(client, h, "Development").json()["data"]["id"]
    make(client, h, "Design")
    make(client, h, "Sales", status="inactive")
    world.a.employee_emp.department_id = dev
    world.a.manager_emp.department_id = dev
    db.commit()

    res = client.get(BASE, params={"sort_by": "name", "sort_order": "asc"}, headers=h).json()
    assert [d["name"] for d in res["data"]] == ["Design", "Development", "Sales"]
    assert {d["name"]: d["employee_count"] for d in res["data"]}["Development"] == 2
    assert client.get(BASE, params={"search": "de"}, headers=h).json()["total"] == 2  # Design, Development
    assert client.get(BASE, params={"status": "inactive"}, headers=h).json()["total"] == 1
    page = client.get(BASE, params={"limit": 2, "page": 2, "sort_by": "name", "sort_order": "asc"}, headers=h).json()
    assert page["total"] == 3 and page["total_pages"] == 2 and len(page["data"]) == 1
    by_count = client.get(BASE, params={"sort_by": "employee_count", "sort_order": "desc"}, headers=h).json()["data"]
    assert by_count[0]["name"] == "Development"
    assert client.get(BASE, params={"sort_by": "bogus"}, headers=h).status_code == 422


def test_duplicate_name_per_company(client, world):
    a, b = auth(world.a.admin), auth(world.b.admin)
    assert make(client, a).status_code == 201
    assert make(client, a, "engineering").status_code == 409
    other = make(client, a, "Design").json()["data"]["id"]
    assert client.put(f"{BASE}/{other}", json={"name": "Engineering"}, headers=a).status_code == 409
    assert client.put(f"{BASE}/{other}", json={"name": "Design"}, headers=a).status_code == 200  # own name is fine
    assert make(client, b).status_code == 201  # another company may reuse the name


def test_delete_blocked_while_employees_assigned(client, world, db):
    h = auth(world.a.admin)
    did = make(client, h).json()["data"]["id"]
    world.a.employee_emp.department_id = did
    db.commit()
    res = client.delete(f"{BASE}/{did}", headers=h)
    assert res.status_code == 409 and "inactive" in res.json()["message"]
    assert db.get(Department, did) is not None
    world.a.employee_emp.department_id = None
    db.commit()
    assert client.delete(f"{BASE}/{did}", headers=h).status_code == 200


def test_permission_matrix(client, world):
    admin_dept = make(client, auth(world.a.admin)).json()["data"]["id"]
    for user in (world.a.manager, world.a.employee):  # view_departments only
        h = auth(user)
        assert client.get(BASE, headers=h).status_code == 200
        assert client.get(f"{BASE}/{admin_dept}", headers=h).status_code == 200
        assert make(client, h, "X").status_code == 403
        assert client.put(f"{BASE}/{admin_dept}", json={"name": "Y"}, headers=h).status_code == 403
        assert client.delete(f"{BASE}/{admin_dept}", headers=h).status_code == 403
    h = auth(world.a.client_user)
    assert client.get(BASE, headers=h).status_code == 403
    assert make(client, h).status_code == 403
    assert client.get(BASE).status_code == 401


def test_company_isolation(client, world):
    a, b = auth(world.a.admin), auth(world.b.admin)
    did = make(client, a).json()["data"]["id"]
    assert client.get(f"{BASE}/{did}", headers=b).status_code == 404
    assert client.put(f"{BASE}/{did}", json={"name": "Hacked"}, headers=b).status_code == 404
    assert client.delete(f"{BASE}/{did}", headers=b).status_code == 404
    assert did not in [d["id"] for d in client.get(BASE, headers=b).json()["data"]]


def test_validation(client, world):
    h = auth(world.a.admin)
    assert make(client, h, "x").status_code == 422  # too short
    assert make(client, h, "Ok", status="deleted").status_code == 422
    assert make(client, h, "Ok", company_id=3).status_code == 422  # unknown field
    did = make(client, h).json()["data"]["id"]
    assert client.put(f"{BASE}/{did}", json={"name": None}, headers=h).status_code == 422
