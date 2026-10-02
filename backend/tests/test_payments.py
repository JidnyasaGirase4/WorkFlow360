from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.core.enums import InvoiceStatus, NotificationType
from app.main import app
from app.models import ActivityLog, Invoice, Notification, Payment
from tests.conftest import auth
from tests.test_invoices import fresh, make_invoice

BASE = "/api/v1/payments"
TODAY = date.today()
D = Decimal


def pay(invoice_id, amount="100", **over):
    return {"invoice_id": invoice_id, "amount": amount, "payment_date": TODAY.isoformat(), "payment_method": "bank_transfer", **over}


def sent_invoice(client, world, total_unit_price="1000", **over):
    """An issued invoice of exactly `total_unit_price` (one line, no tax)."""
    items = [{"description": "Work", "quantity": 1, "unit_price": total_unit_price, "tax_rate": 0, "discount": 0}]
    return make_invoice(client, auth(world.a.admin), world.a.client_record.id, send=True, items=items, **over)


def test_partial_then_full_payment_updates_the_invoice(client, world):
    h = auth(world.a.admin)
    inv = sent_invoice(client, world)

    first = client.post(BASE, json=pay(inv["id"], "400", payment_method="upi", reference_number="UPI-1", notes="advance"), headers=h)
    assert first.status_code == 201, first.text
    p1 = first.json()["data"]
    assert D(p1["amount"]) == D("400.00") and p1["payment_method"] == "upi" and p1["reference_number"] == "UPI-1"
    assert p1["invoice_number"] == inv["invoice_number"] and p1["client_id"] == world.a.client_record.id
    assert p1["client_name"] == world.a.client_record.company_name and p1["payment_number"].startswith("PAY-")
    assert p1["created_by"] == world.a.admin.id and p1["company_id"] == world.a.company.id
    after = client.get(f"/api/v1/invoices/{inv['id']}", headers=h).json()["data"]
    assert after["status"] == "partially_paid" and D(after["paid_amount"]) == D("400.00") and D(after["balance_amount"]) == D("600.00")

    second = client.post(BASE, json=pay(inv["id"], "600.00"), headers=h)
    assert second.status_code == 201
    after = client.get(f"/api/v1/invoices/{inv['id']}", headers=h).json()["data"]
    assert after["status"] == "paid" and D(after["paid_amount"]) == D("1000.00") and D(after["balance_amount"]) == 0
    assert after["payments_count"] == 2 and [D(p["amount"]) for p in after["payments"]] == [D("400.00"), D("600.00")]

    # a paid invoice takes no more money
    assert client.post(BASE, json=pay(inv["id"], "1"), headers=h).status_code == 409


def test_client_id_comes_from_the_invoice_and_unknown_fields_are_rejected(client, world):
    h = auth(world.a.admin)
    inv = sent_invoice(client, world)
    for extra in ({"client_id": world.b.client_record.id}, {"company_id": 2}, {"status": "paid"}, {"balance": "0"}):
        assert client.post(BASE, json=pay(inv["id"], **extra), headers=h).status_code == 422, extra
    assert client.get(f"/api/v1/invoices/{inv['id']}", headers=h).json()["data"]["payments_count"] == 0


def test_overpayment_is_rejected_with_the_balance_in_the_message(client, world, db):
    h = auth(world.a.admin)
    inv = sent_invoice(client, world, "500")
    res = client.post(BASE, json=pay(inv["id"], "500.01"), headers=h)
    assert res.status_code == 422
    assert "500.00" in res.json()["message"]
    client.post(BASE, json=pay(inv["id"], "200"), headers=h)
    res = client.post(BASE, json=pay(inv["id"], "300.01"), headers=h)
    assert res.status_code == 422 and "300.00" in res.json()["message"]
    assert fresh(db).scalar(select(func.count()).select_from(Payment)) == 1
    assert client.post(BASE, json=pay(inv["id"], "300.00"), headers=h).status_code == 201  # exactly the balance is fine


def test_invalid_payment_bodies(client, world):
    h = auth(world.a.admin)
    inv = sent_invoice(client, world)
    for over in (
        {"amount": "0"},
        {"amount": "-5"},
        {"amount": "10.999"},
        {"amount": "abc"},
        {"payment_method": "barter"},
        {"payment_date": (TODAY + timedelta(days=1)).isoformat()},
        {"payment_date": "yesterday"},
        {"reference_number": ""},
        {"reference_number": "x" * 81},
    ):
        assert client.post(BASE, json=pay(inv["id"], **over), headers=h).status_code == 422, over
    missing = pay(inv["id"])
    del missing["payment_method"]
    assert client.post(BASE, json=missing, headers=h).status_code == 422
    assert client.post(BASE, json=pay(inv["id"], payment_date=(TODAY - timedelta(days=30)).isoformat()), headers=h).status_code == 201  # past dates are fine
    assert client.post(BASE, json=pay(inv["id"], "1", payment_date=TODAY.isoformat()), headers=h).status_code == 201


def test_only_issued_open_invoices_accept_payments(client, world, db):
    h = auth(world.a.admin)
    cid = world.a.client_record.id
    draft = make_invoice(client, h, cid)
    assert client.post(BASE, json=pay(draft["id"]), headers=h).status_code == 409
    cancelled = make_invoice(client, h, cid, send=True)
    client.post(f"/api/v1/invoices/{cancelled['id']}/cancel", headers=h)
    assert client.post(BASE, json=pay(cancelled["id"]), headers=h).status_code == 409
    assert client.post(BASE, json=pay(999999), headers=h).status_code == 404
    assert fresh(db).scalar(select(func.count()).select_from(Payment)) == 0

    # an overdue invoice can still be paid
    late = make_invoice(client, h, cid, send=True, issue_date=(TODAY - timedelta(days=40)).isoformat(), due_date=(TODAY - timedelta(days=5)).isoformat())
    assert client.get("/api/v1/invoices", params={"status": "overdue"}, headers=h).json()["total"] == 1
    res = client.post(BASE, json=pay(late["id"], "50"), headers=h)
    assert res.status_code == 201
    assert fresh(db).get(Invoice, late["id"]).status == InvoiceStatus.PARTIALLY_PAID


def test_recording_a_payment_writes_audit_and_notifications(client, world, db):
    h = auth(world.a.admin)
    inv = sent_invoice(client, world, "300")
    pid = client.post(BASE, json=pay(inv["id"], "100"), headers=h).json()["data"]["id"]
    logs = fresh(db).scalars(select(ActivityLog).where(ActivityLog.entity_type == "payment")).all()
    assert [(log.action, log.entity_id, log.user_id, log.company_id) for log in logs] == [("created", pid, world.a.admin.id, world.a.company.id)]
    assert inv["invoice_number"] in logs[0].description
    notes = db.scalars(select(Notification).where(Notification.type == NotificationType.PAYMENT)).all()
    assert [(n.user_id, n.reference_type, n.reference_id) for n in notes] == [(world.a.client_user.id, "payment", pid)]  # the actor (also the creator) is not notified

    client.post(BASE, json=pay(inv["id"], "200"), headers=h)
    assert fresh(db).scalar(select(func.count()).select_from(ActivityLog).where(ActivityLog.entity_type == "invoice", ActivityLog.entity_id == inv["id"], ActivityLog.action == "status_changed")) == 1


def test_payment_is_atomic_when_a_later_step_fails(client, world, db, monkeypatch):
    h = auth(world.a.admin)
    inv = sent_invoice(client, world)

    def explode(*args, **kwargs):
        raise RuntimeError("notification service down")

    monkeypatch.setattr("app.services.payments.notify", explode)
    res = client.post(BASE, json=pay(inv["id"], "1000"), headers=h)  # would settle the invoice
    assert res.status_code == 500

    fresh(db)
    row = db.get(Invoice, inv["id"])
    assert row.status == InvoiceStatus.SENT and row.paid_amount == 0 and row.balance_amount == D("1000.00")
    assert db.scalar(select(func.count()).select_from(Payment)) == 0
    assert db.scalar(select(func.count()).select_from(ActivityLog).where(ActivityLog.entity_type == "payment")) == 0
    assert db.scalar(select(func.count()).select_from(ActivityLog).where(ActivityLog.action == "status_changed")) == 0
    monkeypatch.undo()
    assert client.post(BASE, json=pay(inv["id"], "1000"), headers=h).status_code == 201  # and it works once the failure is gone


def test_second_payment_cannot_exceed_what_is_left(client, world, db):
    h = auth(world.a.admin)
    inv = sent_invoice(client, world, "100")
    assert client.post(BASE, json=pay(inv["id"], "70"), headers=h).status_code == 201
    assert client.post(BASE, json=pay(inv["id"], "70"), headers=h).status_code == 422  # only 30 left
    assert client.post(BASE, json=pay(inv["id"], "30"), headers=h).status_code == 201
    row = fresh(db).get(Invoice, inv["id"])
    assert row.paid_amount == D("100.00") and row.balance_amount == 0 and row.status == InvoiceStatus.PAID


def test_concurrent_payments_cannot_double_pay(client, world, db):
    inv = sent_invoice(client, world, "100")
    headers = auth(world.a.admin)

    def attempt(_):
        with TestClient(app, raise_server_exceptions=False) as c:
            return c.post(BASE, json=pay(inv["id"], "100"), headers=headers).status_code

    with ThreadPoolExecutor(max_workers=4) as pool:
        codes = sorted(pool.map(attempt, range(4)))
    assert codes == [201, 409, 409, 409]
    fresh(db)
    assert db.scalar(select(func.count()).select_from(Payment)) == 1
    row = db.get(Invoice, inv["id"])
    assert row.paid_amount == D("100.00") and row.status == InvoiceStatus.PAID


def test_ledger_has_no_update_or_delete(client, world):
    h = auth(world.a.admin)
    pid = client.post(BASE, json=pay(sent_invoice(client, world)["id"]), headers=h).json()["data"]["id"]
    assert client.put(f"{BASE}/{pid}", json={"amount": "1"}, headers=h).status_code == 405
    assert client.patch(f"{BASE}/{pid}", json={"amount": "1"}, headers=h).status_code == 405
    assert client.delete(f"{BASE}/{pid}", headers=h).status_code == 405


def test_list_filters_and_detail(client, world, factory):
    h = auth(world.a.admin)
    other = factory.make_client(world.a.company, "Zenith Traders")
    inv1 = sent_invoice(client, world)
    inv2 = make_invoice(client, h, other.id, send=True, items=[{"description": "W", "quantity": 1, "unit_price": "500", "tax_rate": 0, "discount": 0}])
    p1 = client.post(BASE, json=pay(inv1["id"], "100", payment_method="cash", payment_date=(TODAY - timedelta(days=10)).isoformat(), reference_number="CASH-77"), headers=h).json()["data"]
    p2 = client.post(BASE, json=pay(inv1["id"], "200", payment_method="upi", reference_number="UPI-88"), headers=h).json()["data"]
    p3 = client.post(BASE, json=pay(inv2["id"], "300", payment_method="upi", payment_date=(TODAY - timedelta(days=3)).isoformat()), headers=h).json()["data"]

    def ids(**params):
        res = client.get(BASE, params=params, headers=h)
        assert res.status_code == 200, res.text
        return [p["id"] for p in res.json()["data"]]

    assert ids() == [p2["id"], p3["id"], p1["id"]]  # newest payment date first
    assert set(ids(invoice_id=inv1["id"])) == {p1["id"], p2["id"]}
    assert ids(client_id=other.id) == [p3["id"]]
    assert set(ids(payment_method="upi")) == {p2["id"], p3["id"]}
    assert ids(date_from=(TODAY - timedelta(days=5)).isoformat()) == [p2["id"], p3["id"]]
    assert ids(date_to=(TODAY - timedelta(days=5)).isoformat()) == [p1["id"]]
    assert ids(search="cash-7") == [p1["id"]]
    assert ids(search=inv2["invoice_number"]) == [p3["id"]]
    assert ids(sort_by="amount", sort_order="asc") == [p1["id"], p2["id"], p3["id"]]
    assert client.get(BASE, params={"sort_by": "notes"}, headers=h).status_code == 422
    assert client.get(BASE, params={"payment_method": "gold"}, headers=h).status_code == 422
    page = client.get(BASE, params={"limit": 2}, headers=h).json()
    assert page["total"] == 3 and page["total_pages"] == 2 and len(page["data"]) == 2

    got = client.get(f"{BASE}/{p1['id']}", headers=h)
    assert got.status_code == 200 and got.json()["data"]["reference_number"] == "CASH-77"
    assert client.get(f"{BASE}/999999", headers=h).status_code == 404


def test_permission_matrix(client, world):
    admin = auth(world.a.admin)
    inv = sent_invoice(client, world)
    pid = client.post(BASE, json=pay(inv["id"], "10"), headers=admin).json()["data"]["id"]

    assert client.get(BASE).status_code == 401
    assert client.post(BASE, json=pay(inv["id"])).status_code == 401

    manager = auth(world.a.manager)  # view_payments only
    assert client.get(BASE, headers=manager).status_code == 200
    assert client.get(f"{BASE}/{pid}", headers=manager).status_code == 200
    assert client.post(BASE, json=pay(inv["id"]), headers=manager).status_code == 403

    employee = auth(world.a.employee)
    assert client.get(BASE, headers=employee).status_code == 403
    assert client.get(f"{BASE}/{pid}", headers=employee).status_code == 403
    assert client.post(BASE, json=pay(inv["id"]), headers=employee).status_code == 403

    customer = auth(world.a.client_user)
    assert client.get(f"{BASE}/{pid}", headers=customer).status_code == 200
    assert client.post(BASE, json=pay(inv["id"]), headers=customer).status_code == 403


def test_client_user_sees_only_own_payments(client, world, factory):
    admin = auth(world.a.admin)
    other = factory.make_client(world.a.company, "Other Co")
    mine = client.post(BASE, json=pay(sent_invoice(client, world)["id"], "10"), headers=admin).json()["data"]
    other_inv = make_invoice(client, admin, other.id, send=True)
    others = client.post(BASE, json=pay(other_inv["id"], "10"), headers=admin).json()["data"]
    b_inv = make_invoice(client, auth(world.b.admin), world.b.client_record.id, send=True)
    theirs_b = client.post(BASE, json=pay(b_inv["id"], "10"), headers=auth(world.b.admin)).json()["data"]

    h = auth(world.a.client_user)
    listed = client.get(BASE, headers=h).json()
    assert [p["id"] for p in listed["data"]] == [mine["id"]] and listed["total"] == 1
    assert client.get(BASE, params={"client_id": other.id}, headers=h).json()["total"] == 0
    assert client.get(f"{BASE}/{mine['id']}", headers=h).status_code == 200
    assert client.get(f"{BASE}/{others['id']}", headers=h).status_code == 404
    assert client.get(f"{BASE}/{theirs_b['id']}", headers=h).status_code == 404


def test_company_isolation(client, world):
    a, b = auth(world.a.admin), auth(world.b.admin)
    inv = sent_invoice(client, world)
    pid = client.post(BASE, json=pay(inv["id"], "10"), headers=a).json()["data"]["id"]
    assert client.post(BASE, json=pay(inv["id"], "10"), headers=b).status_code == 404  # cannot pay another company's invoice
    assert client.get(f"{BASE}/{pid}", headers=b).status_code == 404
    assert client.get(BASE, headers=b).json()["total"] == 0
    assert client.get(BASE, params={"invoice_id": inv["id"]}, headers=b).json()["total"] == 0
    assert D(client.get(f"/api/v1/invoices/{inv['id']}", headers=a).json()["data"]["paid_amount"]) == D("10.00")


def test_super_admin_can_pay_and_list_across_companies(client, world):
    inv = sent_invoice(client, world)
    root = auth(world.super_admin)
    assert client.get(BASE, headers=root).status_code == 200
    res = client.post(BASE, params={"company_id": world.a.company.id}, json=pay(inv["id"], "10"), headers=root)
    assert res.status_code == 201 and res.json()["data"]["company_id"] == world.a.company.id
    assert client.post(BASE, params={"company_id": world.b.company.id}, json=pay(inv["id"], "10"), headers=root).status_code == 404
    assert client.post(BASE, json=pay(inv["id"], "10"), headers=root).status_code == 400
