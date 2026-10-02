from datetime import date

from app.core.enums import RoleName
from app.models import ActivityLog, AttendanceRecord, LeaveRequest, Notification
from tests.conftest import auth
from tests.test_employees import granted, make_dept

BASE = "/api/v1/leave"


def apply(client, user, start="2026-10-05", end="2026-10-07", leave_type="casual", **over):
    return client.post(BASE, json={"leave_type": leave_type, "start_date": start, "end_date": end, "reason": "Family function", **over}, headers=auth(user))


def notifications(db, user):
    db.commit()  # fresh snapshot
    return db.query(Notification).filter_by(user_id=user.id).all()


def balance(client, user, **params):
    res = client.get(f"{BASE}/balance", params=params, headers=auth(user))
    assert res.status_code == 200, res.text
    return res.json()["data"]


# ---- applying ---------------------------------------------------------------------

def test_apply_creates_pending_request_and_notifies_approvers(client, world, db):
    res = apply(client, world.a.employee)
    assert res.status_code == 201, res.text
    data = res.json()["data"]
    assert data["status"] == "pending" and data["days"] == 3 and data["leave_type"] == "casual"
    assert data["employee_id"] == world.a.employee_emp.id and data["employee_name"] == world.a.employee.name and data["decided_by"] is None

    # approvers (admin + manager of the company) are told; the applicant, other companies and clients are not
    for approver in (world.a.admin, world.a.manager):
        notes = notifications(db, approver)
        assert len(notes) == 1 and notes[0].type.value == "system" and notes[0].reference_type == "leave_request" and notes[0].reference_id == data["id"]
    assert notifications(db, world.a.employee) == []
    assert notifications(db, world.b.admin) == [] and notifications(db, world.a.client_user) == []
    assert db.query(ActivityLog).filter_by(entity_type="leave_request", entity_id=data["id"], action="created").count() == 1


def test_manager_application_does_not_notify_themself(client, world, db):
    assert apply(client, world.a.manager).status_code == 201
    assert len(notifications(db, world.a.admin)) == 1
    assert notifications(db, world.a.manager) == []


def test_apply_validation_and_access(client, world):
    assert apply(client, world.a.employee, start="2026-10-07", end="2026-10-05").status_code == 422
    assert apply(client, world.a.employee, leave_type="unpaid").status_code == 422
    assert apply(client, world.a.employee, foo="bar").status_code == 422
    assert apply(client, world.a.employee, start="not-a-date").status_code == 422
    assert client.post(BASE, json={"leave_type": "casual"}, headers=auth(world.a.employee)).status_code == 422
    assert apply(client, world.a.employee, reason="x" * 501).status_code == 422
    assert apply(client, world.a.client_user).status_code == 403
    assert client.post(BASE, json={}).status_code == 401
    assert apply(client, world.a.admin).status_code == 400  # no employee profile
    assert apply(client, world.a.employee, start="2026-10-05", end="2026-10-05", reason=None).status_code == 201


def test_overlap_with_pending_or_approved_is_rejected(client, world):
    first = apply(client, world.a.employee, "2026-10-05", "2026-10-07").json()["data"]["id"]
    assert apply(client, world.a.employee, "2026-10-07", "2026-10-09", "sick").status_code == 409  # shares a day
    assert apply(client, world.a.employee, "2026-10-01", "2026-10-05").status_code == 409
    assert apply(client, world.a.employee, "2026-10-06", "2026-10-06").status_code == 409  # inside
    assert apply(client, world.a.employee, "2026-10-04", "2026-10-08").status_code == 409  # around
    assert apply(client, world.a.employee, "2026-10-08", "2026-10-09").status_code == 201  # adjacent is fine
    assert apply(client, world.a.manager, "2026-10-05", "2026-10-07").status_code == 201  # other people are unaffected
    # approved requests block too; cancelled/rejected ones do not
    assert client.patch(f"{BASE}/{first}/approve", headers=auth(world.a.manager)).status_code == 200
    assert apply(client, world.a.employee, "2026-10-06", "2026-10-06").status_code == 409
    other = apply(client, world.a.employee, "2026-11-02", "2026-11-03").json()["data"]["id"]
    client.patch(f"{BASE}/{other}/cancel", headers=auth(world.a.employee))
    assert apply(client, world.a.employee, "2026-11-02", "2026-11-03").status_code == 201
    third = apply(client, world.a.employee, "2026-12-01", "2026-12-02").json()["data"]["id"]
    client.patch(f"{BASE}/{third}/reject", json={"reason": "Busy period"}, headers=auth(world.a.manager))
    assert apply(client, world.a.employee, "2026-12-01", "2026-12-02").status_code == 201


# ---- balance ------------------------------------------------------------------------

def test_balance_math_and_insufficient_balance(client, world):
    fresh = balance(client, world.a.employee, year=2026)
    assert fresh["casual"] == {"total": 12, "used": 0, "pending": 0, "remaining": 12}
    assert fresh["sick"]["total"] == 10 and fresh["earned"]["total"] == 18 and fresh["year"] == 2026

    ten = apply(client, world.a.employee, "2026-03-02", "2026-03-11")  # 10 calendar days
    assert ten.status_code == 201 and ten.json()["data"]["days"] == 10
    assert balance(client, world.a.employee, year=2026)["casual"] == {"total": 12, "used": 0, "pending": 10, "remaining": 2}

    too_many = apply(client, world.a.employee, "2026-04-01", "2026-04-03")
    assert too_many.status_code == 422
    errors = too_many.json()["errors"]
    assert errors["requested"] == 3 and errors["remaining"] == 2 and errors["total"] == 12 and "Insufficient" in too_many.json()["message"]
    assert apply(client, world.a.employee, "2026-04-01", "2026-04-02").status_code == 201  # exactly the remaining 2
    assert apply(client, world.a.employee, "2026-05-01", "2026-05-01").status_code == 422  # now zero left
    assert apply(client, world.a.employee, "2026-05-01", "2026-05-01", "sick").status_code == 201  # other types are separate
    assert apply(client, world.a.employee, "2027-01-04", "2027-01-05").status_code == 201  # next year has its own balance
    assert apply(client, world.a.employee, "2026-06-01", "2026-06-11", "sick").status_code == 422  # 11 > 10 sick

    approve_id = ten.json()["data"]["id"]
    assert client.patch(f"{BASE}/{approve_id}/approve", headers=auth(world.a.manager)).status_code == 200
    assert balance(client, world.a.employee, year=2026)["casual"] == {"total": 12, "used": 10, "pending": 2, "remaining": 0}
    assert balance(client, world.a.employee, year=2027)["casual"]["pending"] == 2

    client.patch(f"{BASE}/{approve_id}/cancel", headers=auth(world.a.employee))  # approved: cannot cancel, nothing frees up
    assert balance(client, world.a.employee, year=2026)["casual"]["used"] == 10


def test_rejected_and_cancelled_days_are_returned_to_the_balance(client, world):
    a = apply(client, world.a.employee, "2026-03-02", "2026-03-06").json()["data"]["id"]
    b = apply(client, world.a.employee, "2026-04-06", "2026-04-08").json()["data"]["id"]
    assert balance(client, world.a.employee, year=2026)["casual"]["pending"] == 8
    client.patch(f"{BASE}/{a}/reject", json={"reason": "No cover"}, headers=auth(world.a.manager))
    client.patch(f"{BASE}/{b}/cancel", headers=auth(world.a.employee))
    assert balance(client, world.a.employee, year=2026)["casual"] == {"total": 12, "used": 0, "pending": 0, "remaining": 12}


def test_balance_defaults_to_current_year_and_access_rules(client, world):
    assert balance(client, world.a.employee)["year"] == date.today().year
    assert balance(client, world.a.employee, employee_id=world.a.employee_emp.id)["employee_id"] == world.a.employee_emp.id
    apply(client, world.a.employee, "2026-03-02", "2026-03-03")
    # approvers may look at someone else's balance
    other = balance(client, world.a.manager, employee_id=world.a.employee_emp.id, year=2026)
    assert other["employee_id"] == world.a.employee_emp.id and other["casual"]["pending"] == 2
    assert balance(client, world.a.manager, year=2026)["employee_id"] == world.a.manager_emp.id  # default is their own
    assert client.get(f"{BASE}/balance", params={"employee_id": world.a.manager_emp.id}, headers=auth(world.a.employee)).status_code == 403
    assert client.get(f"{BASE}/balance", params={"employee_id": world.b.employee_emp.id}, headers=auth(world.a.manager)).status_code == 404
    assert client.get(f"{BASE}/balance", headers=auth(world.a.client_user)).status_code == 403
    assert client.get(f"{BASE}/balance", params={"year": 1900}, headers=auth(world.a.employee)).status_code == 422
    assert client.get(f"{BASE}/balance").status_code == 401


# ---- decisions ------------------------------------------------------------------------

def test_approve_sets_decision_creates_on_leave_attendance_and_notifies(client, world, db):
    emp = world.a.employee_emp
    db.add(AttendanceRecord(company_id=emp.company_id, employee_id=emp.id, attendance_date=date(2026, 10, 12), check_in="09:00", status="present"))
    db.commit()
    lid = apply(client, world.a.employee, "2026-10-09", "2026-10-13").json()["data"]["id"]  # Fri..Tue

    res = client.patch(f"{BASE}/{lid}/approve", headers=auth(world.a.manager))
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["status"] == "approved" and data["decided_by"] == world.a.manager.id and data["decided_by_name"] == world.a.manager.name
    assert data["decided_at"] == date.today().isoformat()

    db.commit()
    rows = {r.attendance_date: r for r in db.query(AttendanceRecord).filter_by(employee_id=emp.id)}
    assert set(rows) == {date(2026, 10, 9), date(2026, 10, 12), date(2026, 10, 13)}  # weekdays only, weekend skipped
    assert rows[date(2026, 10, 9)].status.value == "on_leave" and rows[date(2026, 10, 13)].status.value == "on_leave"
    assert rows[date(2026, 10, 12)].status.value == "present"  # an existing record is never overwritten

    notes = notifications(db, world.a.employee)
    assert len(notes) == 1 and "approved" in notes[0].title.lower() and notes[0].reference_id == lid
    assert db.query(ActivityLog).filter_by(entity_type="leave_request", entity_id=lid, action="approved").one().user_id == world.a.manager.id

    listed = client.get(f"{BASE}", params={"status": "approved"}, headers=auth(world.a.admin)).json()["data"]
    assert listed[0]["decided_by_name"] == world.a.manager.name


def test_reject_requires_reason_and_notifies(client, world, db):
    lid = apply(client, world.a.employee).json()["data"]["id"]
    h = auth(world.a.manager)
    assert client.patch(f"{BASE}/{lid}/reject", headers=h).status_code == 422
    assert client.patch(f"{BASE}/{lid}/reject", json={}, headers=h).status_code == 422
    assert client.patch(f"{BASE}/{lid}/reject", json={"reason": ""}, headers=h).status_code == 422
    res = client.patch(f"{BASE}/{lid}/reject", json={"reason": "Release week, please reschedule"}, headers=h)
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["status"] == "rejected" and data["rejection_reason"] == "Release week, please reschedule" and data["decided_by"] == world.a.manager.id

    db.commit()
    assert db.query(AttendanceRecord).filter_by(employee_id=world.a.employee_emp.id).count() == 0  # no attendance for rejected leave
    notes = notifications(db, world.a.employee)
    assert len(notes) == 1 and "rejected" in notes[0].title.lower() and "Release week" in notes[0].message
    assert db.query(ActivityLog).filter_by(entity_type="leave_request", entity_id=lid, action="rejected").count() == 1


def test_only_pending_requests_can_be_decided(client, world):
    h = auth(world.a.manager)
    approved = apply(client, world.a.employee, "2026-10-05", "2026-10-05").json()["data"]["id"]
    assert client.patch(f"{BASE}/{approved}/approve", headers=h).status_code == 200
    assert client.patch(f"{BASE}/{approved}/approve", headers=h).status_code == 409
    assert client.patch(f"{BASE}/{approved}/reject", json={"reason": "late"}, headers=h).status_code == 409
    rejected = apply(client, world.a.employee, "2026-10-06", "2026-10-06").json()["data"]["id"]
    assert client.patch(f"{BASE}/{rejected}/reject", json={"reason": "no"}, headers=h).status_code == 200
    assert client.patch(f"{BASE}/{rejected}/approve", headers=h).status_code == 409
    cancelled = apply(client, world.a.employee, "2026-10-07", "2026-10-07").json()["data"]["id"]
    client.patch(f"{BASE}/{cancelled}/cancel", headers=auth(world.a.employee))
    assert client.patch(f"{BASE}/{cancelled}/approve", headers=h).status_code == 409
    assert client.patch(f"{BASE}/999999/approve", headers=h).status_code == 404


def test_nobody_can_decide_their_own_request(client, world, factory):
    mine = apply(client, world.a.manager).json()["data"]["id"]
    assert client.patch(f"{BASE}/{mine}/approve", headers=auth(world.a.manager)).status_code == 403
    assert client.patch(f"{BASE}/{mine}/reject", json={"reason": "no"}, headers=auth(world.a.manager)).status_code == 403
    assert client.patch(f"{BASE}/{mine}/approve", headers=auth(world.a.admin)).status_code == 200  # someone else can

    factory.make_employee(world.a.admin, "A-ADM")
    admins = apply(client, world.a.admin, "2026-11-02", "2026-11-03").json()["data"]["id"]
    assert client.patch(f"{BASE}/{admins}/approve", headers=auth(world.a.admin)).status_code == 403
    assert client.patch(f"{BASE}/{admins}/reject", json={"reason": "no"}, headers=auth(world.a.admin)).status_code == 403


def test_manager_cannot_decide_administrators_requests(client, world, factory):
    factory.make_employee(world.a.admin, "A-ADM")
    lid = apply(client, world.a.admin, "2026-11-02", "2026-11-03").json()["data"]["id"]
    assert client.patch(f"{BASE}/{lid}/approve", headers=auth(world.a.manager)).status_code == 403
    assert client.patch(f"{BASE}/{lid}/reject", json={"reason": "no"}, headers=auth(world.a.manager)).status_code == 403
    assert client.patch(f"{BASE}/{lid}/approve", headers=auth(world.a.employee)).status_code == 403  # no approve_leave at all


def test_decision_permissions_and_company_isolation(client, world, db):
    lid = apply(client, world.a.employee).json()["data"]["id"]
    assert client.patch(f"{BASE}/{lid}/approve", headers=auth(world.a.employee)).status_code == 403
    assert client.patch(f"{BASE}/{lid}/reject", json={"reason": "no"}, headers=auth(world.a.employee)).status_code == 403
    assert client.patch(f"{BASE}/{lid}/approve", headers=auth(world.a.client_user)).status_code == 403
    assert client.patch(f"{BASE}/{lid}/approve").status_code == 401
    assert client.patch(f"{BASE}/{lid}/approve", headers=auth(world.b.admin)).status_code == 404
    assert client.patch(f"{BASE}/{lid}/reject", json={"reason": "no"}, headers=auth(world.b.manager)).status_code == 404
    assert client.patch(f"{BASE}/{lid}/cancel", headers=auth(world.b.employee)).status_code == 404
    db.commit()
    assert db.query(LeaveRequest).get(lid).status.value == "pending"
    with granted(db, RoleName.EMPLOYEE.value, "approve_leave"):  # permission is what matters, not the role name
        assert client.patch(f"{BASE}/{lid}/approve", headers=auth(world.a.employee)).status_code == 403  # own request
    assert client.patch(f"{BASE}/{lid}/approve", headers=auth(world.super_admin)).status_code == 200


# ---- cancel -----------------------------------------------------------------------------

def test_cancel_rules(client, world, db):
    lid = apply(client, world.a.employee).json()["data"]["id"]
    assert client.patch(f"{BASE}/{lid}/cancel", headers=auth(world.a.manager)).status_code == 403  # not the owner
    assert client.patch(f"{BASE}/{lid}/cancel", headers=auth(world.a.admin)).status_code == 403
    res = client.patch(f"{BASE}/{lid}/cancel", headers=auth(world.a.employee))
    assert res.status_code == 200 and res.json()["data"]["status"] == "cancelled"
    assert client.patch(f"{BASE}/{lid}/cancel", headers=auth(world.a.employee)).status_code == 409
    approved = apply(client, world.a.employee, "2026-10-12", "2026-10-12").json()["data"]["id"]
    client.patch(f"{BASE}/{approved}/approve", headers=auth(world.a.manager))
    assert client.patch(f"{BASE}/{approved}/cancel", headers=auth(world.a.employee)).status_code == 409  # only while pending
    db.commit()
    assert db.query(ActivityLog).filter_by(entity_type="leave_request", entity_id=lid, action="cancelled").count() == 1
    assert client.patch(f"{BASE}/{lid}/cancel", headers=auth(world.a.client_user)).status_code == 403


# ---- listing ------------------------------------------------------------------------------

def test_list_visibility_by_role(client, world):
    mine = apply(client, world.a.employee).json()["data"]["id"]
    theirs = apply(client, world.a.manager, "2026-11-02", "2026-11-03").json()["data"]["id"]
    apply(client, world.b.employee)

    def ids(user):
        return {r["id"] for r in client.get(BASE, headers=auth(user)).json()["data"]}

    assert ids(world.a.employee) == {mine}  # only their own
    assert ids(world.a.manager) == {mine, theirs}  # view_leave: whole company, but not company B
    assert ids(world.a.admin) == {mine, theirs}
    assert ids(world.b.admin) != ids(world.a.admin) and len(ids(world.b.admin)) == 1
    assert client.get(BASE, headers=auth(world.a.client_user)).status_code == 403
    assert client.get(BASE).status_code == 401
    forged = client.get(BASE, params={"employee_id": world.a.manager_emp.id}, headers=auth(world.a.employee)).json()
    assert forged["total"] == 0  # an employee cannot filter their way to someone else's leave


def test_list_filters_sort_and_pagination(client, world, db):
    dept = make_dept(db, world.a.company)
    world.a.manager_emp.department_id = dept.id
    db.commit()
    e1 = apply(client, world.a.employee, "2026-03-02", "2026-03-03").json()["data"]["id"]
    e2 = apply(client, world.a.employee, "2026-06-01", "2026-06-05", "sick").json()["data"]["id"]
    m1 = apply(client, world.a.manager, "2026-09-07", "2026-09-07", reason="Passport renewal").json()["data"]["id"]
    client.patch(f"{BASE}/{e1}/approve", headers=auth(world.a.admin))
    h = auth(world.a.admin)

    def ids(**params):
        return {r["id"] for r in client.get(BASE, params=params, headers=h).json()["data"]}

    assert ids(status="approved") == {e1} and ids(status="pending") == {e2, m1}
    assert ids(type="sick") == {e2} and ids(type="casual") == {e1, m1}
    assert ids(employee_id=world.a.manager_emp.id) == {m1}
    assert ids(department_id=dept.id) == {m1}
    assert ids(date_from="2026-06-03") == {e2, m1}  # overlaps the window
    assert ids(date_to="2026-03-02") == {e1}
    assert ids(date_from="2026-03-04", date_to="2026-05-30") == set()
    assert ids(search="passport") == {m1}
    assert ids(search=world.a.employee.name) == {e1, e2}
    assert ids(search="nothing-matches") == set()

    page = client.get(BASE, params={"limit": 2, "page": 2, "sort_by": "start_date", "sort_order": "asc"}, headers=h).json()
    assert page["total"] == 3 and page["total_pages"] == 2 and [r["id"] for r in page["data"]] == [m1]
    assert client.get(BASE, params={"sort_by": "reason; drop"}, headers=h).status_code == 422
    assert client.get(BASE, params={"status": "maybe"}, headers=h).status_code == 422
    assert client.get(BASE, params={"limit": 500}, headers=h).status_code == 422
