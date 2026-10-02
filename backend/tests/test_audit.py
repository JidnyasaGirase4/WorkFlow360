from datetime import UTC, datetime, timedelta

import pytest

from app.models import ActivityLog
from tests.conftest import auth

BASE = "/api/v1/audit-logs"


def fresh(db):
    db.rollback()
    return db


def add_log(db, company, user, action="created", entity_type="project", description="Did something", created_at=None) -> ActivityLog:
    row = ActivityLog(
        company_id=company.id if company else None, user_id=user.id if user else None, action=action,
        entity_type=entity_type, entity_id=1, description=description,
    )
    if created_at:
        row.created_at = created_at
    db.add(row)
    db.commit()
    return row


@pytest.mark.parametrize("role,expected", [("admin", 200), ("manager", 403), ("employee", 403), ("client_user", 403)])
def test_permission_matrix(client, world, role, expected):
    assert client.get(BASE, headers=auth(getattr(world.a, role))).status_code == expected


def test_super_admin_allowed_and_unauthenticated_rejected(client, world):
    assert client.get(BASE, headers=auth(world.super_admin)).status_code == 200
    assert client.get(BASE).status_code == 401


def test_log_is_read_only(client, world, db):
    row = add_log(db, world.a.company, world.a.admin)
    h = auth(world.a.admin)
    assert client.post(BASE, json={"action": "x"}, headers=h).status_code == 405
    assert client.put(f"{BASE}/{row.id}", json={"action": "x"}, headers=h).status_code == 405
    assert client.patch(f"{BASE}/{row.id}", json={"action": "x"}, headers=h).status_code == 405
    assert client.delete(f"{BASE}/{row.id}", headers=h).status_code == 405
    assert client.delete(f"{BASE}/{row.id}", headers=auth(world.super_admin)).status_code == 405


def test_company_isolation_and_super_admin_scoping(client, world, db):
    mine = add_log(db, world.a.company, world.a.admin, description="in A")
    theirs = add_log(db, world.b.company, world.b.admin, description="in B")
    platform = add_log(db, None, world.super_admin, description="platform level")

    a_rows = client.get(BASE, params={"limit": 100}, headers=auth(world.a.admin)).json()["data"]
    assert {r["id"] for r in a_rows} == {mine.id} and all(r["company_id"] == world.a.company.id for r in a_rows)
    assert client.get(f"{BASE}/{theirs.id}", headers=auth(world.a.admin)).status_code == 404
    assert client.get(f"{BASE}/{platform.id}", headers=auth(world.a.admin)).status_code == 404
    assert client.get(f"{BASE}/{mine.id}", headers=auth(world.a.admin)).status_code == 200

    sa = auth(world.super_admin)
    everything = {r["id"] for r in client.get(BASE, params={"limit": 100}, headers=sa).json()["data"]}
    assert {mine.id, theirs.id, platform.id} <= everything
    only_b = client.get(BASE, params={"limit": 100, "company_id": world.b.company.id}, headers=sa).json()["data"]
    assert {r["id"] for r in only_b} == {theirs.id}
    assert client.get(f"{BASE}/{theirs.id}", headers=sa).status_code == 200


def test_rows_include_user_name_and_newest_first(client, world, db):
    now = datetime.now(UTC).replace(tzinfo=None)
    old = add_log(db, world.a.company, world.a.manager, description="old", created_at=now - timedelta(days=3))
    new = add_log(db, world.a.company, world.a.admin, description="new", created_at=now)
    system = add_log(db, world.a.company, None, description="system", created_at=now - timedelta(days=1))
    rows = client.get(BASE, headers=auth(world.a.admin)).json()["data"]
    assert [r["id"] for r in rows] == [new.id, system.id, old.id]
    by_id = {r["id"]: r for r in rows}
    assert by_id[new.id]["user_name"] == world.a.admin.name and by_id[old.id]["user_name"] == world.a.manager.name
    assert by_id[system.id]["user_name"] is None and by_id[system.id]["user_id"] is None
    one = client.get(f"{BASE}/{old.id}", headers=auth(world.a.admin)).json()["data"]
    assert one["user_name"] == world.a.manager.name and one["description"] == "old"
    assert client.get(f"{BASE}/999999", headers=auth(world.a.admin)).status_code == 404
    asc = client.get(BASE, params={"sort_by": "created_at", "sort_order": "asc"}, headers=auth(world.a.admin)).json()["data"]
    assert [r["id"] for r in asc] == [old.id, system.id, new.id]
    assert client.get(BASE, params={"sort_by": "ip_address"}, headers=auth(world.a.admin)).status_code == 422


def test_filters(client, world, db):
    now = datetime.now(UTC).replace(tzinfo=None)
    a = add_log(db, world.a.company, world.a.admin, "created", "project", "Created project Apollo", now)
    b = add_log(db, world.a.company, world.a.manager, "updated", "task", "Updated task Design_100%", now - timedelta(days=10))
    c = add_log(db, world.a.company, world.a.manager, "deleted", "task", "Deleted task Old", now - timedelta(days=30))
    h = auth(world.a.admin)

    def ids(**params):
        return {r["id"] for r in client.get(BASE, params={"limit": 100, **params}, headers=h).json()["data"]}

    assert ids(user_id=world.a.manager.id) == {b.id, c.id}
    assert ids(entity_type="task") == {b.id, c.id}
    assert ids(action="created") == {a.id}
    assert ids(entity_type="task", action="deleted") == {c.id}
    assert ids(search="apollo") == {a.id}
    assert ids(search="100%") == {b.id}  # wildcard characters are matched literally
    assert ids(search="nothing-matches") == set()
    today = now.date()
    assert ids(date_from=(today - timedelta(days=15)).isoformat()) == {a.id, b.id}
    assert ids(date_to=(today - timedelta(days=15)).isoformat()) == {c.id}
    assert ids(date_from=(today - timedelta(days=15)).isoformat(), date_to=(today - timedelta(days=5)).isoformat()) == {b.id}
    assert ids(date_to=today.isoformat()) == {a.id, b.id, c.id}  # end day is inclusive
    assert client.get(BASE, params={"date_from": "yesterday"}, headers=h).status_code == 422


def test_pagination(client, world, db):
    for n in range(5):
        add_log(db, world.a.company, world.a.admin, description=f"row {n}")
    res = client.get(BASE, params={"limit": 2, "page": 3}, headers=auth(world.a.admin)).json()
    assert res["total"] == 5 and res["total_pages"] == 3 and len(res["data"]) == 1
    assert client.get(BASE, params={"limit": 101}, headers=auth(world.a.admin)).status_code == 422


def test_admin_actions_appear_in_the_audit_log_end_to_end(client, world, db):
    h = auth(world.a.admin)
    created = client.post("/api/v1/users", json={"name": "Audit Subject", "email": "subject@test.local", "password": "Strong123", "role": "employee"}, headers=h).json()["data"]
    client.patch(f"/api/v1/users/{created['id']}/status", json={"status": "suspended"}, headers=h)
    client.put("/api/v1/companies/me", json={"industry": "Education"}, headers=h)

    users = client.get(BASE, params={"entity_type": "user", "user_id": world.a.admin.id}, headers=h).json()["data"]
    assert {r["action"] for r in users} == {"created", "status_changed"}
    assert all(r["user_name"] == world.a.admin.name and r["entity_id"] == created["id"] for r in users)
    company = client.get(BASE, params={"entity_type": "company"}, headers=h).json()["data"]
    assert [r["action"] for r in company] == ["updated"] and company[0]["entity_id"] == world.a.company.id
    # b's admin sees none of it
    assert client.get(BASE, headers=auth(world.b.admin)).json()["total"] == 0
    assert fresh(db).query(ActivityLog).filter_by(company_id=world.a.company.id).count() == 3
