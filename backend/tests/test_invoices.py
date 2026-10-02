from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select

from app.core.enums import InvoiceStatus, NotificationType, RoleName
from app.models import ActivityLog, Invoice, Notification, Payment, Project
from app.services import invoices as invoice_service
from tests.conftest import auth

BASE = "/api/v1/invoices"
TODAY = date.today()
D = Decimal


def item(**over):
    return {"description": "Design work", "quantity": 2, "unit_price": "100.00", "tax_rate": 18, "discount": 0, **over}


def payload(client_id, **over):
    return {
        "client_id": client_id,
        "issue_date": TODAY.isoformat(),
        "due_date": (TODAY + timedelta(days=15)).isoformat(),
        "payment_terms": "Net 15",
        "items": [item()],
        **over,
    }


def make_invoice(client, headers, client_id, *, send=False, **over) -> dict:
    res = client.post(BASE, json=payload(client_id, **over), headers=headers)
    assert res.status_code == 201, res.text
    data = res.json()["data"]
    if send:
        res = client.post(f"{BASE}/{data['id']}/send", headers=headers)
        assert res.status_code == 200, res.text
        data = res.json()["data"]
    return data


def make_project(db, tenant, client_record=None, code="P-1"):
    project = Project(company_id=tenant.company.id, client_id=(client_record or tenant.client_record).id, name=f"Project {code}", project_code=code)
    db.add(project)
    db.commit()
    return project


def fresh(db):
    db.rollback()  # end the open snapshot so we read what the API committed
    return db


def test_create_computes_totals_server_side(client, world):
    h = auth(world.a.admin)
    res = client.post(BASE, json=payload(world.a.client_record.id, additional_discount="10", items=[item(discount="20"), item(description="Extra", quantity=1, unit_price="50.50", tax_rate=0)]), headers=h)
    assert res.status_code == 201, res.text
    inv = res.json()["data"]
    # line 1: gross 200, discount 20, taxable 180, tax 32.40, total 212.40; line 2: 50.50
    assert D(inv["subtotal"]) == D("250.50")
    assert D(inv["discount_amount"]) == D("30.00")  # 20 line + 10 additional
    assert D(inv["additional_discount"]) == D("10.00")
    assert D(inv["tax_amount"]) == D("32.40")
    assert D(inv["total_amount"]) == D("252.90")
    assert D(inv["paid_amount"]) == 0 and D(inv["balance_amount"]) == D("252.90")
    assert inv["status"] == "draft" and inv["created_by"] == world.a.admin.id
    assert inv["client_name"] == world.a.client_record.company_name and inv["project_name"] is None
    assert [D(i["total"]) for i in inv["items"]] == [D("212.40"), D("50.50")]
    assert inv["payments"] == [] and inv["payments_count"] == 0
    assert [a["action"] for a in inv["activity"]] == ["created"]
    assert inv["activity"][0]["actor"] == world.a.admin.name


def test_client_supplied_totals_and_status_are_rejected(client, world, db):
    h = auth(world.a.admin)
    for extra in ({"total_amount": "1"}, {"subtotal": "1"}, {"balance_amount": "0"}, {"paid_amount": "5"}, {"status": "paid"}, {"invoice_number": "INV-1"}, {"company_id": 9}):
        assert client.post(BASE, json=payload(world.a.client_record.id, **extra), headers=h).status_code == 422, extra
    bad_line = item(total="1")
    assert client.post(BASE, json=payload(world.a.client_record.id, items=[bad_line]), headers=h).status_code == 422
    assert fresh(db).scalar(select(func.count()).select_from(Invoice)) == 0


def test_number_sequence_is_per_company_and_year(client, world):
    a, b = auth(world.a.admin), auth(world.b.admin)
    first = make_invoice(client, a, world.a.client_record.id)
    second = make_invoice(client, a, world.a.client_record.id)
    other_company = make_invoice(client, b, world.b.client_record.id)
    last_year = make_invoice(client, a, world.a.client_record.id, issue_date="2025-03-01", due_date="2025-03-15")
    assert first["invoice_number"] == f"INV-{TODAY.year}-00001"
    assert second["invoice_number"] == f"INV-{TODAY.year}-00002"
    assert other_company["invoice_number"] == f"INV-{TODAY.year}-00001"
    assert last_year["invoice_number"] == "INV-2025-00001"


def test_number_collision_is_retried_once(client, world, monkeypatch):
    h = auth(world.a.admin)
    existing = make_invoice(client, h, world.a.client_record.id)
    real = invoice_service.next_number
    calls = []

    def racing(*args, **kwargs):
        calls.append(1)
        return existing["invoice_number"] if len(calls) == 1 else real(*args, **kwargs)  # first attempt loses the race

    monkeypatch.setattr(invoice_service, "next_number", racing)
    res = client.post(BASE, json=payload(world.a.client_record.id), headers=h)
    assert res.status_code == 201 and res.json()["data"]["invoice_number"] == f"INV-{TODAY.year}-00002"
    assert len(calls) == 2

    monkeypatch.setattr(invoice_service, "next_number", lambda *a, **k: existing["invoice_number"])  # always colliding
    assert client.post(BASE, json=payload(world.a.client_record.id), headers=h).status_code == 409


def test_validation_errors(client, world):
    h = auth(world.a.admin)
    cid = world.a.client_record.id
    cases = [
        {"items": []},
        {"items": [item(quantity=0)]},
        {"items": [item(quantity=-2)]},
        {"items": [item(unit_price="-1")]},
        {"items": [item(tax_rate=101)]},
        {"items": [item(tax_rate=-1)]},
        {"items": [item(discount="200.01")]},  # discount above the line amount (2 x 100)
        {"items": [item(discount="-1")]},
        {"items": [item(description="")]},
        {"items": [item(unit_price="10.005")]},
        {"additional_discount": "-1"},
        {"additional_discount": "500"},  # would make the total negative
        {"due_date": (TODAY - timedelta(days=1)).isoformat()},
        {"issue_date": "not-a-date"},
    ]
    for over in cases:
        res = client.post(BASE, json=payload(cid, **over), headers=h)
        assert res.status_code == 422, (over, res.text)
    missing = payload(cid)
    del missing["items"]
    assert client.post(BASE, json=missing, headers=h).status_code == 422
    # a discount equal to the whole line is fine
    assert client.post(BASE, json=payload(cid, items=[item(discount="200")]), headers=h).status_code == 201


def test_client_and_project_must_belong_to_the_company_and_client(client, world, db, factory):
    h = auth(world.a.admin)
    assert client.post(BASE, json=payload(world.b.client_record.id), headers=h).status_code == 404
    assert client.post(BASE, json=payload(99999), headers=h).status_code == 404

    own = make_project(db, world.a, code="A-1")
    foreign = make_project(db, world.b, code="B-1")
    other_client = factory.make_client(world.a.company, "Second client")
    other_project = make_project(db, world.a, other_client, code="A-2")
    cid = world.a.client_record.id

    ok = client.post(BASE, json=payload(cid, project_id=own.id), headers=h)
    assert ok.status_code == 201 and ok.json()["data"]["project_name"] == own.name
    assert client.post(BASE, json=payload(cid, project_id=foreign.id), headers=h).status_code == 404
    assert client.post(BASE, json=payload(cid, project_id=other_project.id), headers=h).status_code == 422
    # same rules on update
    inv = ok.json()["data"]["id"]
    assert client.put(f"{BASE}/{inv}", json={"project_id": foreign.id}, headers=h).status_code == 404
    assert client.put(f"{BASE}/{inv}", json={"project_id": other_project.id}, headers=h).status_code == 422
    assert client.put(f"{BASE}/{inv}", json={"client_id": world.b.client_record.id}, headers=h).status_code == 404
    assert client.put(f"{BASE}/{inv}", json={"client_id": other_client.id}, headers=h).status_code == 422  # project stays with the old client
    moved = client.put(f"{BASE}/{inv}", json={"client_id": other_client.id, "project_id": other_project.id}, headers=h)
    assert moved.status_code == 200 and moved.json()["data"]["client_name"] == "Second client"
    assert moved.json()["data"]["project_name"] == other_project.name


def test_edit_recalculates_everything_and_replaces_items(client, world):
    h = auth(world.a.admin)
    inv = make_invoice(client, h, world.a.client_record.id)
    assert D(inv["total_amount"]) == D("236.00")
    old_item_ids = {i["id"] for i in inv["items"]}

    res = client.put(f"{BASE}/{inv['id']}", json={"items": [item(quantity=1, unit_price="1000", tax_rate=5), item(description="B", quantity=3, unit_price="10", tax_rate=0)], "additional_discount": "30", "notes": "Updated", "due_date": (TODAY + timedelta(days=30)).isoformat()}, headers=h)
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert D(data["subtotal"]) == D("1030.00") and D(data["tax_amount"]) == D("50.00")
    assert D(data["discount_amount"]) == D("30.00") and D(data["total_amount"]) == D("1050.00") and D(data["balance_amount"]) == D("1050.00")
    assert len(data["items"]) == 2 and not old_item_ids & {i["id"] for i in data["items"]}
    assert data["notes"] == "Updated" and data["invoice_number"] == inv["invoice_number"]
    assert "updated" in [a["action"] for a in data["activity"]]

    # changing only the additional discount re-derives totals from the stored lines
    res = client.put(f"{BASE}/{inv['id']}", json={"additional_discount": "0"}, headers=h)
    assert D(res.json()["data"]["total_amount"]) == D("1080.00")

    # invalid edits are rejected and change nothing
    assert client.put(f"{BASE}/{inv['id']}", json={"items": [item(quantity=0)]}, headers=h).status_code == 422
    assert client.put(f"{BASE}/{inv['id']}", json={"items": []}, headers=h).status_code == 422
    assert client.put(f"{BASE}/{inv['id']}", json={"due_date": (TODAY - timedelta(days=3)).isoformat()}, headers=h).status_code == 422
    assert client.put(f"{BASE}/{inv['id']}", json={"additional_discount": "5000"}, headers=h).status_code == 422
    assert client.put(f"{BASE}/{inv['id']}", json={"total_amount": "1"}, headers=h).status_code == 422
    assert client.put(f"{BASE}/{inv['id']}", json={"client_id": None}, headers=h).status_code == 422
    assert D(client.get(f"{BASE}/{inv['id']}", headers=h).json()["data"]["total_amount"]) == D("1080.00")


def test_editing_rules_by_status(client, world, db):
    h = auth(world.a.admin)
    cid = world.a.client_record.id
    sent = make_invoice(client, h, cid, send=True)
    res = client.put(f"{BASE}/{sent['id']}", json={"items": [item(quantity=1, unit_price="500", tax_rate=0)]}, headers=h)
    assert res.status_code == 200 and res.json()["data"]["status"] == "sent" and D(res.json()["data"]["balance_amount"]) == D("500.00")

    for status in ("partially_paid", "paid", "cancelled"):
        inv = make_invoice(client, h, cid, send=True)
        row = fresh(db).get(Invoice, inv["id"])
        row.status = InvoiceStatus(status)
        row.paid_amount = D("10") if status in ("partially_paid", "paid") else D("0")
        db.commit()
        assert client.put(f"{BASE}/{inv['id']}", json={"notes": "x"}, headers=h).status_code == 409, status
    # a sent invoice that already has money against it cannot be edited even if its status is stale
    stale = make_invoice(client, h, cid, send=True)
    row = fresh(db).get(Invoice, stale["id"])
    row.paid_amount = D("5")
    db.commit()
    assert client.put(f"{BASE}/{stale['id']}", json={"notes": "x"}, headers=h).status_code == 409


def test_status_transitions(client, world, db):
    h = auth(world.a.admin)
    cid = world.a.client_record.id
    inv = make_invoice(client, h, cid)
    assert client.post(f"{BASE}/{inv['id']}/send", headers=h).json()["data"]["status"] == "sent"
    assert client.post(f"{BASE}/{inv['id']}/send", headers=h).status_code == 409  # not a draft any more
    assert client.delete(f"{BASE}/{inv['id']}", headers=h).status_code == 409
    assert "cancel" in client.delete(f"{BASE}/{inv['id']}", headers=h).json()["message"].lower()
    cancelled = client.post(f"{BASE}/{inv['id']}/cancel", headers=h)
    assert cancelled.status_code == 200 and cancelled.json()["data"]["status"] == "cancelled"
    assert client.post(f"{BASE}/{inv['id']}/cancel", headers=h).status_code == 409
    assert client.post(f"{BASE}/{inv['id']}/send", headers=h).status_code == 409

    # drafts can be deleted (and then are gone), and cancelled as well
    draft = make_invoice(client, h, cid)
    assert client.delete(f"{BASE}/{draft['id']}", headers=h).status_code == 200
    assert client.get(f"{BASE}/{draft['id']}", headers=h).status_code == 404
    draft2 = make_invoice(client, h, cid)
    assert client.post(f"{BASE}/{draft2['id']}/cancel", headers=h).json()["data"]["status"] == "cancelled"

    # an invoice with a payment (or already paid) cannot be cancelled
    paid_some = make_invoice(client, h, cid, send=True)
    assert client.post("/api/v1/payments", json={"invoice_id": paid_some["id"], "amount": "10", "payment_date": TODAY.isoformat(), "payment_method": "cash"}, headers=h).status_code == 201
    assert client.post(f"{BASE}/{paid_some['id']}/cancel", headers=h).status_code == 409
    assert client.delete(f"{BASE}/{paid_some['id']}", headers=h).status_code == 409
    row = fresh(db).get(Invoice, paid_some["id"])
    assert row.status == InvoiceStatus.PARTIALLY_PAID

    logged = fresh(db).scalars(select(ActivityLog.action).where(ActivityLog.entity_type == "invoice", ActivityLog.entity_id == inv["id"]).order_by(ActivityLog.id)).all()
    assert logged == ["created", "sent", "status_changed"]


def test_send_requires_items_and_a_positive_total(client, world):
    h = auth(world.a.admin)
    free = make_invoice(client, h, world.a.client_record.id, items=[item(unit_price="0", tax_rate=0)])
    assert D(free["total_amount"]) == 0
    res = client.post(f"{BASE}/{free['id']}/send", headers=h)
    assert res.status_code == 422
    assert client.get(f"{BASE}/{free['id']}", headers=h).json()["data"]["status"] == "draft"


def test_send_notifies_client_users_and_audits(client, world, db):
    h = auth(world.a.admin)
    inv = make_invoice(client, h, world.a.client_record.id)
    assert fresh(db).scalar(select(func.count()).select_from(Notification)) == 0  # drafts are not announced
    client.post(f"{BASE}/{inv['id']}/send", headers=h)
    rows = fresh(db).scalars(select(Notification)).all()
    assert [(n.user_id, n.type, n.reference_type, n.reference_id) for n in rows] == [(world.a.client_user.id, NotificationType.INVOICE, "invoice", inv["id"])]
    assert inv["invoice_number"] in rows[0].title
    assert db.scalar(select(func.count()).select_from(ActivityLog).where(ActivityLog.action == "sent", ActivityLog.entity_id == inv["id"])) == 1


def test_overdue_is_reconciled_on_read(client, world, db):
    h = auth(world.a.admin)
    cid = world.a.client_record.id
    past = {"issue_date": (TODAY - timedelta(days=40)).isoformat(), "due_date": (TODAY - timedelta(days=10)).isoformat()}
    late = make_invoice(client, h, cid, send=True, **past)
    assert late["status"] == "sent"  # stored as sent until someone reads the invoices
    on_time = make_invoice(client, h, cid, send=True)
    draft_late = make_invoice(client, h, cid, **past)  # drafts never become overdue

    listed = client.get(BASE, params={"status": "overdue"}, headers=h).json()
    assert [i["id"] for i in listed["data"]] == [late["id"]]
    assert [i["id"] for i in client.get(BASE, params={"overdue": "true"}, headers=h).json()["data"]] == [late["id"]]
    assert client.get(f"{BASE}/{on_time['id']}", headers=h).json()["data"]["status"] == "sent"
    assert client.get(f"{BASE}/{draft_late['id']}", headers=h).json()["data"]["status"] == "draft"

    # detail read also reconciles
    another = make_invoice(client, h, cid, send=True, **past)
    assert client.get(f"{BASE}/{another['id']}", headers=h).json()["data"]["status"] == "overdue"

    # moving the due date out brings it back to sent
    res = client.put(f"{BASE}/{late['id']}", json={"due_date": (TODAY + timedelta(days=5)).isoformat()}, headers=h)
    assert res.status_code == 200 and res.json()["data"]["status"] == "sent"

    # a part-paid past-due invoice is overdue, and returns to partially_paid if its due date is in the future again
    partial = make_invoice(client, h, cid, send=True, **past)
    assert client.post("/api/v1/payments", json={"invoice_id": partial["id"], "amount": "10", "payment_date": TODAY.isoformat(), "payment_method": "upi"}, headers=h).status_code == 201
    assert client.get(f"{BASE}/{partial['id']}", headers=h).json()["data"]["status"] == "overdue"
    row = fresh(db).get(Invoice, partial["id"])
    row.due_date = TODAY + timedelta(days=3)
    db.commit()
    assert client.get(f"{BASE}/{partial['id']}", headers=h).json()["data"]["status"] == "partially_paid"


def test_refresh_overdue_helpers_are_company_scoped(client, world, db):
    def raw(tenant, number, status, due, paid="0"):
        row = Invoice(
            company_id=tenant.company.id, client_id=tenant.client_record.id, invoice_number=number, issue_date=due - timedelta(days=10), due_date=due,
            subtotal=100, total_amount=100, paid_amount=D(paid), balance_amount=100 - D(paid), status=status,
        )
        db.add(row)
        db.commit()
        return row.id

    yesterday = TODAY - timedelta(days=1)
    a_late = raw(world.a, "X-1", InvoiceStatus.SENT, yesterday)
    b_late = raw(world.b, "X-1", InvoiceStatus.PARTIALLY_PAID, yesterday, "40")
    a_paid = raw(world.a, "X-2", InvoiceStatus.PAID, yesterday, "100")
    a_stale_overdue = raw(world.a, "X-3", InvoiceStatus.OVERDUE, TODAY + timedelta(days=2))

    from app.core.deps import Ctx

    ctx = Ctx(db=db, user=world.a.admin, role="company_admin", permissions=frozenset(), company_id=world.a.company.id)
    assert invoice_service.refresh_overdue(db, ctx) == 2
    status = lambda i: fresh(db).get(Invoice, i).status  # noqa: E731
    assert status(a_late) == InvoiceStatus.OVERDUE and status(a_stale_overdue) == InvoiceStatus.SENT
    assert status(a_paid) == InvoiceStatus.PAID and status(b_late) == InvoiceStatus.PARTIALLY_PAID  # company B untouched

    assert invoice_service.refresh_overdue_all(db) == 1
    assert status(b_late) == InvoiceStatus.OVERDUE
    assert invoice_service.refresh_overdue_all(db) == 0  # idempotent


def test_list_filters_search_sort_and_pagination(client, world, factory):
    h = auth(world.a.admin)
    other = factory.make_client(world.a.company, "Zenith Traders")
    first = make_invoice(client, h, world.a.client_record.id, issue_date="2027-01-10", due_date="2027-01-20", items=[item(quantity=1, unit_price="100", tax_rate=0)])
    second = make_invoice(client, h, other.id, send=True, issue_date="2027-02-10", due_date="2027-02-25", items=[item(quantity=1, unit_price="300", tax_rate=0)])
    third = make_invoice(client, h, other.id, issue_date="2027-03-10", due_date="2027-03-30", items=[item(quantity=1, unit_price="200", tax_rate=0)])

    def ids(**params):
        res = client.get(BASE, params=params, headers=h)
        assert res.status_code == 200, res.text
        return [i["id"] for i in res.json()["data"]]

    assert set(ids()) == {first["id"], second["id"], third["id"]}
    assert ids(status="sent") == [second["id"]]
    assert set(ids(client_id=other.id)) == {second["id"], third["id"]}
    assert ids(search="zenith") == [third["id"], second["id"]]
    assert ids(search=first["invoice_number"]) == [first["id"]]
    assert ids(search="no such client") == []
    assert ids(issue_date_from="2027-02-01", issue_date_to="2027-02-28") == [second["id"]]
    assert set(ids(due_date_from="2027-02-25")) == {second["id"], third["id"]}
    assert ids(due_date_to="2027-01-31") == [first["id"]]
    assert ids(sort_by="total_amount", sort_order="asc") == [first["id"], third["id"], second["id"]]
    assert ids(sort_by="due_date", sort_order="desc") == [third["id"], second["id"], first["id"]]
    assert ids(sort_by="invoice_number", sort_order="asc") == [first["id"], second["id"], third["id"]]

    page = client.get(BASE, params={"limit": 2, "page": 2, "sort_by": "issue_date", "sort_order": "asc"}, headers=h).json()
    assert page["total"] == 3 and page["total_pages"] == 2 and [i["id"] for i in page["data"]] == [third["id"]]
    row = client.get(BASE, params={"search": first["invoice_number"]}, headers=h).json()["data"][0]
    assert row["client_name"] == world.a.client_record.company_name and row["payments_count"] == 0 and "items" not in row

    assert client.get(BASE, params={"sort_by": "password_hash"}, headers=h).status_code == 422
    assert client.get(BASE, params={"status": "bogus"}, headers=h).status_code == 422
    assert client.get(BASE, params={"limit": 101}, headers=h).status_code == 422


def test_items_and_payments_endpoints(client, world):
    h = auth(world.a.admin)
    inv = make_invoice(client, h, world.a.client_record.id, send=True, items=[item(), item(description="Second", quantity=1, unit_price="10", tax_rate=0)])
    items = client.get(f"{BASE}/{inv['id']}/items", headers=h).json()["data"]
    assert [i["description"] for i in items] == ["Design work", "Second"]
    client.post("/api/v1/payments", json={"invoice_id": inv["id"], "amount": "50", "payment_date": TODAY.isoformat(), "payment_method": "cash", "reference_number": "R-1"}, headers=h)
    pays = client.get(f"{BASE}/{inv['id']}/payments", headers=h).json()["data"]
    assert len(pays) == 1 and D(pays[0]["amount"]) == D("50.00") and pays[0]["invoice_number"] == inv["invoice_number"]
    detail = client.get(f"{BASE}/{inv['id']}", headers=h).json()["data"]
    assert detail["payments_count"] == 1 and len(detail["payments"]) == 1
    assert D(detail["paid_amount"]) == D("50.00") and D(detail["balance_amount"]) == D("196.00")
    assert [a["action"] for a in detail["activity"]] == ["created", "sent", "created"]  # invoice created, sent, payment recorded


def test_permission_matrix(client, world):
    admin = auth(world.a.admin)
    inv = make_invoice(client, admin, world.a.client_record.id, send=True)
    draft = make_invoice(client, admin, world.a.client_record.id)
    url = f"{BASE}/{inv['id']}"
    body = payload(world.a.client_record.id)

    assert client.get(BASE).status_code == 401

    manager = auth(world.a.manager)  # view_invoices only
    assert client.get(BASE, headers=manager).status_code == 200
    assert client.get(url, headers=manager).status_code == 200
    assert client.get(f"{BASE}/{draft['id']}", headers=manager).status_code == 200  # staff see drafts
    assert client.get(f"{url}/payments", headers=manager).status_code == 200
    assert client.post(BASE, json=body, headers=manager).status_code == 403
    assert client.put(url, json={"notes": "x"}, headers=manager).status_code == 403
    assert client.delete(f"{BASE}/{draft['id']}", headers=manager).status_code == 403
    assert client.post(f"{BASE}/{draft['id']}/send", headers=manager).status_code == 403
    assert client.post(f"{url}/cancel", headers=manager).status_code == 403

    employee = auth(world.a.employee)
    for method, path in (("get", BASE), ("get", url), ("get", f"{url}/items"), ("get", f"{url}/payments"), ("get", f"/api/v1/clients/{world.a.client_record.id}/invoices")):
        assert getattr(client, method)(path, headers=employee).status_code == 403, path
    assert client.post(BASE, json=body, headers=employee).status_code == 403

    customer = auth(world.a.client_user)  # view only, own records
    assert client.get(url, headers=customer).status_code == 200
    assert client.post(BASE, json=body, headers=customer).status_code == 403
    assert client.put(url, json={"notes": "x"}, headers=customer).status_code == 403
    assert client.delete(url, headers=customer).status_code == 403
    assert client.post(f"{url}/cancel", headers=customer).status_code == 403


def test_client_user_sees_only_own_issued_invoices(client, world, factory):
    admin = auth(world.a.admin)
    mine = world.a.client_record.id
    other = factory.make_client(world.a.company, "Other Co")
    draft = make_invoice(client, admin, mine)
    sent = make_invoice(client, admin, mine, send=True)
    cancelled = make_invoice(client, admin, mine, send=True)
    client.post(f"{BASE}/{cancelled['id']}/cancel", headers=admin)
    others = make_invoice(client, admin, other.id, send=True)
    theirs_b = make_invoice(client, auth(world.b.admin), world.b.client_record.id, send=True)

    h = auth(world.a.client_user)
    listed = client.get(BASE, headers=h).json()
    assert [i["id"] for i in listed["data"]] == [sent["id"]] and listed["total"] == 1
    assert [i["id"] for i in client.get(BASE, params={"client_id": other.id}, headers=h).json()["data"]] == []  # cannot widen the scope
    assert client.get(BASE, params={"status": "draft"}, headers=h).json()["total"] == 0
    detail = client.get(f"{BASE}/{sent['id']}", headers=h)
    assert detail.status_code == 200 and detail.json()["data"]["activity"] == []  # internal audit feed is hidden
    for hidden in (draft, cancelled, others, theirs_b):
        assert client.get(f"{BASE}/{hidden['id']}", headers=h).status_code == 404
        assert client.get(f"{BASE}/{hidden['id']}/items", headers=h).status_code == 404
        assert client.get(f"{BASE}/{hidden['id']}/payments", headers=h).status_code == 404


def test_company_isolation(client, world):
    a, b = auth(world.a.admin), auth(world.b.admin)
    inv = make_invoice(client, a, world.a.client_record.id, send=True)
    url = f"{BASE}/{inv['id']}"
    assert client.get(url, headers=b).status_code == 404
    assert client.put(url, json={"notes": "x"}, headers=b).status_code == 404
    assert client.delete(url, headers=b).status_code == 404
    assert client.post(f"{url}/send", headers=b).status_code == 404
    assert client.post(f"{url}/cancel", headers=b).status_code == 404
    assert client.get(f"{url}/items", headers=b).status_code == 404
    assert client.get(f"{url}/payments", headers=b).status_code == 404
    assert client.get(BASE, headers=b).json()["total"] == 0
    assert client.get(BASE, params={"search": inv["invoice_number"]}, headers=b).json()["total"] == 0


def test_super_admin_needs_company_to_create(client, world):
    h = auth(world.super_admin)
    assert client.post(BASE, json=payload(world.a.client_record.id), headers=h).status_code == 400
    res = client.post(BASE, params={"company_id": world.a.company.id}, json=payload(world.a.client_record.id), headers=h)
    assert res.status_code == 201 and res.json()["data"]["company_id"] == world.a.company.id
    # a client that belongs to another company than the chosen one is still rejected
    assert client.post(BASE, params={"company_id": world.a.company.id}, json=payload(world.b.client_record.id), headers=h).status_code == 404


def test_client_billing_subresources(client, world, factory):
    admin = auth(world.a.admin)
    cid = world.a.client_record.id
    inv = make_invoice(client, admin, cid, send=True)
    other = factory.make_client(world.a.company, "Other Co")
    other_inv = make_invoice(client, admin, other.id, send=True)
    make_invoice(client, admin, cid)  # draft
    client.post("/api/v1/payments", json={"invoice_id": inv["id"], "amount": "20", "payment_date": TODAY.isoformat(), "payment_method": "upi"}, headers=admin)
    client.post("/api/v1/payments", json={"invoice_id": other_inv["id"], "amount": "30", "payment_date": TODAY.isoformat(), "payment_method": "upi"}, headers=admin)

    invoices = client.get(f"/api/v1/clients/{cid}/invoices", headers=admin).json()
    assert invoices["total"] == 2 and {i["client_id"] for i in invoices["data"]} == {cid}
    assert client.get(f"/api/v1/clients/{cid}/invoices", params={"status": "draft"}, headers=admin).json()["total"] == 1
    payments = client.get(f"/api/v1/clients/{cid}/payments", headers=admin).json()
    assert payments["total"] == 1 and payments["data"][0]["invoice_id"] == inv["id"]

    mgr = auth(world.a.manager)
    assert client.get(f"/api/v1/clients/{cid}/invoices", headers=mgr).status_code == 200
    assert client.get(f"/api/v1/clients/{cid}/payments", headers=mgr).status_code == 200

    own = auth(world.a.client_user)
    assert client.get(f"/api/v1/clients/{cid}/invoices", headers=own).json()["total"] == 1  # no draft
    assert client.get(f"/api/v1/clients/{cid}/payments", headers=own).json()["total"] == 1
    assert client.get(f"/api/v1/clients/{other.id}/invoices", headers=own).status_code == 404
    assert client.get(f"/api/v1/clients/{other.id}/payments", headers=own).status_code == 404

    assert client.get(f"/api/v1/clients/{cid}/invoices", headers=auth(world.a.employee)).status_code == 403
    assert client.get(f"/api/v1/clients/{cid}/payments", headers=auth(world.a.employee)).status_code == 403
    assert client.get(f"/api/v1/clients/{cid}/invoices", headers=auth(world.b.admin)).status_code == 404
    assert client.get(f"/api/v1/clients/{cid}/payments", headers=auth(world.b.admin)).status_code == 404
    assert client.get("/api/v1/clients/99999/invoices", headers=admin).status_code == 404


def test_paying_users_can_be_notified_when_someone_else_created_the_invoice(client, world, factory, db):
    # invoice creator differs from the payment recorder: both the creator and the client user hear about it
    creator = auth(world.a.admin)
    inv = make_invoice(client, creator, world.a.client_record.id, send=True)
    second_admin = factory.make_user(world.a.company, RoleName.COMPANY_ADMIN)
    res = client.post("/api/v1/payments", json={"invoice_id": inv["id"], "amount": "100", "payment_date": TODAY.isoformat(), "payment_method": "cheque"}, headers=auth(second_admin))
    assert res.status_code == 201
    recipients = set(fresh(db).scalars(select(Notification.user_id).where(Notification.type == NotificationType.PAYMENT)))
    assert recipients == {world.a.admin.id, world.a.client_user.id}
    assert fresh(db).scalar(select(func.count()).select_from(Payment)) == 1
