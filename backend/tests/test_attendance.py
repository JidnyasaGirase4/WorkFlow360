from datetime import date, datetime

import pytest

from app.core.enums import RoleName
from app.models import ActivityLog, AttendanceRecord, Holiday
from app.services import attendance as service
from tests.conftest import auth
from tests.test_employees import granted, make_dept

BASE = "/api/v1/attendance"
HOLIDAYS = "/api/v1/holidays"


@pytest.fixture
def clock(monkeypatch):
    """Freeze the service clock: clock("2026-09-14 09:30")."""
    state = {}

    def set_time(value: str):
        state["now"] = datetime.strptime(value, "%Y-%m-%d %H:%M")

    monkeypatch.setattr(service, "_now", lambda: state["now"])
    return set_time


def check_in(client, user, **body):
    return client.post(f"{BASE}/check-in", json=body or None, headers=auth(user))


# ---- check-in / check-out -----------------------------------------------------

def test_check_in_and_out_flow(client, world, clock, db):
    h = auth(world.a.employee)
    clock("2026-09-14 09:30")
    res = client.post(f"{BASE}/check-in", headers=h)
    assert res.status_code == 201, res.text
    data = res.json()["data"]
    assert data["status"] == "present" and data["check_in"] == "09:30" and data["check_out"] is None
    assert data["employee_id"] == world.a.employee_emp.id and data["employee_name"] == world.a.employee.name

    assert client.post(f"{BASE}/check-in", headers=h).status_code == 409  # one record per day

    clock("2026-09-14 18:05")
    out = client.post(f"{BASE}/check-out", headers=h)
    assert out.status_code == 200, out.text
    assert out.json()["data"]["check_out"] == "18:05" and out.json()["data"]["worked_minutes"] == 515
    assert client.post(f"{BASE}/check-out", headers=h).status_code == 409  # already checked out

    db.commit()
    actions = [a.action for a in db.query(ActivityLog).filter_by(entity_type="attendance").order_by(ActivityLog.id)]
    assert actions == ["checked_in", "checked_out"]
    assert db.query(AttendanceRecord).filter_by(employee_id=world.a.employee_emp.id).count() == 1

    clock("2026-09-15 09:00")  # a new day is a new record
    assert client.post(f"{BASE}/check-in", headers=h).status_code == 201


def test_check_out_needs_check_in(client, world, clock):
    clock("2026-09-14 18:00")
    assert client.post(f"{BASE}/check-out", headers=auth(world.a.employee)).status_code == 409


def test_late_detection_boundaries(client, world, clock):
    clock("2026-09-14 10:00")  # exactly 10:00 is still on time
    assert check_in(client, world.a.employee).json()["data"]["status"] == "present"
    clock("2026-09-14 10:01")
    late = check_in(client, world.a.manager)
    assert late.status_code == 201 and late.json()["data"]["status"] == "late"


def test_wfh_check_in_stays_wfh_even_when_late(client, world, clock):
    clock("2026-09-14 11:15")
    res = check_in(client, world.a.employee, status="wfh")
    assert res.status_code == 201 and res.json()["data"]["status"] == "wfh"
    assert check_in(client, world.a.manager, status="absent").status_code == 422  # only wfh may be chosen
    assert check_in(client, world.a.manager, foo=1).status_code == 422


def test_check_in_over_absent_placeholder_but_not_over_leave(client, world, clock, db):
    clock("2026-09-14 09:10")
    db.add(AttendanceRecord(company_id=world.a.company.id, employee_id=world.a.employee_emp.id, attendance_date=date(2026, 9, 14), status="absent"))
    db.add(AttendanceRecord(company_id=world.a.company.id, employee_id=world.a.manager_emp.id, attendance_date=date(2026, 9, 14), status="on_leave"))
    db.commit()
    assert check_in(client, world.a.employee).json()["data"]["status"] == "present"
    assert check_in(client, world.a.manager).status_code == 409


def test_check_in_permissions(client, world, clock):
    clock("2026-09-14 09:00")
    assert check_in(client, world.a.client_user).status_code == 403
    assert client.post(f"{BASE}/check-in").status_code == 401
    assert client.post(f"{BASE}/check-in", headers=auth(world.a.admin)).status_code == 400  # admin has no employee profile
    assert client.post(f"{BASE}/check-out", headers=auth(world.a.client_user)).status_code == 403


# ---- listing --------------------------------------------------------------------

def seed(db, world):
    rows = [
        (world.a.employee_emp, date(2026, 9, 14), "09:00", "18:00", "present"),
        (world.a.employee_emp, date(2026, 9, 15), "10:30", None, "late"),
        (world.a.manager_emp, date(2026, 9, 14), "09:10", "17:00", "wfh"),
        (world.a.manager_emp, date(2026, 9, 15), None, None, "absent"),
        (world.b.employee_emp, date(2026, 9, 14), "09:00", None, "present"),
    ]
    for emp, day, cin, cout, status in rows:
        db.add(AttendanceRecord(company_id=emp.company_id, employee_id=emp.id, attendance_date=day, check_in=cin, check_out=cout, status=status))
    db.commit()


def test_list_visibility_by_role(client, world, db):
    seed(db, world)
    admin = client.get(BASE, headers=auth(world.a.admin)).json()
    assert admin["total"] == 4 and all(r["company_id"] == world.a.company.id for r in admin["data"])
    assert client.get(BASE, headers=auth(world.a.manager)).json()["total"] == 4  # manager holds view_attendance

    mine = client.get(BASE, headers=auth(world.a.employee)).json()
    assert mine["total"] == 2 and {r["employee_id"] for r in mine["data"]} == {world.a.employee_emp.id}
    # an employee cannot use filters to peek at someone else
    peek = client.get(BASE, params={"employee_id": world.a.manager_emp.id}, headers=auth(world.a.employee)).json()
    assert peek["total"] == 0
    assert client.get(BASE, headers=auth(world.a.client_user)).status_code == 403
    assert client.get(BASE).status_code == 401


def test_list_filters_sort_and_pagination(client, world, db):
    seed(db, world)
    h = auth(world.a.admin)

    def total(**p):
        return client.get(BASE, params=p, headers=h).json()["total"]

    assert total(employee_id=world.a.employee_emp.id) == 2
    assert total(date="2026-09-14") == 2
    assert total(date_from="2026-09-15") == 2
    assert total(date_from="2026-09-14", date_to="2026-09-14") == 2
    assert total(status="late") == 1 and total(status="absent") == 1
    dept = make_dept(db, world.a.company)
    world.a.manager_emp.department_id = dept.id
    db.commit()
    res = client.get(BASE, params={"department_id": dept.id}, headers=h).json()
    assert res["total"] == 2 and res["data"][0]["department_name"] == "Development"
    page = client.get(BASE, params={"limit": 1, "page": 2, "sort_by": "attendance_date", "sort_order": "asc"}, headers=h).json()
    assert page["total_pages"] == 4 and len(page["data"]) == 1
    assert client.get(BASE, params={"sort_by": "employee_id; drop"}, headers=h).status_code == 422
    assert client.get(BASE, params={"status": "sleeping"}, headers=h).status_code == 422
    assert client.get(BASE, params={"date": "nope"}, headers=h).status_code == 422


def test_today_summary(client, world, clock, db):
    clock("2026-09-14 12:00")
    seed(db, world)
    res = client.get(f"{BASE}/today", headers=auth(world.a.admin))
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["date"] == "2026-09-14" and data["counts"]["present"] == 1 and data["counts"]["wfh"] == 1 and data["counts"]["late"] == 0
    assert len(data["records"]) == 2 and data["total_employees"] == 2 and data["not_marked"] == 0
    assert client.get(f"{BASE}/today", headers=auth(world.a.manager)).status_code == 200
    assert client.get(f"{BASE}/today", headers=auth(world.a.employee)).status_code == 403
    assert client.get(f"{BASE}/today", headers=auth(world.a.client_user)).status_code == 403
    b = client.get(f"{BASE}/today", headers=auth(world.b.admin)).json()["data"]
    assert len(b["records"]) == 1 and b["counts"]["present"] == 1


def test_my_monthly_summary(client, world, clock, db):
    clock("2026-09-20 12:00")
    emp = world.a.employee_emp
    for day, status in [(1, "present"), (2, "present"), (3, "late"), (4, "wfh"), (7, "absent"), (8, "half_day"), (9, "on_leave")]:
        db.add(AttendanceRecord(company_id=emp.company_id, employee_id=emp.id, attendance_date=date(2026, 9, day), status=status))
    db.add(AttendanceRecord(company_id=emp.company_id, employee_id=emp.id, attendance_date=date(2026, 8, 31), status="present"))
    db.commit()
    h = auth(world.a.employee)
    res = client.get(f"{BASE}/me/summary", params={"month": "2026-09"}, headers=h)
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert (data["present"], data["late"], data["wfh"], data["absent"], data["half_day"], data["on_leave"]) == (2, 1, 1, 1, 1, 1)
    assert data["total_records"] == 7 and data["month"] == "2026-09"
    assert client.get(f"{BASE}/me/summary", headers=h).json()["data"]["month"] == "2026-09"  # default: current month
    assert client.get(f"{BASE}/me/summary", params={"month": "2026-08"}, headers=h).json()["data"]["present"] == 1
    assert client.get(f"{BASE}/me/summary", params={"month": "2026-12"}, headers=h).json()["data"]["total_records"] == 0
    assert client.get(f"{BASE}/me/summary", params={"month": "2026-13"}, headers=h).status_code == 422
    assert client.get(f"{BASE}/me/summary", headers=auth(world.a.client_user)).status_code == 403


# ---- manual records ---------------------------------------------------------------

def manual(**over):
    return {"attendance_date": "2026-09-10", "check_in": "09:00", "check_out": "18:00", "status": "present", **over}


def test_manual_crud_requires_manage_attendance(client, world, db):
    admin = auth(world.a.admin)
    eid = world.a.employee_emp.id
    res = client.post(BASE, json=manual(employee_id=eid, notes="Forgot to check in"), headers=admin)
    assert res.status_code == 201, res.text
    rid = res.json()["data"]["id"]
    assert res.json()["data"]["worked_minutes"] == 540

    dup = client.post(BASE, json=manual(employee_id=eid), headers=admin)
    assert dup.status_code == 409

    upd = client.put(f"{BASE}/{rid}", json={"status": "half_day", "check_out": "13:00"}, headers=admin)
    assert upd.status_code == 200 and upd.json()["data"]["status"] == "half_day" and upd.json()["data"]["worked_minutes"] == 240
    assert client.put(f"{BASE}/{rid}", json={"check_in": "19:00"}, headers=admin).status_code == 422  # after existing check_out
    assert client.put(f"{BASE}/{rid}", json={"status": None}, headers=admin).status_code == 422

    assert client.delete(f"{BASE}/{rid}", headers=admin).status_code == 200
    assert client.delete(f"{BASE}/{rid}", headers=admin).status_code == 404
    db.commit()
    actions = [a.action for a in db.query(ActivityLog).filter_by(entity_type="attendance", entity_id=rid).order_by(ActivityLog.id)]
    assert actions == ["created", "updated", "deleted"]


def test_manual_permissions_and_isolation(client, world, db):
    eid = world.a.employee_emp.id
    for user in (world.a.manager, world.a.employee, world.a.client_user):  # default matrix: admin only
        assert client.post(BASE, json=manual(employee_id=eid), headers=auth(user)).status_code == 403
    rid = client.post(BASE, json=manual(employee_id=eid), headers=auth(world.a.admin)).json()["data"]["id"]
    for user in (world.a.manager, world.a.employee):
        assert client.put(f"{BASE}/{rid}", json={"notes": "x"}, headers=auth(user)).status_code == 403
        assert client.delete(f"{BASE}/{rid}", headers=auth(user)).status_code == 403
    b = auth(world.b.admin)
    assert client.put(f"{BASE}/{rid}", json={"notes": "x"}, headers=b).status_code == 404
    assert client.delete(f"{BASE}/{rid}", headers=b).status_code == 404
    assert client.post(BASE, json=manual(employee_id=eid), headers=b).status_code == 404  # other company's employee
    with granted(db, RoleName.MANAGER.value, "manage_attendance"):
        assert client.post(BASE, json=manual(employee_id=world.a.manager_emp.id), headers=auth(world.a.manager)).status_code == 201


def test_manual_validation(client, world):
    h = auth(world.a.admin)
    eid = world.a.employee_emp.id
    assert client.post(BASE, json=manual(employee_id=eid, check_in="9:00"), headers=h).status_code == 422
    assert client.post(BASE, json=manual(employee_id=eid, check_in="25:00"), headers=h).status_code == 422
    assert client.post(BASE, json=manual(employee_id=eid, check_in="18:00", check_out="09:00"), headers=h).status_code == 422
    assert client.post(BASE, json=manual(employee_id=eid, status="sleeping"), headers=h).status_code == 422
    assert client.post(BASE, json=manual(employee_id=eid, company_id=2), headers=h).status_code == 422
    assert client.post(BASE, json={"attendance_date": "2026-09-10"}, headers=h).status_code == 422


# ---- holidays -------------------------------------------------------------------

def test_holidays_crud_scope_and_permissions(client, world, db):
    admin = auth(world.a.admin)
    res = client.post(HOLIDAYS, json={"holiday_date": "2026-10-02", "name": "Gandhi Jayanti"}, headers=admin)
    assert res.status_code == 201, res.text
    hid = res.json()["data"]["id"]
    client.post(HOLIDAYS, json={"holiday_date": "2027-01-26", "name": "Republic Day"}, headers=admin)

    assert client.post(HOLIDAYS, json={"holiday_date": "2026-10-02", "name": "Dup"}, headers=admin).status_code == 409
    assert client.post(HOLIDAYS, json={"holiday_date": "2026-10-02", "name": "Other company"}, headers=auth(world.b.admin)).status_code == 201

    for user in (world.a.admin, world.a.manager, world.a.employee):  # every internal user can read
        year = client.get(HOLIDAYS, params={"year": 2026}, headers=auth(user))
        assert year.status_code == 200 and [h["name"] for h in year.json()["data"]] == ["Gandhi Jayanti"]
    assert [h["name"] for h in client.get(HOLIDAYS, params={"year": 2027}, headers=admin).json()["data"]] == ["Republic Day"]
    assert client.get(HOLIDAYS, headers=auth(world.a.client_user)).status_code == 403
    assert client.get(HOLIDAYS).status_code == 401
    assert client.get(HOLIDAYS, params={"year": "abc"}, headers=admin).status_code == 422

    for user in (world.a.manager, world.a.employee, world.a.client_user):
        assert client.post(HOLIDAYS, json={"holiday_date": "2026-11-01", "name": "Nope"}, headers=auth(user)).status_code == 403
        assert client.delete(f"{HOLIDAYS}/{hid}", headers=auth(user)).status_code == 403
    assert client.delete(f"{HOLIDAYS}/{hid}", headers=auth(world.b.admin)).status_code == 404
    assert client.delete(f"{HOLIDAYS}/{hid}", headers=admin).status_code == 200
    db.commit()
    assert db.query(Holiday).filter_by(company_id=world.a.company.id, holiday_date=date(2026, 10, 2)).count() == 0
    actions = {a.action for a in db.query(ActivityLog).filter_by(entity_type="holiday", entity_id=hid)}
    assert actions == {"created", "deleted"}
