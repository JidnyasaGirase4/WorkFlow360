import pytest

from app.core.enums import RoleName, UserStatus
from app.models import ActivityLog, User
from tests.conftest import PASSWORD, auth

BASE = "/api/v1/users"


def fresh(db):
    """The test session holds a REPEATABLE READ snapshot; end it so rows written by the API become visible."""
    db.rollback()
    return db


def new_user(**over) -> dict:
    return {"name": "Nina Patel", "email": "Nina.Patel@Test.local", "password": "Strong123", "role": "employee", **over}


def login(client, user, password=PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": user.email, "password": password})


# ---- permission matrix ------------------------------------------------------

@pytest.mark.parametrize("role,expected", [("admin", 200), ("manager", 200), ("employee", 403), ("client_user", 403)])
def test_list_permission_matrix(client, world, role, expected):
    assert client.get(BASE, headers=auth(getattr(world.a, role))).status_code == expected


def test_list_requires_authentication(client):
    assert client.get(BASE).status_code == 401


def test_super_admin_can_list(client, world):
    assert client.get(BASE, headers=auth(world.super_admin)).status_code == 200


@pytest.mark.parametrize("role", ["manager", "employee", "client_user"])
def test_only_admins_can_write(client, world, role):
    h = auth(getattr(world.a, role))
    target = world.a.employee
    assert client.post(BASE, json=new_user(), headers=h).status_code == 403
    assert client.put(f"{BASE}/{target.id}", json={"name": "Hacked"}, headers=h).status_code == 403
    assert client.patch(f"{BASE}/{target.id}/status", json={"status": "suspended"}, headers=h).status_code == 403
    assert client.delete(f"{BASE}/{target.id}", headers=h).status_code == 403


# ---- create -----------------------------------------------------------------

def test_admin_creates_user_in_own_company(client, world, db):
    res = client.post(BASE, json=new_user(phone="+91 98765 43210"), headers=auth(world.a.admin))
    assert res.status_code == 201, res.text
    data = res.json()["data"]
    assert data["email"] == "nina.patel@test.local"  # lowercased
    assert data["role"] == "employee" and data["company_id"] == world.a.company.id and data["status"] == "active"
    assert "password" not in str(data).lower()
    row = fresh(db).get(User, data["id"])
    assert row.password_hash.startswith("$2") and row.password_hash != "Strong123"
    # the new account can sign in with the password that was set
    assert client.post("/api/v1/auth/login", json={"email": "nina.patel@test.local", "password": "Strong123"}).status_code == 200
    log = fresh(db).query(ActivityLog).filter_by(entity_type="user", entity_id=data["id"], action="created").one()
    assert log.user_id == world.a.admin.id and log.company_id == world.a.company.id


def test_admin_can_create_company_admin_and_manager(client, world):
    h = auth(world.a.admin)
    assert client.post(BASE, json=new_user(email="ca@test.local", role="company_admin"), headers=h).status_code == 201
    assert client.post(BASE, json=new_user(email="mg@test.local", role="manager"), headers=h).status_code == 201


def test_create_client_user_requires_client_in_same_company(client, world):
    h = auth(world.a.admin)
    ok = client.post(BASE, json=new_user(role="client", client_id=world.a.client_record.id), headers=h)
    assert ok.status_code == 201 and ok.json()["data"]["client_id"] == world.a.client_record.id
    assert client.post(BASE, json=new_user(email="x@test.local", role="client"), headers=h).status_code == 422
    foreign = client.post(BASE, json=new_user(email="y@test.local", role="client", client_id=world.b.client_record.id), headers=h)
    assert foreign.status_code == 404
    assert client.post(BASE, json=new_user(email="z@test.local", client_id=world.a.client_record.id), headers=h).status_code == 422


def test_create_validation(client, world, db):
    h = auth(world.a.admin)
    assert client.post(BASE, json=new_user(password="weak"), headers=h).status_code == 422
    assert client.post(BASE, json=new_user(password="alllowercase1"), headers=h).status_code == 422
    assert client.post(BASE, json=new_user(role="janitor"), headers=h).status_code == 422
    assert client.post(BASE, json=new_user(email="not-an-email"), headers=h).status_code == 422
    assert client.post(BASE, json=new_user(name="A"), headers=h).status_code == 422
    assert client.post(BASE, json=new_user(company_id=world.b.company.id), headers=h).status_code == 422  # unknown field
    assert fresh(db).query(User).filter(User.email.like("nina%")).count() == 0


def test_duplicate_email_is_409_even_across_companies_and_case(client, world):
    h = auth(world.a.admin)
    assert client.post(BASE, json=new_user(email=world.a.employee.email.upper()), headers=h).status_code == 409
    assert client.post(BASE, json=new_user(email=world.b.employee.email), headers=h).status_code == 409


def test_company_admin_cannot_grant_super_admin(client, world, db):
    res = client.post(BASE, json=new_user(role="super_admin"), headers=auth(world.a.admin))
    assert res.status_code == 403
    assert fresh(db).query(User).filter_by(email="nina.patel@test.local").count() == 0


def test_super_admin_creation_rules(client, world):
    h = auth(world.super_admin)
    sup = client.post(BASE, json=new_user(email="sa2@test.local", role="super_admin"), headers=h)
    assert sup.status_code == 201 and sup.json()["data"]["company_id"] is None
    # company users need a target company
    assert client.post(BASE, json=new_user(email="ca2@test.local", role="company_admin"), headers=h).status_code == 400
    ok = client.post(f"{BASE}?company_id={world.b.company.id}", json=new_user(email="ca3@test.local", role="company_admin"), headers=h)
    assert ok.status_code == 201 and ok.json()["data"]["company_id"] == world.b.company.id
    assert client.post(f"{BASE}?company_id=999999", json=new_user(email="ca4@test.local"), headers=h).status_code == 404


# ---- read / isolation -------------------------------------------------------

def test_list_scoped_to_own_company(client, world):
    res = client.get(BASE, params={"limit": 100}, headers=auth(world.a.admin))
    ids = {u["id"] for u in res.json()["data"]}
    assert {world.a.admin.id, world.a.manager.id, world.a.employee.id, world.a.client_user.id} == ids
    assert res.json()["total"] == 4


def test_super_admin_sees_everyone_and_can_filter_company(client, world):
    h = auth(world.super_admin)
    everyone = client.get(BASE, params={"limit": 100}, headers=h).json()
    assert everyone["total"] == 9 and world.super_admin.id in {u["id"] for u in everyone["data"]}
    only_b = client.get(BASE, params={"limit": 100, "company_id": world.b.company.id}, headers=h).json()
    assert {u["company_id"] for u in only_b["data"]} == {world.b.company.id} and only_b["total"] == 4


def test_other_company_user_is_404(client, world):
    h = auth(world.a.admin)
    victim = world.b.employee.id
    assert client.get(f"{BASE}/{victim}", headers=h).status_code == 404
    assert client.put(f"{BASE}/{victim}", json={"name": "Hacked"}, headers=h).status_code == 404
    assert client.patch(f"{BASE}/{victim}/status", json={"status": "suspended"}, headers=h).status_code == 404
    assert client.delete(f"{BASE}/{victim}", headers=h).status_code == 404
    assert client.get(f"{BASE}/999999", headers=h).status_code == 404


def test_super_admin_users_are_hidden_from_company_admin(client, world):
    h = auth(world.a.admin)
    listed = client.get(BASE, params={"limit": 100}, headers=h).json()["data"]
    assert world.super_admin.id not in {u["id"] for u in listed}
    sid = world.super_admin.id
    assert client.get(f"{BASE}/{sid}", headers=h).status_code == 404
    assert client.put(f"{BASE}/{sid}", json={"name": "Hacked"}, headers=h).status_code == 404
    assert client.patch(f"{BASE}/{sid}/status", json={"status": "suspended"}, headers=h).status_code == 404
    assert client.delete(f"{BASE}/{sid}", headers=h).status_code == 404
    assert client.get(f"{BASE}/{sid}", headers=auth(world.super_admin)).status_code == 200


def test_manager_sees_internal_users_only(client, world):
    h = auth(world.a.manager)
    listed = {u["id"] for u in client.get(BASE, params={"limit": 100}, headers=h).json()["data"]}
    assert world.a.client_user.id not in listed and {world.a.admin.id, world.a.employee.id} <= listed
    assert client.get(f"{BASE}/{world.a.client_user.id}", headers=h).status_code == 404
    assert client.get(f"{BASE}/{world.a.employee.id}", headers=h).status_code == 200


def test_list_filters_search_sort_pagination(client, world, factory):
    factory.make_user(world.a.company, RoleName.EMPLOYEE, "zed.zebra@test.local", name="Zed Zebra")
    h = auth(world.a.admin)
    assert client.get(BASE, params={"search": "zebra"}, headers=h).json()["total"] == 1
    assert client.get(BASE, params={"search": "ZED.ZEBRA@"}, headers=h).json()["total"] == 1
    assert client.get(BASE, params={"role": "manager"}, headers=h).json()["total"] == 1
    assert client.get(BASE, params={"status": "suspended"}, headers=h).json()["total"] == 0
    assert client.get(BASE, params={"role": "bogus"}, headers=h).status_code == 422
    page = client.get(BASE, params={"limit": 2, "page": 2, "sort_by": "name", "sort_order": "asc"}, headers=h).json()
    assert page["total"] == 5 and len(page["data"]) == 2 and page["total_pages"] == 3
    names = [u["name"] for u in client.get(BASE, params={"sort_by": "name", "sort_order": "asc"}, headers=h).json()["data"]]
    assert names == sorted(names, key=str.lower)
    assert client.get(BASE, params={"sort_by": "password_hash"}, headers=h).status_code == 422


# ---- update -----------------------------------------------------------------

def test_update_profile_fields_and_audit(client, world, db):
    h = auth(world.a.admin)
    res = client.put(f"{BASE}/{world.a.employee.id}", json={"name": "Renamed Person", "phone": "+91 99999 88888", "email": "Renamed@Test.local"}, headers=h)
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["name"] == "Renamed Person" and data["email"] == "renamed@test.local" and data["phone"] == "+91 99999 88888"
    log = fresh(db).query(ActivityLog).filter_by(entity_type="user", entity_id=world.a.employee.id, action="updated").one()
    assert "email" in log.description and log.user_id == world.a.admin.id


def test_update_email_conflict_and_nulls(client, world):
    h = auth(world.a.admin)
    assert client.put(f"{BASE}/{world.a.employee.id}", json={"email": world.a.manager.email}, headers=h).status_code == 409
    assert client.put(f"{BASE}/{world.a.employee.id}", json={"email": world.a.employee.email}, headers=h).status_code == 200  # own email is fine
    assert client.put(f"{BASE}/{world.a.employee.id}", json={"name": None}, headers=h).status_code == 422
    assert client.put(f"{BASE}/{world.a.employee.id}", json={"role": None}, headers=h).status_code == 422
    assert client.put(f"{BASE}/{world.a.employee.id}", json={"password": "Newpass123"}, headers=h).status_code == 422  # unknown field


def test_role_change_is_audited_as_permission_change(client, world, db):
    res = client.put(f"{BASE}/{world.a.employee.id}", json={"role": "manager"}, headers=auth(world.a.admin))
    assert res.status_code == 200 and res.json()["data"]["role"] == "manager"
    log = fresh(db).query(ActivityLog).filter_by(entity_type="user", entity_id=world.a.employee.id, action="permission_change").one()
    assert "employee" in log.description and "manager" in log.description
    # the new role takes effect on the next request
    assert client.get("/api/v1/auth/me", headers=auth(world.a.employee)).json()["data"]["user"]["role"] == "manager"


def test_role_change_rules(client, world):
    h = auth(world.a.admin)
    assert client.put(f"{BASE}/{world.a.employee.id}", json={"role": "super_admin"}, headers=h).status_code == 403
    assert client.put(f"{BASE}/{world.a.employee.id}", json={"role": "client"}, headers=h).status_code == 422
    assert client.put(f"{BASE}/{world.a.client_user.id}", json={"role": "employee"}, headers=h).status_code == 422
    assert client.put(f"{BASE}/{world.a.employee.id}", json={"role": "wizard"}, headers=h).status_code == 422
    same = client.put(f"{BASE}/{world.a.employee.id}", json={"role": "employee"}, headers=h)
    assert same.status_code == 200 and same.json()["data"]["role"] == "employee"


def test_cannot_change_own_role_but_can_edit_own_profile(client, world):
    h = auth(world.a.admin)
    assert client.put(f"{BASE}/{world.a.admin.id}", json={"role": "employee"}, headers=h).status_code == 403
    assert client.put(f"{BASE}/{world.a.admin.id}", json={"name": "Boss Person"}, headers=h).status_code == 200


def test_last_company_admin_cannot_be_demoted(client, world):
    res = client.put(f"{BASE}/{world.a.admin.id}", json={"role": "manager"}, headers=auth(world.super_admin))
    assert res.status_code == 400
    # with a second admin the first can be demoted by the super admin
    client.post(BASE, json=new_user(email="second@test.local", role="company_admin"), headers=auth(world.a.admin))
    assert client.put(f"{BASE}/{world.a.admin.id}", json={"role": "manager"}, headers=auth(world.super_admin)).status_code == 200


# ---- status / delete --------------------------------------------------------

def test_suspend_revokes_refresh_tokens_and_blocks_access(client, world, db):
    tokens = login(client, world.a.employee).json()["data"]
    res = client.patch(f"{BASE}/{world.a.employee.id}/status", json={"status": "suspended"}, headers=auth(world.a.admin))
    assert res.status_code == 200 and res.json()["data"]["status"] == "suspended"
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}).status_code == 403
    assert login(client, world.a.employee).status_code == 403
    log = fresh(db).query(ActivityLog).filter_by(entity_type="user", entity_id=world.a.employee.id, action="status_changed").one()
    assert "suspended" in log.description
    # reactivating restores access
    assert client.patch(f"{BASE}/{world.a.employee.id}/status", json={"status": "active"}, headers=auth(world.a.admin)).status_code == 200
    assert login(client, world.a.employee).status_code == 200


def test_status_validation_and_self_protection(client, world):
    h = auth(world.a.admin)
    assert client.patch(f"{BASE}/{world.a.employee.id}/status", json={"status": "banned"}, headers=h).status_code == 422
    assert client.patch(f"{BASE}/{world.a.admin.id}/status", json={"status": "suspended"}, headers=h).status_code == 403
    assert client.delete(f"{BASE}/{world.a.admin.id}", headers=h).status_code == 403


def test_last_company_admin_cannot_be_deactivated_or_deleted(client, world):
    h = auth(world.super_admin)
    assert client.patch(f"{BASE}/{world.a.admin.id}/status", json={"status": "inactive"}, headers=h).status_code == 400
    assert client.delete(f"{BASE}/{world.a.admin.id}", headers=h).status_code == 400


def test_delete_is_soft_and_revokes_sessions(client, world, db):
    tokens = login(client, world.a.manager).json()["data"]
    res = client.delete(f"{BASE}/{world.a.manager.id}", headers=auth(world.a.admin))
    assert res.status_code == 200 and "deactivated" in res.json()["message"]
    row = fresh(db).get(User, world.a.manager.id)
    assert row is not None and row.status == UserStatus.INACTIVE  # row survives
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401
    assert client.get(f"{BASE}/{world.a.manager.id}", headers=auth(world.a.admin)).json()["data"]["status"] == "inactive"
    assert fresh(db).query(ActivityLog).filter_by(entity_type="user", entity_id=world.a.manager.id, action="deleted").count() == 1


def test_company_admin_cannot_be_modified_by_non_admin_holder_of_permission(client, world, db):
    """Even if a role were granted edit_users, only administrators may touch a company admin."""
    from app.core.permissions import clear_permission_cache
    from app.models.role import Permission

    perm = db.query(Permission).filter_by(code="edit_users").one()
    role = world.a.manager.role
    role.permissions.append(perm)
    db.commit()
    clear_permission_cache()
    try:
        res = client.put(f"{BASE}/{world.a.admin.id}", json={"name": "Taken Over"}, headers=auth(world.a.manager))
        assert res.status_code == 403
        assert client.put(f"{BASE}/{world.a.employee.id}", json={"name": "Fine Person"}, headers=auth(world.a.manager)).status_code == 200
        assert client.put(f"{BASE}/{world.a.employee.id}", json={"role": "company_admin"}, headers=auth(world.a.manager)).status_code == 403
    finally:
        role.permissions.remove(perm)
        db.commit()
        clear_permission_cache()
