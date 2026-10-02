from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select

from app.core.enums import InvoiceStatus, QuotationStatus
from app.models import ActivityLog, Invoice, InvoiceItem, Quotation
from tests.conftest import auth
from tests.test_invoices import fresh, item, make_project

BASE = "/api/v1/quotations"
TODAY = date.today()
D = Decimal


def payload(client_id, **over):
    return {
        "client_id": client_id,
        "issue_date": TODAY.isoformat(),
        "valid_until": (TODAY + timedelta(days=30)).isoformat(),
        "notes": "Includes 3 months of support.",
        "items": [item(), item(description="App", quantity=1, unit_price="50.50", tax_rate=0)],
        **over,
    }


def make_quotation(client, headers, client_id, *, advance=None, **over) -> dict:
    res = client.post(BASE, json=payload(client_id, **over), headers=headers)
    assert res.status_code == 201, res.text
    data = res.json()["data"]
    for step in ({"sent": ["send"], "accepted": ["send", "accept"], "rejected": ["send", "reject"]}.get(advance, [])):
        res = client.post(f"{BASE}/{data['id']}/{step}", headers=headers)
        assert res.status_code == 200, res.text
        data = res.json()["data"]
    return data


def test_create_computes_totals_and_number(client, world):
    h = auth(world.a.admin)
    res = client.post(BASE, json=payload(world.a.client_record.id, additional_discount="6.50"), headers=h)
    assert res.status_code == 201, res.text
    q = res.json()["data"]
    assert q["quotation_number"] == f"QUO-{TODAY.year}-001" and q["status"] == "draft"
    assert D(q["subtotal"]) == D("250.50") and D(q["tax_amount"]) == D("36.00")  # 2 x 100 at 18%
    assert D(q["discount_amount"]) == D("6.50") and D(q["total_amount"]) == D("280.00")
    assert [D(i["total"]) for i in q["items"]] == [D("236.00"), D("50.50")]
    assert q["client_name"] == world.a.client_record.company_name and q["invoice_id"] is None
    second = make_quotation(client, h, world.a.client_record.id)
    assert second["quotation_number"] == f"QUO-{TODAY.year}-002"
    assert make_quotation(client, auth(world.b.admin), world.b.client_record.id)["quotation_number"] == f"QUO-{TODAY.year}-001"
    assert make_quotation(client, h, world.a.client_record.id, issue_date="2025-06-01", valid_until=None)["quotation_number"] == "QUO-2025-001"


def test_validation(client, world, db):
    h = auth(world.a.admin)
    cid = world.a.client_record.id
    for over in (
        {"items": []},
        {"items": [item(quantity=0)]},
        {"items": [item(discount="300")]},
        {"items": [item(tax_rate=150)]},
        {"additional_discount": "-1"},
        {"additional_discount": "9999"},
        {"valid_until": (TODAY - timedelta(days=1)).isoformat()},  # before issue_date
        {"total_amount": "5"},
        {"status": "accepted"},
        {"quotation_number": "QUO-1"},
    ):
        assert client.post(BASE, json=payload(cid, **over), headers=h).status_code == 422, over
    assert client.post(BASE, json=payload(world.b.client_record.id), headers=h).status_code == 404
    assert client.post(BASE, json=payload(cid, project_id=make_project(db, world.b, code="B-1").id), headers=h).status_code == 404
    assert client.post(BASE, json=payload(cid, valid_until=None), headers=h).status_code == 201
    assert fresh(db).scalar(select(func.count()).select_from(Quotation)) == 1


def test_update_rules_and_recalculation(client, world):
    h = auth(world.a.admin)
    q = make_quotation(client, h, world.a.client_record.id)
    res = client.put(f"{BASE}/{q['id']}", json={"items": [item(quantity=1, unit_price="1000", tax_rate=10)], "additional_discount": "100", "notes": "New"}, headers=h)
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert D(data["subtotal"]) == D("1000.00") and D(data["tax_amount"]) == D("100.00") and D(data["total_amount"]) == D("1000.00")
    assert len(data["items"]) == 1 and data["notes"] == "New"
    assert client.put(f"{BASE}/{q['id']}", json={"valid_until": (TODAY - timedelta(days=1)).isoformat()}, headers=h).status_code == 422
    assert client.put(f"{BASE}/{q['id']}", json={"items": []}, headers=h).status_code == 422
    assert client.put(f"{BASE}/{q['id']}", json={"client_id": None}, headers=h).status_code == 422
    assert client.put(f"{BASE}/{q['id']}", json={"client_id": world.b.client_record.id}, headers=h).status_code == 404

    client.post(f"{BASE}/{q['id']}/send", headers=h)
    assert client.put(f"{BASE}/{q['id']}", json={"notes": "still editable when sent"}, headers=h).status_code == 200
    client.post(f"{BASE}/{q['id']}/accept", headers=h)
    assert client.put(f"{BASE}/{q['id']}", json={"notes": "locked"}, headers=h).status_code == 409


def test_status_transitions_and_delete_rules(client, world, db):
    h = auth(world.a.admin)
    cid = world.a.client_record.id
    q = make_quotation(client, h, cid)
    for action in ("accept", "reject", "convert"):
        assert client.post(f"{BASE}/{q['id']}/{action}", headers=h).status_code == 409, action  # a draft is none of these
    assert client.post(f"{BASE}/{q['id']}/send", headers=h).json()["data"]["status"] == "sent"
    assert client.post(f"{BASE}/{q['id']}/send", headers=h).status_code == 409
    assert client.delete(f"{BASE}/{q['id']}", headers=h).status_code == 409
    assert client.post(f"{BASE}/{q['id']}/accept", headers=h).json()["data"]["status"] == "accepted"
    for action in ("send", "accept", "reject"):
        assert client.post(f"{BASE}/{q['id']}/{action}", headers=h).status_code == 409, action

    rejected = make_quotation(client, h, cid, advance="rejected")
    assert rejected["status"] == "rejected"
    for action in ("send", "accept", "reject", "convert"):
        assert client.post(f"{BASE}/{rejected['id']}/{action}", headers=h).status_code == 409, action
    assert client.put(f"{BASE}/{rejected['id']}", json={"notes": "x"}, headers=h).status_code == 409

    draft = make_quotation(client, h, cid)
    assert client.delete(f"{BASE}/{draft['id']}", headers=h).status_code == 200
    assert client.get(f"{BASE}/{draft['id']}", headers=h).status_code == 404
    actions = fresh(db).scalars(select(ActivityLog.action).where(ActivityLog.entity_type == "quotation", ActivityLog.entity_id == q["id"]).order_by(ActivityLog.id)).all()
    assert actions == ["created", "sent", "approved"]


def test_convert_creates_a_draft_invoice(client, world, db):
    h = auth(world.a.admin)
    project = make_project(db, world.a)
    q = make_quotation(client, h, world.a.client_record.id, advance="accepted", project_id=project.id, additional_discount="6.50")
    assert q["status"] == "accepted"

    res = client.post(f"{BASE}/{q['id']}/convert", headers=h)
    assert res.status_code == 200, res.text
    result = res.json()["data"]
    assert result["quotation_id"] == q["id"] and result["invoice_number"] == f"INV-{TODAY.year}-00001"

    inv = client.get(f"/api/v1/invoices/{result['invoice_id']}", headers=h).json()["data"]
    assert inv["status"] == "draft" and inv["quotation_id"] == q["id"]
    assert inv["client_id"] == world.a.client_record.id and inv["project_id"] == project.id
    assert inv["issue_date"] == TODAY.isoformat() and inv["due_date"] == (TODAY + timedelta(days=15)).isoformat()
    assert inv["notes"] == q["notes"] and inv["payment_terms"] == "Net 15"
    for field in ("subtotal", "discount_amount", "additional_discount", "tax_amount", "total_amount"):
        assert D(inv[field]) == D(q[field]), field
    assert D(inv["paid_amount"]) == 0 and D(inv["balance_amount"]) == D(q["total_amount"])
    assert [(i["description"], D(i["quantity"]), D(i["unit_price"]), D(i["tax_rate"]), D(i["discount"]), D(i["total"])) for i in inv["items"]] == [
        (i["description"], D(i["quantity"]), D(i["unit_price"]), D(i["tax_rate"]), D(i["discount"]), D(i["total"])) for i in q["items"]
    ]

    after = client.get(f"{BASE}/{q['id']}", headers=h).json()["data"]
    assert after["status"] == "converted" and after["invoice_id"] == result["invoice_id"] and after["invoice_number"] == result["invoice_number"]
    assert client.post(f"{BASE}/{q['id']}/convert", headers=h).status_code == 409  # only once
    assert "already" in client.post(f"{BASE}/{q['id']}/convert", headers=h).json()["message"]
    assert fresh(db).scalar(select(func.count()).select_from(Invoice)) == 1
    assert client.put(f"{BASE}/{q['id']}", json={"notes": "x"}, headers=h).status_code == 409
    assert client.delete(f"{BASE}/{q['id']}", headers=h).status_code == 409

    # the copied lines are independent rows, and the invoice audit + quotation audit rows exist
    assert db.scalar(select(func.count()).select_from(InvoiceItem).where(InvoiceItem.invoice_id == result["invoice_id"])) == 2
    assert db.scalar(select(func.count()).select_from(ActivityLog).where(ActivityLog.action == "converted", ActivityLog.entity_id == q["id"])) == 1
    assert db.scalar(select(func.count()).select_from(ActivityLog).where(ActivityLog.action == "created", ActivityLog.entity_type == "invoice", ActivityLog.entity_id == result["invoice_id"])) == 1
    assert db.get(Quotation, q["id"]).status == QuotationStatus.CONVERTED
    assert db.get(Invoice, result["invoice_id"]).status == InvoiceStatus.DRAFT


def test_a_sent_quotation_can_be_converted_and_numbers_follow_the_invoice_sequence(client, world):
    h = auth(world.a.admin)
    cid = world.a.client_record.id
    existing = client.post("/api/v1/invoices", json={"client_id": cid, "issue_date": TODAY.isoformat(), "due_date": TODAY.isoformat(), "items": [item()]}, headers=h).json()["data"]
    q = make_quotation(client, h, cid, advance="sent")
    result = client.post(f"{BASE}/{q['id']}/convert", headers=h).json()["data"]
    assert existing["invoice_number"].endswith("00001") and result["invoice_number"].endswith("00002")


def test_convert_is_atomic(client, world, db, monkeypatch):
    h = auth(world.a.admin)
    q = make_quotation(client, h, world.a.client_record.id, advance="accepted")

    def explode(*args, **kwargs):
        raise RuntimeError("audit down")

    monkeypatch.setattr("app.services.quotations.log_activity", explode)
    assert client.post(f"{BASE}/{q['id']}/convert", headers=h).status_code == 500
    fresh(db)
    assert db.scalar(select(func.count()).select_from(Invoice)) == 0
    assert db.get(Quotation, q["id"]).status == QuotationStatus.ACCEPTED
    monkeypatch.undo()
    assert client.post(f"{BASE}/{q['id']}/convert", headers=h).status_code == 200


def test_list_filters_search_sort(client, world, factory):
    h = auth(world.a.admin)
    other = factory.make_client(world.a.company, "Zenith Traders")
    q1 = make_quotation(client, h, world.a.client_record.id, items=[item(quantity=1, unit_price="100", tax_rate=0)])
    q2 = make_quotation(client, h, other.id, advance="sent", items=[item(quantity=1, unit_price="300", tax_rate=0)])
    q3 = make_quotation(client, h, other.id, items=[item(quantity=1, unit_price="200", tax_rate=0)])

    def ids(**params):
        res = client.get(BASE, params=params, headers=h)
        assert res.status_code == 200, res.text
        return [q["id"] for q in res.json()["data"]]

    assert ids() == [q3["id"], q2["id"], q1["id"]]
    assert ids(status="sent") == [q2["id"]]
    assert set(ids(client_id=other.id)) == {q2["id"], q3["id"]}
    assert ids(search="zenith") == [q3["id"], q2["id"]]
    assert ids(search=q1["quotation_number"]) == [q1["id"]]
    assert ids(sort_by="total_amount", sort_order="asc") == [q1["id"], q3["id"], q2["id"]]
    assert client.get(BASE, params={"sort_by": "notes"}, headers=h).status_code == 422
    row = client.get(BASE, headers=h).json()["data"][0]
    assert row["client_name"] == "Zenith Traders" and "items" not in row


def test_permission_matrix(client, world):
    admin = auth(world.a.admin)
    q = make_quotation(client, admin, world.a.client_record.id, advance="sent")
    url = f"{BASE}/{q['id']}"
    assert client.get(BASE).status_code == 401

    manager = auth(world.a.manager)  # view_quotations only
    assert client.get(BASE, headers=manager).status_code == 200
    assert client.get(url, headers=manager).status_code == 200
    assert client.post(BASE, json=payload(world.a.client_record.id), headers=manager).status_code == 403
    assert client.put(url, json={"notes": "x"}, headers=manager).status_code == 403
    assert client.delete(url, headers=manager).status_code == 403
    for action in ("send", "accept", "reject", "convert"):
        assert client.post(f"{url}/{action}", headers=manager).status_code == 403, action

    for user in (world.a.employee, world.a.client_user):  # quotations are internal
        h = auth(user)
        assert client.get(BASE, headers=h).status_code == 403
        assert client.get(url, headers=h).status_code == 403
        assert client.post(BASE, json=payload(world.a.client_record.id), headers=h).status_code == 403
        assert client.post(f"{url}/convert", headers=h).status_code == 403
    assert client.get(url, headers=admin).json()["data"]["status"] == "sent"


def test_company_isolation(client, world):
    a, b = auth(world.a.admin), auth(world.b.admin)
    q = make_quotation(client, a, world.a.client_record.id, advance="sent")
    url = f"{BASE}/{q['id']}"
    assert client.get(url, headers=b).status_code == 404
    assert client.put(url, json={"notes": "x"}, headers=b).status_code == 404
    assert client.delete(url, headers=b).status_code == 404
    for action in ("send", "accept", "reject", "convert"):
        assert client.post(f"{url}/{action}", headers=b).status_code == 404, action
    assert client.get(BASE, headers=b).json()["total"] == 0
    assert client.get(url, headers=a).json()["data"]["status"] == "sent"


def test_super_admin_needs_company_to_create(client, world):
    h = auth(world.super_admin)
    assert client.post(BASE, json=payload(world.a.client_record.id), headers=h).status_code == 400
    res = client.post(BASE, params={"company_id": world.a.company.id}, json=payload(world.a.client_record.id), headers=h)
    assert res.status_code == 201 and res.json()["data"]["company_id"] == world.a.company.id
