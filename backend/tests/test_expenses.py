from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select

from app.core.config import get_settings
from app.models import ActivityLog, Expense
from tests.conftest import auth
from tests.test_invoices import fresh, make_project

BASE = "/api/v1/expenses"
TODAY = date.today()
D = Decimal
PDF = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


def payload(**over):
    return {"title": "AWS hosting", "category": "software", "amount": "1250.50", "expense_date": TODAY.isoformat(), **over}


def make_expense(client, headers, **over) -> dict:
    res = client.post(BASE, json=payload(**over), headers=headers)
    assert res.status_code == 201, res.text
    return res.json()["data"]


def upload(client, headers, expense_id, name="receipt.pdf", data=PDF, mime="application/pdf"):
    return client.post(f"{BASE}/{expense_id}/attachment", files={"file": (name, data, mime)}, headers=headers)


def stored_file(db, expense_id):
    path = fresh(db).get(Expense, expense_id).attachment
    return get_settings().upload_path / path if path else None


def test_admin_crud_and_envelope(client, world, db):
    h = auth(world.a.admin)
    project = make_project(db, world.a)
    res = client.post(BASE, json=payload(employee_id=world.a.employee_emp.id, project_id=project.id, description="Monthly bill"), headers=h)
    assert res.status_code == 201, res.text
    body = res.json()
    exp = body["data"]
    assert body["success"] is True and D(exp["amount"]) == D("1250.50") and exp["category"] == "software"
    assert exp["employee_name"] == world.a.employee.name and exp["project_name"] == project.name
    assert exp["has_attachment"] is False and exp["company_id"] == world.a.company.id and exp["created_by"] == world.a.admin.id
    assert "attachment" not in exp  # storage paths never leave the server

    got = client.get(f"{BASE}/{exp['id']}", headers=h).json()["data"]
    assert got["title"] == "AWS hosting" and got["description"] == "Monthly bill"

    upd = client.put(f"{BASE}/{exp['id']}", json={"title": "AWS hosting Oct", "amount": "99.99", "category": "office", "employee_id": None, "project_id": None}, headers=h)
    assert upd.status_code == 200, upd.text
    data = upd.json()["data"]
    assert data["title"] == "AWS hosting Oct" and D(data["amount"]) == D("99.99") and data["category"] == "office"
    assert data["employee_id"] is None and data["employee_name"] is None and data["project_name"] is None

    assert client.delete(f"{BASE}/{exp['id']}", headers=h).status_code == 200
    assert client.get(f"{BASE}/{exp['id']}", headers=h).status_code == 404
    actions = fresh(db).scalars(select(ActivityLog.action).where(ActivityLog.entity_type == "expense", ActivityLog.entity_id == exp["id"]).order_by(ActivityLog.id)).all()
    assert actions == ["created", "updated", "deleted"]


def test_validation(client, world, db):
    h = auth(world.a.admin)
    foreign_project = make_project(db, world.b, code="B-1")
    foreign_employee = world.b.employee_emp
    for over in (
        {"amount": "0"},
        {"amount": "-1"},
        {"amount": "1.005"},
        {"amount": "abc"},
        {"title": ""},
        {"title": "x" * 201},
        {"category": "yachts"},
        {"expense_date": "2026-13-01"},
        {"expense_date": (TODAY + timedelta(days=2)).isoformat()},  # far future
        {"company_id": 3},
        {"attachment": "../../etc/passwd"},
    ):
        assert client.post(BASE, json=payload(**over), headers=h).status_code == 422, over
    for key in ("title", "amount", "expense_date"):
        body = payload()
        del body[key]
        assert client.post(BASE, json=body, headers=h).status_code == 422
    assert client.post(BASE, json=payload(employee_id=foreign_employee.id), headers=h).status_code == 404
    assert client.post(BASE, json=payload(project_id=foreign_project.id), headers=h).status_code == 404
    assert client.post(BASE, json=payload(employee_id=99999), headers=h).status_code == 404
    # tomorrow is tolerated (timezones); category defaults to other
    ok = client.post(BASE, json={"title": "Taxi", "amount": "10", "expense_date": (TODAY + timedelta(days=1)).isoformat()}, headers=h)
    assert ok.status_code == 201 and ok.json()["data"]["category"] == "other"

    exp = make_expense(client, h)
    for over in ({"amount": "0"}, {"title": None}, {"amount": None}, {"expense_date": None}, {"category": None}, {"expense_date": (TODAY + timedelta(days=9)).isoformat()}, {"employee_id": foreign_employee.id}, {"project_id": foreign_project.id}):
        expected = 404 if list(over)[0] in ("employee_id", "project_id") else 422
        assert client.put(f"{BASE}/{exp['id']}", json=over, headers=h).status_code == expected, over
    assert D(client.get(f"{BASE}/{exp['id']}", headers=h).json()["data"]["amount"]) == D("1250.50")


def test_list_filters_search_sort_pagination(client, world, db):
    h = auth(world.a.admin)
    project = make_project(db, world.a)
    e1 = make_expense(client, h, title="Flight to Pune", category="travel", amount="300", expense_date="2026-03-05", employee_id=world.a.employee_emp.id)
    e2 = make_expense(client, h, title="Figma seats", category="software", amount="100", expense_date="2026-04-10", project_id=project.id, description="design team")
    e3 = make_expense(client, h, title="Hotel Pune", category="travel", amount="200", expense_date="2026-05-20")

    def ids(**params):
        res = client.get(BASE, params=params, headers=h)
        assert res.status_code == 200, res.text
        return [e["id"] for e in res.json()["data"]]

    assert ids() == [e3["id"], e2["id"], e1["id"]]  # newest expense date first
    assert set(ids(category="travel")) == {e1["id"], e3["id"]}
    assert ids(project_id=project.id) == [e2["id"]]
    assert ids(employee_id=world.a.employee_emp.id) == [e1["id"]]
    assert ids(date_from="2026-04-01", date_to="2026-04-30") == [e2["id"]]
    assert ids(date_to="2026-03-31") == [e1["id"]]
    assert ids(search="pune", sort_by="amount", sort_order="asc") == [e3["id"], e1["id"]]
    assert ids(search="DESIGN team") == [e2["id"]]
    assert ids(search="nothing") == []
    page = client.get(BASE, params={"limit": 2, "page": 2}, headers=h).json()
    assert page["total"] == 3 and page["total_pages"] == 2 and [e["id"] for e in page["data"]] == [e1["id"]]
    assert client.get(BASE, params={"sort_by": "attachment"}, headers=h).status_code == 422
    assert client.get(BASE, params={"category": "yachts"}, headers=h).status_code == 422


def test_summary_by_category_and_month(client, world):
    h = auth(world.a.admin)
    make_expense(client, h, category="travel", amount="300.00", expense_date="2026-03-05")
    make_expense(client, h, category="travel", amount="200.25", expense_date="2026-03-28")
    make_expense(client, h, category="software", amount="100.00", expense_date="2026-04-10")
    make_expense(client, h, category="office", amount="50.00", expense_date="2026-05-01")
    make_expense(client, auth(world.b.admin), category="travel", amount="9999", expense_date="2026-03-06")  # other company

    full = client.get(f"{BASE}/summary", headers=h)
    assert full.status_code == 200, full.text
    data = full.json()["data"]
    assert D(data["total_amount"]) == D("650.25") and data["count"] == 4
    by_category = {c["category"]: (D(c["total"]), c["count"]) for c in data["by_category"]}
    assert by_category == {"travel": (D("500.25"), 2), "software": (D("100.00"), 1), "office": (D("50.00"), 1)}
    assert [(m["month"], D(m["total"]), m["count"]) for m in data["by_month"]] == [("2026-03", D("500.25"), 2), ("2026-04", D("100.00"), 1), ("2026-05", D("50.00"), 1)]

    ranged = client.get(f"{BASE}/summary", params={"date_from": "2026-04-01", "date_to": "2026-04-30"}, headers=h).json()["data"]
    assert D(ranged["total_amount"]) == D("100.00") and ranged["count"] == 1 and [m["month"] for m in ranged["by_month"]] == ["2026-04"]
    assert ranged["date_from"] == "2026-04-01"
    empty = client.get(f"{BASE}/summary", params={"date_from": "2030-01-01"}, headers=h).json()["data"]
    assert D(empty["total_amount"]) == 0 and empty["by_category"] == [] and empty["by_month"] == []
    assert client.get(f"{BASE}/summary", params={"date_from": "2026-05-01", "date_to": "2026-04-01"}, headers=h).status_code == 422
    assert client.get(f"{BASE}/summary", params={"date_from": "nope"}, headers=h).status_code == 422
    # the manager may read the summary, an employee may not
    assert client.get(f"{BASE}/summary", headers=auth(world.a.manager)).status_code == 200
    assert client.get(f"{BASE}/summary", headers=auth(world.a.employee)).status_code == 403


def test_attachment_upload_download_replace_delete(client, world, db):
    h = auth(world.a.admin)
    exp = make_expense(client, h)
    assert client.get(f"{BASE}/{exp['id']}/attachment", headers=h).status_code == 404  # nothing uploaded yet

    res = upload(client, h, exp["id"])
    assert res.status_code == 200, res.text
    assert res.json()["data"]["has_attachment"] is True
    first = stored_file(db, exp["id"])
    assert first.is_file() and first.read_bytes() == PDF
    assert str(world.a.company.id) in first.parts and "expenses" in first.parts  # f"{company_id}/expenses"

    got = client.get(f"{BASE}/{exp['id']}/attachment", headers=h)
    assert got.status_code == 200 and got.content == PDF
    assert got.headers["content-type"] == "application/pdf"
    assert got.headers["content-disposition"].startswith("attachment") and got.headers["x-content-type-options"] == "nosniff"

    # replacing removes the old file
    assert upload(client, h, exp["id"], "photo.png", PNG, "image/png").status_code == 200
    second = stored_file(db, exp["id"])
    assert second != first and second.suffix == ".png" and second.is_file() and not first.exists()
    assert client.get(f"{BASE}/{exp['id']}/attachment", headers=h).headers["content-type"] == "image/png"
    assert upload(client, h, exp["id"], "photo.jpg", b"\xff\xd8\xff\xe0" + b"0" * 20, "image/jpeg").status_code == 200

    actions = fresh(db).scalars(select(ActivityLog.action).where(ActivityLog.entity_type == "expense", ActivityLog.entity_id == exp["id"]).order_by(ActivityLog.id)).all()
    assert actions.count("uploaded") == 3 and actions.count("downloaded") == 2

    current = stored_file(db, exp["id"])
    assert client.delete(f"{BASE}/{exp['id']}", headers=h).status_code == 200
    assert not current.exists()


def test_attachment_validation(client, world, db):
    h = auth(world.a.admin)
    exp = make_expense(client, h)
    bad = [
        ("virus.exe", b"MZ" + b"0" * 20, "application/octet-stream"),
        ("notes.txt", b"hello", "text/plain"),
        ("archive.zip", b"PK\x03\x04" + b"0" * 10, "application/zip"),
        ("sheet.xlsx", b"PK\x03\x04" + b"0" * 10, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        ("receipt.pdf", PDF, "image/png"),  # MIME does not match the extension
        ("fake.pdf", b"<html>not a pdf</html>", "application/pdf"),  # content does not match the extension
        ("fake.png", PDF, "image/png"),
        ("empty.pdf", b"", "application/pdf"),
        ("noext", PDF, "application/pdf"),
    ]
    for name, data, mime in bad:
        assert upload(client, h, exp["id"], name, data, mime).status_code == 422, name
    assert stored_file(db, exp["id"]) is None
    assert client.post(f"{BASE}/{exp['id']}/attachment", headers=h).status_code == 422  # no file part
    assert upload(client, h, 99999).status_code == 404
    folder = get_settings().upload_path / str(world.a.company.id) / "expenses"
    assert not folder.exists() or not any(p.name.endswith(".exe") for p in folder.iterdir())


def test_attachment_permissions_and_isolation(client, world, db):
    admin = auth(world.a.admin)
    exp = make_expense(client, admin)
    assert upload(client, admin, exp["id"]).status_code == 200
    url = f"{BASE}/{exp['id']}/attachment"

    assert client.get(url).status_code == 401
    assert client.get(url, headers=auth(world.a.manager)).status_code == 200  # view_expenses
    assert upload(client, auth(world.a.manager), exp["id"]).status_code == 403  # but not manage_expenses
    for user in (world.a.employee, world.a.client_user):
        assert client.get(url, headers=auth(user)).status_code == 403
        assert upload(client, auth(user), exp["id"]).status_code == 403
    other = auth(world.b.admin)
    assert client.get(url, headers=other).status_code == 404
    assert upload(client, other, exp["id"]).status_code == 404
    assert stored_file(db, exp["id"]).read_bytes() == PDF  # untouched
    client.delete(f"{BASE}/{exp['id']}", headers=admin)


def test_permission_matrix(client, world):
    admin = auth(world.a.admin)
    exp = make_expense(client, admin)
    url = f"{BASE}/{exp['id']}"

    assert client.get(BASE).status_code == 401

    manager = auth(world.a.manager)  # view_expenses only
    assert client.get(BASE, headers=manager).status_code == 200
    assert client.get(url, headers=manager).status_code == 200
    assert client.post(BASE, json=payload(), headers=manager).status_code == 403
    assert client.put(url, json={"title": "x"}, headers=manager).status_code == 403
    assert client.delete(url, headers=manager).status_code == 403

    for user in (world.a.employee, world.a.client_user):  # expenses are internal finance data
        h = auth(user)
        assert client.get(BASE, headers=h).status_code == 403
        assert client.get(url, headers=h).status_code == 403
        assert client.get(f"{BASE}/summary", headers=h).status_code == 403
        assert client.post(BASE, json=payload(), headers=h).status_code == 403
        assert client.put(url, json={"title": "x"}, headers=h).status_code == 403
        assert client.delete(url, headers=h).status_code == 403
    assert client.get(url, headers=admin).json()["data"]["title"] == "AWS hosting"


def test_company_isolation(client, world, db):
    a, b = auth(world.a.admin), auth(world.b.admin)
    exp = make_expense(client, a)
    url = f"{BASE}/{exp['id']}"
    assert client.get(url, headers=b).status_code == 404
    assert client.put(url, json={"title": "hijack"}, headers=b).status_code == 404
    assert client.delete(url, headers=b).status_code == 404
    assert client.get(BASE, headers=b).json()["total"] == 0
    assert client.get(BASE, params={"search": "AWS"}, headers=b).json()["total"] == 0
    assert fresh(db).scalar(select(func.count()).select_from(Expense)) == 1
    # b cannot reference a's employee / project
    assert client.post(BASE, json=payload(employee_id=world.a.employee_emp.id), headers=b).status_code == 404
    assert client.post(BASE, json=payload(project_id=make_project(db, world.a).id), headers=b).status_code == 404


def test_super_admin_needs_company_to_create(client, world):
    h = auth(world.super_admin)
    assert client.post(BASE, json=payload(), headers=h).status_code == 400
    res = client.post(BASE, params={"company_id": world.a.company.id}, json=payload(), headers=h)
    assert res.status_code == 201 and res.json()["data"]["company_id"] == world.a.company.id
    assert client.get(BASE, headers=h).json()["total"] == 1
