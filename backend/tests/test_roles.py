import pytest

from app.core.permissions import PERMISSIONS, clear_permission_cache
from app.models import ActivityLog, Role
from tests.conftest import auth

BASE = "/api/v1/roles"


@pytest.fixture(autouse=True)
def restore_roles(db):
    """Roles are shared reference data that the table cleaner never resets: put every role back after each test."""
    db.rollback()
    snapshot = {r.id: list(r.permissions) for r in db.query(Role).all()}
    yield
    db.rollback()
    for role in db.query(Role).all():
        role.permissions = snapshot[role.id]
    db.commit()
    clear_permission_cache()


def role_id(db, name: str) -> int:
    db.rollback()
    return db.query(Role).filter_by(name=name).one().id


def codes_of(client, headers, rid: int) -> list[str]:
    return client.get(f"{BASE}/{rid}", headers=headers).json()["data"]["permissions"]


@pytest.mark.parametrize("role,expected", [("admin", 200), ("manager", 200), ("employee", 403), ("client_user", 403)])
def test_view_permission_matrix(client, world, role, expected):
    h = auth(getattr(world.a, role))
    assert client.get(BASE, headers=h).status_code == expected
    assert client.get("/api/v1/permissions", headers=h).status_code == expected


def test_requires_authentication(client):
    assert client.get(BASE).status_code == 401
    assert client.get("/api/v1/permissions").status_code == 401


def test_list_roles_with_counts(client, world):
    data = client.get(BASE, headers=auth(world.super_admin)).json()["data"]
    by_name = {r["name"]: r for r in data}
    assert set(by_name) == {"super_admin", "company_admin", "manager", "employee", "client"}
    assert by_name["super_admin"]["permission_count"] == len(PERMISSIONS)
    assert by_name["company_admin"]["permission_count"] == len(PERMISSIONS) - 1
    assert by_name["employee"]["user_count"] == 2 and by_name["super_admin"]["user_count"] == 1


def test_company_admin_role_counts_are_company_scoped_and_hide_super_admin(client, world):
    data = client.get(BASE, headers=auth(world.a.admin)).json()["data"]
    by_name = {r["name"]: r for r in data}
    assert "super_admin" not in by_name
    assert by_name["employee"]["user_count"] == 1 and by_name["company_admin"]["user_count"] == 1
    sid = client.get(BASE, headers=auth(world.super_admin)).json()["data"][0]["id"]
    assert client.get(f"{BASE}/{sid}", headers=auth(world.a.admin)).status_code == 404


def test_get_role_returns_permission_codes(client, world, db):
    res = client.get(f"{BASE}/{role_id(db, 'employee')}", headers=auth(world.a.admin))
    assert res.status_code == 200
    data = res.json()["data"]
    assert "mark_attendance" in data["permissions"] and "view_users" not in data["permissions"]
    assert data["permission_count"] == len(data["permissions"])
    assert client.get(f"{BASE}/999999", headers=auth(world.a.admin)).status_code == 404


def test_permissions_grouped_by_module(client, world):
    groups = client.get("/api/v1/permissions", headers=auth(world.a.manager)).json()["data"]
    by_module = {g["module"]: {p["code"] for p in g["permissions"]} for g in groups}
    assert {"view_users", "create_users"} <= by_module["users"]
    assert sum(len(v) for v in by_module.values()) == len(PERMISSIONS)


# ---- editing ----------------------------------------------------------------

@pytest.mark.parametrize("who", ["a.admin", "a.manager", "a.employee", "a.client_user"])
def test_only_super_admin_may_edit_roles(client, world, db, who):
    tenant, attr = who.split(".")
    h = auth(getattr(getattr(world, tenant), attr))
    rid = role_id(db, "employee")
    res = client.put(f"{BASE}/{rid}/permissions", json={"permissions": ["view_users"]}, headers=h)
    assert res.status_code == 403
    assert "view_users" not in codes_of(client, auth(world.super_admin), rid)


def test_super_admin_edits_permissions_and_it_is_audited(client, world, db):
    rid = role_id(db, "employee")
    h = auth(world.super_admin)
    current = codes_of(client, h, rid)
    res = client.put(f"{BASE}/{rid}/permissions", json={"permissions": [*current, "view_users", "view_users"]}, headers=h)  # duplicates collapse
    assert res.status_code == 200, res.text
    assert "view_users" in res.json()["data"]["permissions"] and res.json()["data"]["permission_count"] == len(current) + 1
    db.rollback()
    log = db.query(ActivityLog).filter_by(entity_type="role", entity_id=rid, action="permission_change").one()
    assert "view_users" in log.description and log.user_id == world.super_admin.id


def test_validation(client, world, db):
    h = auth(world.super_admin)
    rid = role_id(db, "employee")
    before = codes_of(client, h, rid)
    bad = client.put(f"{BASE}/{rid}/permissions", json={"permissions": ["view_users", "fly_to_moon"]}, headers=h)
    assert bad.status_code == 422 and "fly_to_moon" in str(bad.json()["errors"])
    assert client.put(f"{BASE}/{rid}/permissions", json={"permissions": "view_users"}, headers=h).status_code == 422
    assert client.put(f"{BASE}/{rid}/permissions", json={}, headers=h).status_code == 422
    assert client.put(f"{BASE}/{rid}/permissions", json={"permissions": [], "extra": 1}, headers=h).status_code == 422
    assert client.put(f"{BASE}/999999/permissions", json={"permissions": []}, headers=h).status_code == 404
    assert codes_of(client, h, rid) == before  # nothing was applied


def test_super_admin_role_cannot_be_emptied_or_lose_manage_roles(client, world, db):
    h = auth(world.super_admin)
    rid = role_id(db, "super_admin")
    assert client.put(f"{BASE}/{rid}/permissions", json={"permissions": []}, headers=h).status_code == 422
    assert client.put(f"{BASE}/{rid}/permissions", json={"permissions": ["view_users"]}, headers=h).status_code == 422
    assert len(codes_of(client, h, rid)) == len(PERMISSIONS)


def test_empty_permission_list_is_allowed_for_other_roles(client, world, db):
    h = auth(world.super_admin)
    rid = role_id(db, "client")
    res = client.put(f"{BASE}/{rid}/permissions", json={"permissions": []}, headers=h)
    assert res.status_code == 200 and res.json()["data"]["permission_count"] == 0
    assert client.get("/api/v1/clients", headers=auth(world.a.client_user)).status_code == 403


def test_granting_a_permission_takes_effect_immediately_and_removal_revokes_it(client, world, db):
    """Permissions are cached per role: the change must clear the cache so it applies on the very next request."""
    sa = auth(world.super_admin)
    rid = role_id(db, "employee")
    original = codes_of(client, sa, rid)
    emp = auth(world.a.employee)
    assert client.get("/api/v1/clients", headers=emp).status_code == 403  # employees cannot view clients by default
    assert client.get("/api/v1/users", headers=emp).status_code == 403

    client.put(f"{BASE}/{rid}/permissions", json={"permissions": [*original, "view_clients", "view_users"]}, headers=sa)
    assert client.get("/api/v1/clients", headers=emp).status_code == 200
    assert client.get("/api/v1/users", headers=emp).status_code == 200
    # an employee holding view_users still sees internal users only
    assert all(u["role"] != "client" for u in client.get("/api/v1/users", headers=emp).json()["data"])

    client.put(f"{BASE}/{rid}/permissions", json={"permissions": original}, headers=sa)
    assert client.get("/api/v1/clients", headers=emp).status_code == 403
    assert client.get("/api/v1/users", headers=emp).status_code == 403


def test_removing_an_existing_permission_returns_403(client, world, db):
    sa = auth(world.super_admin)
    rid = role_id(db, "manager")
    original = codes_of(client, sa, rid)
    assert client.get(BASE, headers=auth(world.a.manager)).status_code == 200  # view_roles, warms the cache
    client.put(f"{BASE}/{rid}/permissions", json={"permissions": [c for c in original if c != "view_roles"]}, headers=sa)
    assert client.get(BASE, headers=auth(world.a.manager)).status_code == 403
    client.put(f"{BASE}/{rid}/permissions", json={"permissions": original}, headers=sa)
    assert client.get(BASE, headers=auth(world.a.manager)).status_code == 200
