from tests.conftest import auth

BASE = "/api/v1/clients"


def payload(**over):
    return {"company_name": "Orbit Logistics", "email": "hello@orbit.test", "phone": "+91 98450 12233", "status": "active", **over}


def test_admin_crud_and_envelope(client, world):
    h = auth(world.a.admin)
    res = client.post(BASE, json=payload(contacts=[{"name": "Vikram Anand", "is_primary": True}]), headers=h)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["success"] is True and body["data"]["contacts"][0]["is_primary"] is True
    cid = body["data"]["id"]

    got = client.get(f"{BASE}/{cid}", headers=h).json()["data"]
    assert got["stats"]["projects"] == 0 and got["company_id"] == world.a.company.id

    upd = client.put(f"{BASE}/{cid}", json={"city": "Pune"}, headers=h)
    assert upd.status_code == 200 and upd.json()["data"]["city"] == "Pune"

    assert client.delete(f"{BASE}/{cid}", headers=h).status_code == 200
    assert client.get(f"{BASE}/{cid}", headers=h).status_code == 404


def test_list_is_paginated_searchable_sortable(client, world):
    h = auth(world.a.admin)
    for i in range(5):
        client.post(BASE, json=payload(company_name=f"Tech {i}", email=f"t{i}@x.test"), headers=h)
    res = client.get(BASE, params={"search": "tech", "limit": 2, "page": 2, "sort_by": "company_name", "sort_order": "asc"}, headers=h).json()
    assert res["total"] == 5 and res["page"] == 2 and res["limit"] == 2 and res["total_pages"] == 3
    assert [c["company_name"] for c in res["data"]] == ["Tech 2", "Tech 3"]
    assert client.get(BASE, params={"sort_by": "password_hash; DROP TABLE users"}, headers=h).status_code == 422
    assert client.get(BASE, params={"limit": 1000}, headers=h).status_code == 422


def test_duplicate_client_rejected(client, world):
    h = auth(world.a.admin)
    assert client.post(BASE, json=payload(), headers=h).status_code == 201
    assert client.post(BASE, json=payload(email="other@orbit.test"), headers=h).status_code == 409  # same name
    assert client.post(BASE, json=payload(company_name="Different"), headers=h).status_code == 409  # same email
    # a different company may use the same name
    assert client.post(BASE, json=payload(), headers=auth(world.b.admin)).status_code == 201


def test_company_isolation(client, world):
    a, b = auth(world.a.admin), auth(world.b.admin)
    cid = client.post(BASE, json=payload(), headers=a).json()["data"]["id"]
    assert client.get(f"{BASE}/{cid}", headers=b).status_code == 404
    assert client.put(f"{BASE}/{cid}", json={"city": "X"}, headers=b).status_code == 404
    assert client.delete(f"{BASE}/{cid}", headers=b).status_code == 404
    assert cid not in [c["id"] for c in client.get(BASE, headers=b).json()["data"]]


def test_permissions(client, world):
    # employee: no client access at all; manager: can create but not delete
    assert client.get(BASE, headers=auth(world.a.employee)).status_code == 403
    assert client.post(BASE, json=payload(), headers=auth(world.a.employee)).status_code == 403
    assert client.get(BASE).status_code == 401
    cid = client.post(BASE, json=payload(), headers=auth(world.a.manager)).json()["data"]["id"]
    assert client.delete(f"{BASE}/{cid}", headers=auth(world.a.manager)).status_code == 403


def test_client_user_sees_only_own_record(client, world):
    h = auth(world.a.client_user)
    assert client.get(BASE, headers=h).status_code == 403  # no view_clients: cannot list
    own = client.get(f"{BASE}/{world.a.client_record.id}", headers=h)
    assert own.status_code == 200
    assert client.get(f"{BASE}/{world.b.client_record.id}", headers=h).status_code == 404
    other_in_same_company = client.post(BASE, json=payload(), headers=auth(world.a.admin)).json()["data"]["id"]
    assert client.get(f"{BASE}/{other_in_same_company}", headers=h).status_code == 404
    assert client.put(f"{BASE}/{world.a.client_record.id}", json={"city": "X"}, headers=h).status_code == 403


def test_super_admin_needs_company_to_create(client, world):
    h = auth(world.super_admin)
    assert client.post(BASE, json=payload(), headers=h).status_code == 400
    ok = client.post(BASE, params={"company_id": world.a.company.id}, json=payload(), headers=h)
    assert ok.status_code == 201 and ok.json()["data"]["company_id"] == world.a.company.id
    assert client.get(BASE, headers=h).json()["total"] >= 2  # all companies when no company_id given


def test_contacts_single_primary(client, world):
    h = auth(world.a.admin)
    cid = client.post(BASE, json=payload(), headers=h).json()["data"]["id"]
    first = client.post(f"{BASE}/{cid}/contacts", json={"name": "Asha Rao", "is_primary": True}, headers=h).json()["data"]
    second = client.post(f"{BASE}/{cid}/contacts", json={"name": "Ravi Nair", "is_primary": True}, headers=h).json()["data"]
    contacts = client.get(f"{BASE}/{cid}/contacts", headers=h).json()["data"]
    assert {c["id"]: c["is_primary"] for c in contacts} == {first["id"]: False, second["id"]: True}
    assert client.delete(f"{BASE}/{cid}/contacts/{first['id']}", headers=h).status_code == 200


def test_validation(client, world):
    h = auth(world.a.admin)
    assert client.post(BASE, json=payload(email="bad"), headers=h).status_code == 422
    assert client.post(BASE, json=payload(phone="abc"), headers=h).status_code == 422
    assert client.post(BASE, json=payload(status="deleted"), headers=h).status_code == 422
    assert client.post(BASE, json=payload(company_id=99), headers=h).status_code == 422  # unknown fields rejected


def test_client_with_history_is_archived_not_deleted(client, world, db):
    from app.models import Project

    h = auth(world.a.admin)
    cid = client.post(BASE, json=payload(), headers=h).json()["data"]["id"]
    db.add(Project(company_id=world.a.company.id, client_id=cid, name="P", project_code="P-1"))
    db.commit()
    res = client.delete(f"{BASE}/{cid}", headers=h)
    assert res.status_code == 200 and "archived" in res.json()["message"]
    assert client.get(f"{BASE}/{cid}", headers=h).json()["data"]["status"] == "archived"

