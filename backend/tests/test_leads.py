from contextlib import contextmanager
from datetime import date, timedelta

import pytest
from sqlalchemy import delete, select

from app.core.permissions import clear_permission_cache
from app.models import ActivityLog, Client, Lead, LeadActivity, Notification, Permission, Role
from app.models.role import role_permissions
from tests.conftest import auth

BASE = "/api/v1/leads"


def payload(**over):
    return {
        "company_name": "Orbit Logistics",
        "contact_name": "Vikram Anand",
        "email": "vikram@orbit.test",
        "phone": "+91 98450 12233",
        "source": "website",
        "priority": "high",
        "estimated_value": "450000.00",
        **over,
    }


def make_lead(client, headers, **over) -> dict:
    res = client.post(BASE, json=payload(**over), headers=headers)
    assert res.status_code == 201, res.text
    return res.json()["data"]


@contextmanager
def without_permission(db, role_name: str, code: str):
    """Temporarily strips a permission from a role (restored afterwards; the table is shared reference data)."""
    role_id = db.scalar(select(Role.id).where(Role.name == role_name))
    perm_id = db.scalar(select(Permission.id).where(Permission.code == code))
    db.execute(delete(role_permissions).where(role_permissions.c.role_id == role_id, role_permissions.c.permission_id == perm_id))
    db.commit()
    clear_permission_cache()
    try:
        yield
    finally:
        db.execute(role_permissions.insert().values(role_id=role_id, permission_id=perm_id))
        db.commit()
        clear_permission_cache()


# ---- CRUD ------------------------------------------------------------------

def test_crud_envelope_and_default_owner(client, world, db):
    h = auth(world.a.manager)
    created = client.post(BASE, json=payload(next_followup_date="2026-10-01"), headers=h)
    assert created.status_code == 201
    body = created.json()
    assert body["success"] is True
    lead = body["data"]
    assert lead["owner_id"] == world.a.manager.id and lead["owner_name"] == world.a.manager.name
    assert lead["status"] == "new" and lead["converted_client_id"] is None
    assert lead["estimated_value"] in ("450000.00", 450000, 450000.0)
    assert lead["company_id"] == world.a.company.id

    got = client.get(f"{BASE}/{lead['id']}", headers=h).json()["data"]
    assert got["next_followup_date"] == "2026-10-01"

    upd = client.put(f"{BASE}/{lead['id']}", json={"priority": "low", "owner_id": world.a.employee.id, "notes": "Call back"}, headers=h)
    assert upd.status_code == 200
    data = upd.json()["data"]
    assert data["priority"] == "low" and data["owner_name"] == world.a.employee.name and data["notes"] == "Call back"

    assert client.delete(f"{BASE}/{lead['id']}", headers=h).status_code == 403  # manager has no delete_leads
    assert client.delete(f"{BASE}/{lead['id']}", headers=auth(world.a.admin)).status_code == 200
    assert client.get(f"{BASE}/{lead['id']}", headers=h).status_code == 404
    db.rollback()
    actions = {(a.action, a.entity_type) for a in db.scalars(select(ActivityLog))}
    assert {("created", "lead"), ("updated", "lead"), ("deleted", "lead")} <= actions


def test_validation(client, world):
    h = auth(world.a.admin)
    assert client.post(BASE, json=payload(email="bad"), headers=h).status_code == 422
    assert client.post(BASE, json=payload(phone="abc"), headers=h).status_code == 422
    assert client.post(BASE, json=payload(estimated_value="-1"), headers=h).status_code == 422
    assert client.post(BASE, json=payload(estimated_value="1.999"), headers=h).status_code == 422
    assert client.post(BASE, json=payload(next_followup_date="2026-13-45"), headers=h).status_code == 422
    assert client.post(BASE, json=payload(status="closed"), headers=h).status_code == 422
    assert client.post(BASE, json=payload(company_id=9), headers=h).status_code == 422  # unknown field
    assert client.post(BASE, json={"company_name": "X Co"}, headers=h).status_code == 422  # contact_name required
    lead = make_lead(client, h)
    assert client.put(f"{BASE}/{lead['id']}", json={"company_name": None}, headers=h).status_code == 422
    assert client.put(f"{BASE}/{lead['id']}", json={"estimated_value": -5}, headers=h).status_code == 422


def test_owner_must_be_internal_user_of_same_company(client, world):
    h = auth(world.a.admin)
    assert client.post(BASE, json=payload(owner_id=world.a.client_user.id), headers=h).status_code == 422
    assert client.post(BASE, json=payload(owner_id=world.b.manager.id), headers=h).status_code == 404
    assert client.post(BASE, json=payload(owner_id=999999), headers=h).status_code == 404
    lead = make_lead(client, h, owner_id=world.a.employee.id)
    assert lead["owner_id"] == world.a.employee.id
    assert client.put(f"{BASE}/{lead['id']}", json={"owner_id": world.b.admin.id}, headers=h).status_code == 404
    assert client.put(f"{BASE}/{lead['id']}", json={"owner_id": world.a.client_user.id}, headers=h).status_code == 422


def test_list_filters_search_sort_pagination(client, world):
    h = auth(world.a.admin)
    make_lead(client, h, company_name="Alpha Corp", contact_name="Asha Rao", email="asha@alpha.test", source="referral", priority="low", estimated_value="100")
    make_lead(client, h, company_name="Beta Corp", contact_name="Bela Shah", email="bela@beta.test", source="website", priority="high", estimated_value="300", owner_id=world.a.manager.id)
    make_lead(client, h, company_name="Gamma Ltd", contact_name="Gita Nair", email="gita@gamma.test", source="website", priority="high", estimated_value="200", status="qualified")

    def names(**params):
        res = client.get(BASE, params=params, headers=h)
        assert res.status_code == 200, res.text
        return [row["company_name"] for row in res.json()["data"]]

    assert sorted(names()) == ["Alpha Corp", "Beta Corp", "Gamma Ltd"]
    assert names(status="qualified") == ["Gamma Ltd"]
    assert sorted(names(source="website")) == ["Beta Corp", "Gamma Ltd"]
    assert names(owner_id=world.a.manager.id) == ["Beta Corp"]
    assert sorted(names(priority="high")) == ["Beta Corp", "Gamma Ltd"]
    assert names(search="corp", sort_by="estimated_value", sort_order="asc") == ["Alpha Corp", "Beta Corp"]
    assert names(search="gita@gamma") == ["Gamma Ltd"]  # matches email
    assert names(search="Bela") == ["Beta Corp"]  # matches contact name
    today = date.today()
    assert len(names(date_from=str(today - timedelta(days=1)), date_to=str(today + timedelta(days=1)))) == 3
    assert names(date_from=str(today + timedelta(days=2))) == []
    assert names(date_to=str(today - timedelta(days=2))) == []
    assert client.get(BASE, params={"date_from": "2026-12-01", "date_to": "2026-01-01"}, headers=h).status_code == 422
    assert client.get(BASE, params={"sort_by": "password_hash"}, headers=h).status_code == 422
    assert client.get(BASE, params={"limit": 1000}, headers=h).status_code == 422

    page = client.get(BASE, params={"limit": 2, "page": 2, "sort_by": "estimated_value", "sort_order": "asc"}, headers=h).json()
    assert page["total"] == 3 and page["total_pages"] == 2 and [r["company_name"] for r in page["data"]] == ["Beta Corp"]
    assert page["data"][0]["owner_name"] == world.a.manager.name


def test_pipeline_counts_and_values(client, world):
    h = auth(world.a.admin)
    make_lead(client, h, company_name="A", estimated_value="100")
    make_lead(client, h, company_name="B", estimated_value="250.50")
    make_lead(client, h, company_name="C", estimated_value="75", status="won")
    make_lead(client, auth(world.b.admin), company_name="Other company", estimated_value="9999")

    res = client.get(f"{BASE}/pipeline", headers=h)
    assert res.status_code == 200
    data = res.json()["data"]
    stages = {s["status"]: s for s in data["stages"]}
    assert list(stages) == ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"]
    assert stages["new"]["count"] == 2 and float(stages["new"]["total_value"]) == 350.5
    assert stages["won"]["count"] == 1 and float(stages["won"]["total_value"]) == 75
    assert stages["lost"]["count"] == 0 and float(stages["lost"]["total_value"]) == 0
    assert data["total_count"] == 3 and float(data["total_value"]) == 425.5


# ---- activities ------------------------------------------------------------

def test_activities_update_last_contact_and_followup(client, world):
    h = auth(world.a.manager)
    lead = make_lead(client, h)
    url = f"{BASE}/{lead['id']}/activities"

    note = client.post(url, json={"activity_type": "note", "description": "Internal note"}, headers=h)
    assert note.status_code == 201, note.text
    assert note.json()["data"]["user_id"] == world.a.manager.id and note.json()["data"]["user_name"] == world.a.manager.name
    assert client.get(f"{BASE}/{lead['id']}", headers=h).json()["data"]["last_contact_date"] is None  # a note is not contact

    call = client.post(url, json={"activity_type": "call", "description": "Discovery call", "activity_date": "2026-09-20T10:00:00"}, headers=h)
    assert call.status_code == 201
    assert client.get(f"{BASE}/{lead['id']}", headers=h).json()["data"]["last_contact_date"] == "2026-09-20"

    fu = client.post(url, json={"activity_type": "follow_up", "description": "Ping next week", "next_followup_date": "2026-10-05"}, headers=h)
    assert fu.status_code == 201
    got = client.get(f"{BASE}/{lead['id']}", headers=h).json()["data"]
    assert got["next_followup_date"] == "2026-10-05" and got["last_contact_date"] == "2026-09-20"

    listing = client.get(url, headers=h).json()
    assert listing["total"] == 3
    assert [a["activity_type"] for a in listing["data"]] == ["follow_up", "note", "call"]
    dates = [a["activity_date"] for a in listing["data"]]
    assert dates == sorted(dates, reverse=True)  # newest first
    assert all(a["user_name"] == world.a.manager.name for a in listing["data"])


def test_activity_validation_and_isolation(client, world):
    h = auth(world.a.manager)
    lead = make_lead(client, h)
    url = f"{BASE}/{lead['id']}/activities"
    assert client.post(url, json={"activity_type": "sms", "description": "x"}, headers=h).status_code == 422
    assert client.post(url, json={"activity_type": "call", "description": ""}, headers=h).status_code == 422
    assert client.post(url, json={"activity_type": "call", "description": "x", "next_followup_date": "2026-10-05"}, headers=h).status_code == 422
    other = auth(world.b.admin)
    assert client.post(url, json={"activity_type": "note", "description": "x"}, headers=other).status_code == 404
    assert client.get(url, headers=other).status_code == 404


# ---- conversion ------------------------------------------------------------

def test_convert_creates_client_contact_and_side_effects(client, world, db):
    owner = world.a.manager
    lead = make_lead(client, auth(owner))
    res = client.post(f"{BASE}/{lead['id']}/convert", json={}, headers=auth(world.a.admin))
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["lead"]["status"] == "won" and data["lead"]["converted_at"] is not None
    cid = data["lead"]["converted_client_id"]
    assert cid == data["client"]["id"]
    assert data["client"]["company_name"] == "Orbit Logistics" and data["client"]["status"] == "active"
    assert data["client"]["created_by"] == world.a.admin.id and data["client"]["company_id"] == world.a.company.id

    contacts = client.get(f"/api/v1/clients/{cid}/contacts", headers=auth(world.a.admin)).json()["data"]
    assert len(contacts) == 1 and contacts[0]["name"] == "Vikram Anand" and contacts[0]["is_primary"] is True
    assert contacts[0]["email"] == "vikram@orbit.test"

    db.rollback()  # end the fixture's old snapshot so we read what the API committed
    acts = db.scalars(select(LeadActivity).where(LeadActivity.lead_id == lead["id"])).all()
    assert any(a.activity_type.value == "note" and "Converted to client Orbit Logistics" in a.description for a in acts)
    log = db.scalars(select(ActivityLog).where(ActivityLog.action == "converted", ActivityLog.entity_type == "lead")).one()
    assert log.entity_id == lead["id"] and log.user_id == world.a.admin.id and log.company_id == world.a.company.id
    note = db.scalars(select(Notification).where(Notification.user_id == owner.id, Notification.reference_type == "lead")).one()
    assert note.type.value == "system" and "Orbit Logistics" in note.message
    assert not db.scalars(select(Notification).where(Notification.user_id == world.a.admin.id)).all()  # actor excluded


def test_convert_twice_is_409(client, world):
    h = auth(world.a.admin)
    lead = make_lead(client, h)
    assert client.post(f"{BASE}/{lead['id']}/convert", headers=h).status_code == 200
    again = client.post(f"{BASE}/{lead['id']}/convert", headers=h)
    assert again.status_code == 409 and "already" in again.json()["message"]
    # and a converted lead can be neither deleted nor moved out of `won`
    assert client.delete(f"{BASE}/{lead['id']}", headers=h).status_code == 409
    assert client.put(f"{BASE}/{lead['id']}", json={"status": "lost"}, headers=h).status_code == 409
    assert client.put(f"{BASE}/{lead['id']}", json={"notes": "still editable"}, headers=h).status_code == 200


def test_convert_lost_lead_is_422(client, world, db):
    h = auth(world.a.admin)
    lead = make_lead(client, h, status="lost")
    assert client.post(f"{BASE}/{lead['id']}/convert", headers=h).status_code == 422
    db.rollback()
    assert db.scalars(select(Client).where(Client.company_id == world.a.company.id, Client.company_name == "Orbit Logistics")).first() is None


def test_convert_duplicate_client_conflict_and_link(client, world, db, factory):
    h = auth(world.a.admin)
    existing = client.post("/api/v1/clients", json={"company_name": "Orbit Logistics"}, headers=h).json()["data"]
    lead = make_lead(client, h)
    dup = client.post(f"{BASE}/{lead['id']}/convert", json={}, headers=h)
    assert dup.status_code == 409
    assert dup.json()["errors"] == {"existing_client_id": existing["id"]}
    db.rollback()
    assert db.scalar(select(Lead.converted_client_id).where(Lead.id == lead["id"])) is None

    # same e-mail, different name is also a duplicate
    by_mail = client.post("/api/v1/clients", json={"company_name": "Orbit Group", "email": "mail@orbit.test"}, headers=h).json()["data"]
    lead2 = make_lead(client, h, company_name="Something Else", email="mail@orbit.test")
    dup2 = client.post(f"{BASE}/{lead2['id']}/convert", json={}, headers=h)
    assert dup2.status_code == 409 and dup2.json()["errors"]["existing_client_id"] == by_mail["id"]

    # a client of another company cannot be linked
    foreign = client.post("/api/v1/clients", json={"company_name": "Foreign"}, headers=auth(world.b.admin)).json()["data"]
    assert client.post(f"{BASE}/{lead['id']}/convert", json={"existing_client_id": foreign["id"]}, headers=h).status_code == 404

    linked = client.post(f"{BASE}/{lead['id']}/convert", json={"existing_client_id": existing["id"]}, headers=h)
    assert linked.status_code == 200, linked.text
    assert linked.json()["data"]["lead"]["converted_client_id"] == existing["id"]
    assert linked.json()["data"]["lead"]["status"] == "won"
    db.rollback()  # end the fixture's old snapshot so we read what the API committed
    assert len(db.scalars(select(Client).where(Client.company_id == world.a.company.id, Client.company_name == "Orbit Logistics")).all()) == 1


def test_convert_needs_create_clients_unless_linking(client, world, db):
    admin = auth(world.a.admin)
    manager = auth(world.a.manager)
    existing = client.post("/api/v1/clients", json={"company_name": "Orbit Logistics"}, headers=admin).json()["data"]
    lead = make_lead(client, admin, company_name="Fresh Co", email="fresh@x.test")
    linkable = make_lead(client, admin, company_name="Orbit Logistics", email="o@x.test")
    with without_permission(db, "manager", "create_clients"):
        assert client.post(f"{BASE}/{lead['id']}/convert", json={}, headers=manager).status_code == 403
        assert client.post(f"{BASE}/{linkable['id']}/convert", json={"existing_client_id": existing["id"]}, headers=manager).status_code == 200
    db.rollback()  # end the fixture's old snapshot so we read what the API committed
    assert db.scalar(select(Lead.converted_client_id).where(Lead.id == lead["id"])) is None


def test_convert_is_atomic(client, world, db, monkeypatch):
    """If anything fails after the client was created, neither the client nor the lead change may persist."""
    from app.services import leads as leads_service

    real = leads_service.log_activity

    def exploding(db_, ctx, action, *args, **kwargs):
        if action == "converted":
            raise RuntimeError("audit log unavailable")
        return real(db_, ctx, action, *args, **kwargs)

    h = auth(world.a.admin)
    lead = make_lead(client, h)
    monkeypatch.setattr(leads_service, "log_activity", exploding)
    res = client.post(f"{BASE}/{lead['id']}/convert", json={}, headers=h)
    assert res.status_code == 500

    db.rollback()  # end the fixture's old snapshot so we read what the API committed
    assert db.scalars(select(Client).where(Client.company_id == world.a.company.id, Client.company_name == "Orbit Logistics")).first() is None
    row = db.get(Lead, lead["id"])
    assert row.status.value == "new" and row.converted_client_id is None and row.converted_at is None
    assert db.scalars(select(LeadActivity).where(LeadActivity.lead_id == lead["id"])).all() == []
    assert db.scalars(select(ActivityLog).where(ActivityLog.entity_type == "client")).all() == []

    monkeypatch.setattr(leads_service, "log_activity", real)  # and it works once the failure is gone
    assert client.post(f"{BASE}/{lead['id']}/convert", json={}, headers=h).status_code == 200


# ---- permissions & isolation -----------------------------------------------

def test_employee_and_client_have_no_lead_access(client, world):
    lead = make_lead(client, auth(world.a.admin))
    for user in (world.a.employee, world.a.client_user):
        h = auth(user)
        assert client.get(BASE, headers=h).status_code == 403
        assert client.get(f"{BASE}/pipeline", headers=h).status_code == 403
        assert client.get(f"{BASE}/{lead['id']}", headers=h).status_code == 403
        assert client.post(BASE, json=payload(), headers=h).status_code == 403
        assert client.put(f"{BASE}/{lead['id']}", json={"notes": "x"}, headers=h).status_code == 403
        assert client.delete(f"{BASE}/{lead['id']}", headers=h).status_code == 403
        assert client.post(f"{BASE}/{lead['id']}/activities", json={"activity_type": "note", "description": "x"}, headers=h).status_code == 403
        assert client.get(f"{BASE}/{lead['id']}/activities", headers=h).status_code == 403
        assert client.post(f"{BASE}/{lead['id']}/convert", headers=h).status_code == 403
    assert client.get(BASE).status_code == 401


def test_manager_sees_all_company_leads(client, world):
    make_lead(client, auth(world.a.admin), company_name="Admin's lead")
    make_lead(client, auth(world.a.manager), company_name="Manager's lead")
    listing = client.get(BASE, headers=auth(world.a.manager)).json()
    assert listing["total"] == 2


def test_company_isolation(client, world):
    a, b = auth(world.a.admin), auth(world.b.admin)
    lead = make_lead(client, a)
    url = f"{BASE}/{lead['id']}"
    assert client.get(url, headers=b).status_code == 404
    assert client.put(url, json={"notes": "x"}, headers=b).status_code == 404
    assert client.delete(url, headers=b).status_code == 404
    assert client.post(f"{url}/convert", headers=b).status_code == 404
    assert client.get(BASE, headers=b).json()["total"] == 0
    assert client.get(f"{BASE}/pipeline", headers=b).json()["data"]["total_count"] == 0
    assert client.get(url, headers=a).status_code == 200


def test_super_admin_needs_company_to_create(client, world):
    h = auth(world.super_admin)
    assert client.post(BASE, json=payload(), headers=h).status_code == 400
    ok = client.post(BASE, params={"company_id": world.a.company.id}, json=payload(), headers=h)
    assert ok.status_code == 201
    assert ok.json()["data"]["owner_id"] is None  # super admin belongs to no company, so cannot be the default owner


@pytest.mark.parametrize("status_", ["contacted", "negotiation"])
def test_status_change_is_audited_and_notifies_owner(client, world, db, status_):
    lead = make_lead(client, auth(world.a.manager))
    res = client.put(f"{BASE}/{lead['id']}", json={"status": status_}, headers=auth(world.a.admin))
    assert res.status_code == 200 and res.json()["data"]["status"] == status_
    db.rollback()  # end the fixture's old snapshot so we read what the API committed
    assert db.scalars(select(ActivityLog).where(ActivityLog.action == "status_changed", ActivityLog.entity_id == lead["id"])).one()
    note = db.scalars(select(Notification).where(Notification.user_id == world.a.manager.id)).one()
    assert status_ in note.message
