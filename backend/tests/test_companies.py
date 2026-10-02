import pytest

from app.core.enums import CompanyStatus
from app.models import ActivityLog, Company
from tests.conftest import PASSWORD, auth

BASE = "/api/v1/companies"


def fresh(db):
    """End the test session's REPEATABLE READ snapshot so rows written through the API are visible."""
    db.rollback()
    return db


def new_company(**over) -> dict:
    return {
        "name": "Globex Corporation",
        "industry": "Manufacturing",
        "currency": "usd",
        "admin": {"name": "Gina Globex", "email": "Gina@Globex.test", "password": "Strong123"},
        **over,
    }


def login(client, email, password="Strong123"):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


# ---- permission matrix ------------------------------------------------------

@pytest.mark.parametrize("role", ["admin", "manager", "employee", "client_user"])
def test_platform_endpoints_are_super_admin_only(client, world, role):
    h = auth(getattr(world.a, role))
    cid = world.b.company.id
    assert client.get(BASE, headers=h).status_code == 403
    assert client.post(BASE, json=new_company(), headers=h).status_code == 403
    assert client.get(f"{BASE}/{cid}", headers=h).status_code == 403
    assert client.put(f"{BASE}/{cid}", json={"name": "Hijacked"}, headers=h).status_code == 403
    assert client.patch(f"{BASE}/{cid}/status", json={"status": "suspended"}, headers=h).status_code == 403


def test_requires_authentication(client):
    assert client.get(BASE).status_code == 401
    assert client.get(f"{BASE}/me").status_code == 401


# ---- create -----------------------------------------------------------------

def test_create_company_with_first_admin(client, world, db):
    res = client.post(BASE, json=new_company(), headers=auth(world.super_admin))
    assert res.status_code == 201, res.text
    data = res.json()["data"]
    assert data["slug"] == "globex-corporation" and data["status"] == "active"
    assert data["currency"] == "USD"  # normalised
    assert data["admin"]["role"] == "company_admin" and data["admin"]["company_id"] == data["id"]
    assert data["admin"]["email"] == "gina@globex.test"
    assert "password" not in str(data).lower()
    # the new admin can sign in and reach their own company's settings
    tokens = login(client, "gina@globex.test").json()["data"]
    me = client.get(f"{BASE}/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert me.status_code == 200 and me.json()["data"]["id"] == data["id"]
    log = fresh(db).query(ActivityLog).filter_by(entity_type="company", entity_id=data["id"], action="created").one()
    assert log.user_id == world.super_admin.id and log.company_id == data["id"]


def test_create_uses_given_slug_and_rejects_duplicates(client, world, db):
    h = auth(world.super_admin)
    assert client.post(BASE, json=new_company(slug="Globex HQ"), headers=h).json()["data"]["slug"] == "globex-hq"
    dup_slug = client.post(BASE, json=new_company(slug="globex-hq", admin={"name": "Other Admin", "email": "o@globex.test", "password": "Strong123"}), headers=h)
    assert dup_slug.status_code == 409
    # same name without a slug gets a fresh, unique slug
    again = client.post(BASE, json=new_company(admin={"name": "Third Admin", "email": "t@globex.test", "password": "Strong123"}), headers=h)
    assert again.status_code == 201 and again.json()["data"]["slug"] == "globex-corporation"
    again2 = client.post(BASE, json=new_company(admin={"name": "Fourth Admin", "email": "f@globex.test", "password": "Strong123"}), headers=h)
    assert again2.json()["data"]["slug"] == "globex-corporation-2"


def test_duplicate_admin_email_rolls_back_the_whole_company(client, world, db):
    before = fresh(db).query(Company).count()
    res = client.post(BASE, json=new_company(admin={"name": "Dup Admin", "email": world.a.admin.email, "password": "Strong123"}), headers=auth(world.super_admin))
    assert res.status_code == 409
    assert fresh(db).query(Company).count() == before  # nothing half-created


def test_create_validation(client, world, db):
    h = auth(world.super_admin)
    before = fresh(db).query(Company).count()
    admin = new_company()["admin"]
    assert client.post(BASE, json=new_company(admin={**admin, "password": "weak"}), headers=h).status_code == 422
    assert client.post(BASE, json=new_company(admin={**admin, "email": "nope"}), headers=h).status_code == 422
    assert client.post(BASE, json={k: v for k, v in new_company().items() if k != "admin"}, headers=h).status_code == 422
    assert client.post(BASE, json=new_company(name=""), headers=h).status_code == 422
    assert client.post(BASE, json=new_company(currency="XYZ"), headers=h).status_code == 422
    assert client.post(BASE, json=new_company(status="suspended"), headers=h).status_code == 422  # unknown field
    assert fresh(db).query(Company).count() == before


# ---- list / get / update (super admin) --------------------------------------

def test_list_with_user_count_search_and_status_filter(client, world, db):
    h = auth(world.super_admin)
    rows = client.get(BASE, params={"limit": 100}, headers=h).json()
    counts = {c["id"]: c["user_count"] for c in rows["data"]}
    assert rows["total"] == 2 and counts == {world.a.company.id: 4, world.b.company.id: 4}
    assert client.get(BASE, params={"search": "Company a"}, headers=h).json()["total"] == 1
    assert client.get(BASE, params={"status": "suspended"}, headers=h).json()["total"] == 0
    world.b.company.status = CompanyStatus.SUSPENDED
    db.commit()
    assert [c["id"] for c in client.get(BASE, params={"status": "suspended"}, headers=h).json()["data"]] == [world.b.company.id]
    assert client.get(BASE, params={"sort_by": "name", "sort_order": "asc", "limit": 1}, headers=h).json()["data"][0]["name"] == "Company a"
    assert client.get(BASE, params={"sort_by": "logo_url"}, headers=h).status_code == 422


def test_get_and_update_company(client, world, db):
    h = auth(world.super_admin)
    cid = world.a.company.id
    assert client.get(f"{BASE}/{cid}", headers=h).json()["data"]["name"] == "Company a"
    assert client.get(f"{BASE}/999999", headers=h).status_code == 404
    res = client.put(f"{BASE}/{cid}", json={"name": "Renamed Co", "industry": "Healthcare"}, headers=h)
    assert res.status_code == 200 and res.json()["data"]["name"] == "Renamed Co"
    assert client.put(f"{BASE}/999999", json={"name": "Nope Co"}, headers=h).status_code == 404
    log = fresh(db).query(ActivityLog).filter_by(entity_type="company", entity_id=cid, action="updated").one()
    assert "name" in log.description and log.user_id == world.super_admin.id


# ---- suspension end-to-end --------------------------------------------------

def test_suspending_a_company_blocks_all_its_users_end_to_end(client, world, db):
    sa = auth(world.super_admin)
    cid = world.a.company.id
    tokens = login(client, world.a.employee.email, PASSWORD).json()["data"]
    assert client.get("/api/v1/auth/me", headers=auth(world.a.admin)).status_code == 200

    res = client.patch(f"{BASE}/{cid}/status", json={"status": "suspended"}, headers=sa)
    assert res.status_code == 200 and res.json()["data"]["status"] == "suspended"

    for user in (world.a.admin, world.a.manager, world.a.employee, world.a.client_user):
        assert client.get("/api/v1/auth/me", headers=auth(user)).status_code == 403
        assert client.get("/api/v1/users", headers=auth(user)).status_code == 403
        assert client.get("/api/v1/clients", headers=auth(user)).status_code == 403
    assert client.get(f"{BASE}/me", headers=auth(world.a.admin)).status_code == 403
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401
    # other companies are unaffected
    assert client.get("/api/v1/users", headers=auth(world.b.admin)).status_code == 200
    log = fresh(db).query(ActivityLog).filter_by(entity_type="company", entity_id=cid, action="status_changed").one()
    assert "suspended" in log.description

    # reactivation restores access
    assert client.patch(f"{BASE}/{cid}/status", json={"status": "active"}, headers=sa).status_code == 200
    assert client.get("/api/v1/users", headers=auth(world.a.admin)).status_code == 200


def test_status_validation(client, world):
    h = auth(world.super_admin)
    assert client.patch(f"{BASE}/{world.a.company.id}/status", json={"status": "deleted"}, headers=h).status_code == 422
    assert client.patch(f"{BASE}/999999/status", json={"status": "active"}, headers=h).status_code == 404


# ---- company settings (/me) -------------------------------------------------

def test_admin_reads_and_updates_own_company_settings(client, world, db):
    h = auth(world.a.admin)
    assert client.get(f"{BASE}/me", headers=h).json()["data"]["id"] == world.a.company.id
    body = {
        "name": "TechNova Solutions Pvt Ltd", "industry": "Software & IT Services",
        "address": "4th Floor, Cyber Towers, Hyderabad", "phone": "+91 98765 43210", "email": "hello@technova.in",
        "website": "https://www.technova.in", "gstin": "36AABCT1234F1Z5", "timezone": "Asia/Kolkata",
        "currency": "aed", "fiscal_year_start": "January", "logo_url": "/uploads/1/logo.png",
    }
    res = client.put(f"{BASE}/me", json=body, headers=h)
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["name"] == body["name"] and data["currency"] == "AED" and data["fiscal_year_start"] == "january"
    assert data["gstin"] == "36AABCT1234F1Z5" and data["logo_url"] == "/uploads/1/logo.png"
    assert data["slug"] == world.a.company.slug and data["status"] == "active"  # not editable here
    assert fresh(db).get(Company, world.a.company.id).name == "TechNova Solutions Pvt Ltd"
    log = db.query(ActivityLog).filter_by(entity_type="company", entity_id=world.a.company.id, action="updated").one()
    assert log.user_id == world.a.admin.id and "currency" in log.description
    # another company is untouched
    assert db.get(Company, world.b.company.id).name == "Company b"


def test_partial_update_and_blank_clears_optional_fields(client, world):
    h = auth(world.a.admin)
    client.put(f"{BASE}/me", json={"website": "technova.in", "phone": "+91 98765 43210"}, headers=h)
    res = client.put(f"{BASE}/me", json={"phone": "", "gstin": ""}, headers=h)
    data = res.json()["data"]
    assert res.status_code == 200 and data["phone"] is None and data["gstin"] is None
    assert data["website"] == "technova.in" and data["name"] == "Company a"  # untouched fields survive


def test_settings_validation(client, world):
    h = auth(world.a.admin)
    for bad in (
        {"currency": "XYZ"}, {"currency": "RS"}, {"fiscal_year_start": "smarch"}, {"website": "not a url"},
        {"gstin": "12345"}, {"timezone": "Mars"}, {"email": "nope"}, {"phone": "abc"},
        {"name": ""}, {"name": None}, {"currency": None}, {"slug": "hacked"}, {"status": "suspended"}, {"logo_url": "x" * 501},
    ):
        assert client.put(f"{BASE}/me", json=bad, headers=h).status_code == 422, bad
    for good in ("USD", "INR", "EUR", "GBP", "AED", "SGD", "AUD"):
        assert client.put(f"{BASE}/me", json={"currency": good}, headers=h).status_code == 200
    assert client.get(f"{BASE}/me", headers=h).json()["data"]["currency"] == "AUD"


@pytest.mark.parametrize("role", ["manager", "employee", "client_user"])
def test_settings_need_manage_settings(client, world, role):
    h = auth(getattr(world.a, role))
    assert client.get(f"{BASE}/me", headers=h).status_code == 403
    assert client.put(f"{BASE}/me", json={"name": "Hijacked"}, headers=h).status_code == 403


def test_super_admin_needs_company_id_for_me(client, world, db):
    h = auth(world.super_admin)
    assert client.get(f"{BASE}/me", headers=h).status_code == 400
    assert client.put(f"{BASE}/me", json={"name": "Nameless"}, headers=h).status_code == 400
    ok = client.put(f"{BASE}/me?company_id={world.b.company.id}", json={"name": "B Renamed"}, headers=h)
    assert ok.status_code == 200 and ok.json()["data"]["id"] == world.b.company.id
    assert client.get(f"{BASE}/me?company_id=999999", headers=h).status_code == 404
    log = fresh(db).query(ActivityLog).filter_by(entity_type="company", entity_id=world.b.company.id, action="updated").one()
    assert log.company_id == world.b.company.id


def test_company_id_query_cannot_redirect_a_company_admin(client, world):
    res = client.put(f"{BASE}/me?company_id={world.b.company.id}", json={"name": "Sneaky Rename"}, headers=auth(world.a.admin))
    assert res.status_code == 200 and res.json()["data"]["id"] == world.a.company.id
    assert client.get(f"{BASE}/{world.b.company.id}", headers=auth(world.b.admin)).status_code == 403  # /{id} stays super-only

