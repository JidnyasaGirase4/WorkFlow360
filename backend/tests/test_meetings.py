from datetime import date, timedelta

from sqlalchemy import select

from app.core.enums import RoleName
from app.models import ActivityLog, MeetingParticipant, Notification, Project
from tests.conftest import auth

BASE = "/api/v1/meetings"
TOMORROW = date.today() + timedelta(days=1)


def payload(**over):
    return {
        "title": "Sprint review",
        "meeting_date": str(TOMORROW),
        "start_time": "10:00",
        "end_time": "11:00",
        "meeting_type": "internal",
        **over,
    }


def make(client, headers, **over) -> dict:
    res = client.post(BASE, json=payload(**over), headers=headers)
    assert res.status_code == 201, res.text
    return res.json()["data"]


def make_project(db, tenant, client_record=None, code="P-1") -> Project:
    project = Project(company_id=tenant.company.id, client_id=client_record.id if client_record else None, name=f"Project {code}", project_code=code)
    db.add(project)
    db.commit()
    return project


def ids(res) -> list[int]:
    return [m["id"] for m in res.json()["data"]]


def notes_for(db, user, title_part: str | None = None) -> list[Notification]:
    db.rollback()  # end the fixture's old snapshot so we read what the API committed
    rows = db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.id)).all()
    return [n for n in rows if title_part is None or title_part in n.title]


# ---- CRUD ------------------------------------------------------------------

def test_crud_and_output_shape(client, world, db):
    project = make_project(db, world.a, world.a.client_record)
    h = auth(world.a.manager)
    res = client.post(
        BASE,
        json=payload(
            client_id=world.a.client_record.id, project_id=project.id, meeting_type="client_meeting",
            meeting_link="https://meet.example.test/abc", location="HQ", description="Demo",
            participant_user_ids=[world.a.employee.id, world.a.client_user.id],
        ),
        headers=h,
    )
    assert res.status_code == 201, res.text
    assert res.json()["success"] is True
    m = res.json()["data"]
    assert m["client_name"] == world.a.client_record.company_name and m["project_name"] == project.name
    assert m["created_by"] == world.a.manager.id and m["created_by_name"] == world.a.manager.name
    assert m["status"] == "scheduled" and m["company_id"] == world.a.company.id
    by_user = {p["user_id"]: p for p in m["participants"]}
    assert set(by_user) == {world.a.manager.id, world.a.employee.id, world.a.client_user.id}
    assert by_user[world.a.manager.id]["response_status"] == "accepted"  # creator auto-accepted
    assert by_user[world.a.employee.id]["response_status"] == "pending"
    assert by_user[world.a.employee.id]["role"] == "employee" and by_user[world.a.client_user.id]["role"] == "client"
    assert by_user[world.a.employee.id]["name"] == world.a.employee.name

    got = client.get(f"{BASE}/{m['id']}", headers=h).json()["data"]
    assert got["meeting_link"] == "https://meet.example.test/abc" and got["start_time"].startswith("10:00")

    upd = client.put(f"{BASE}/{m['id']}", json={"title": "Sprint review v2", "location": "Room 2", "status": "completed"}, headers=h)
    assert upd.status_code == 200
    assert upd.json()["data"]["title"] == "Sprint review v2" and upd.json()["data"]["status"] == "completed"
    assert len(upd.json()["data"]["participants"]) == 3  # untouched

    assert client.delete(f"{BASE}/{m['id']}", headers=h).status_code == 200
    assert client.get(f"{BASE}/{m['id']}", headers=h).status_code == 404
    db.rollback()
    actions = {a.action for a in db.scalars(select(ActivityLog).where(ActivityLog.entity_type == "meeting"))}
    assert {"created", "updated", "status_changed", "deleted"} <= actions
    assert db.scalars(select(MeetingParticipant)).all() == []  # participants cascade with the meeting


def test_validation_rules(client, world, db):
    h = auth(world.a.admin)
    assert client.post(BASE, json=payload(end_time="09:00"), headers=h).status_code == 422
    assert client.post(BASE, json=payload(end_time="10:00"), headers=h).status_code == 422
    assert client.post(BASE, json=payload(meeting_date="2026-02-30"), headers=h).status_code == 422
    assert client.post(BASE, json=payload(start_time="25:00"), headers=h).status_code == 422
    assert client.post(BASE, json=payload(meeting_type="party"), headers=h).status_code == 422
    assert client.post(BASE, json=payload(status="completed"), headers=h).status_code == 422  # status is PUT-only
    assert client.post(BASE, json=payload(meeting_link="not a url at all"), headers=h).status_code == 422
    assert client.post(BASE, json={"title": "No date"}, headers=h).status_code == 422
    assert client.post(BASE, json=payload(end_time=None), headers=h).status_code == 201  # end_time optional

    m = make(client, h)
    # end/start are validated against the stored values on update
    assert client.put(f"{BASE}/{m['id']}", json={"end_time": "09:30"}, headers=h).status_code == 422
    assert client.put(f"{BASE}/{m['id']}", json={"start_time": "12:00"}, headers=h).status_code == 422
    assert client.put(f"{BASE}/{m['id']}", json={"start_time": "12:00", "end_time": "13:00"}, headers=h).status_code == 200
    assert client.put(f"{BASE}/{m['id']}", json={"title": None}, headers=h).status_code == 422
    assert client.put(f"{BASE}/{m['id']}", json={"status": "postponed"}, headers=h).status_code == 422


def test_client_project_and_participant_references(client, world, db, factory):
    h = auth(world.a.admin)
    other_client = factory.make_client(world.a.company, "Second client")
    proj_of_a = make_project(db, world.a, world.a.client_record, "PA")
    proj_of_other = make_project(db, world.a, other_client, "PO")
    proj_of_b = make_project(db, world.b, world.b.client_record, "PB")

    assert client.post(BASE, json=payload(client_id=world.b.client_record.id), headers=h).status_code == 404
    assert client.post(BASE, json=payload(project_id=proj_of_b.id), headers=h).status_code == 404
    assert client.post(BASE, json=payload(client_id=999999), headers=h).status_code == 404
    # project must belong to the client when both are given
    assert client.post(BASE, json=payload(client_id=world.a.client_record.id, project_id=proj_of_other.id), headers=h).status_code == 422
    ok = client.post(BASE, json=payload(client_id=world.a.client_record.id, project_id=proj_of_a.id), headers=h)
    assert ok.status_code == 201
    # a project alone pulls in its client
    only_project = make(client, h, project_id=proj_of_a.id)
    assert only_project["client_id"] == world.a.client_record.id and only_project["client_name"] == world.a.client_record.company_name
    # switching the client away from the project's client is refused
    assert client.put(f"{BASE}/{only_project['id']}", json={"client_id": other_client.id}, headers=h).status_code == 422

    # participants must be users of the same company
    assert client.post(BASE, json=payload(participant_user_ids=[world.b.employee.id]), headers=h).status_code == 404
    assert client.post(BASE, json=payload(participant_user_ids=[999999]), headers=h).status_code == 404

    # client-role participants only for their own client's meetings
    assert client.post(BASE, json=payload(participant_user_ids=[world.a.client_user.id]), headers=h).status_code == 422  # meeting has no client
    assert client.post(BASE, json=payload(client_id=other_client.id, participant_user_ids=[world.a.client_user.id]), headers=h).status_code == 422
    assert client.post(BASE, json=payload(client_id=world.a.client_record.id, participant_user_ids=[world.a.client_user.id]), headers=h).status_code == 201
    m = make(client, h, client_id=other_client.id)
    add = client.post(f"{BASE}/{m['id']}/participants", json={"user_ids": [world.a.client_user.id]}, headers=h)
    assert add.status_code == 422
    # moving an existing meeting to another client is refused while a client user of the old one attends
    m2 = make(client, h, client_id=world.a.client_record.id, participant_user_ids=[world.a.client_user.id])
    assert client.put(f"{BASE}/{m2['id']}", json={"client_id": other_client.id}, headers=h).status_code == 422


def test_participants_add_and_replace(client, world):
    h = auth(world.a.manager)
    m = make(client, h, participant_user_ids=[world.a.employee.id])
    res = client.post(f"{BASE}/{m['id']}/participants", json={"user_ids": [world.a.employee.id, world.a.admin.id]}, headers=h)
    assert res.status_code == 200, res.text
    assert sorted(p["user_id"] for p in res.json()["data"]["participants"]) == sorted([world.a.manager.id, world.a.employee.id, world.a.admin.id])
    assert client.post(f"{BASE}/{m['id']}/participants", json={"user_ids": []}, headers=h).status_code == 422
    assert client.post(f"{BASE}/{m['id']}/participants", json={"user_ids": [world.b.admin.id]}, headers=h).status_code == 404

    # PUT replaces the list, but the creator always stays
    upd = client.put(f"{BASE}/{m['id']}", json={"participant_user_ids": [world.a.admin.id]}, headers=h)
    assert upd.status_code == 200
    assert sorted(p["user_id"] for p in upd.json()["data"]["participants"]) == sorted([world.a.manager.id, world.a.admin.id])


# ---- permissions -----------------------------------------------------------

def test_only_admin_and_manager_manage(client, world):
    m = make(client, auth(world.a.admin), participant_user_ids=[world.a.employee.id])
    for user in (world.a.employee, world.a.client_user):
        h = auth(user)
        assert client.post(BASE, json=payload(), headers=h).status_code == 403
        assert client.put(f"{BASE}/{m['id']}", json={"title": "x"}, headers=h).status_code == 403
        assert client.delete(f"{BASE}/{m['id']}", headers=h).status_code == 403
        assert client.post(f"{BASE}/{m['id']}/participants", json={"user_ids": [user.id]}, headers=h).status_code == 403
        assert client.get(BASE, headers=h).status_code == 200  # view_meetings
    assert client.get(BASE).status_code == 401
    assert client.post(BASE, json=payload(), headers=auth(world.a.manager)).status_code == 201


def test_company_isolation(client, world):
    m = make(client, auth(world.a.admin))
    b = auth(world.b.admin)
    url = f"{BASE}/{m['id']}"
    assert client.get(url, headers=b).status_code == 404
    assert client.put(url, json={"title": "x"}, headers=b).status_code == 404
    assert client.delete(url, headers=b).status_code == 404
    assert client.post(f"{url}/participants", json={"user_ids": [world.b.employee.id]}, headers=b).status_code == 404
    assert client.patch(f"{url}/participants/{world.a.admin.id}", json={"response_status": "declined"}, headers=b).status_code == 404
    assert client.get(BASE, headers=b).json()["total"] == 0


# ---- visibility ------------------------------------------------------------

def test_visibility_per_role(client, world, factory):
    admin, manager = auth(world.a.admin), auth(world.a.manager)
    other_client = factory.make_client(world.a.company, "Other client")
    other_client_user = factory.make_user(world.a.company, RoleName.CLIENT, client=other_client)

    with_employee = make(client, admin, title="With employee", participant_user_ids=[world.a.employee.id])
    for_client = make(client, admin, title="For client", client_id=world.a.client_record.id)
    internal = make(client, admin, title="Internal only")
    by_manager = make(client, manager, title="By manager")
    attended_by_client_user = make(client, admin, title="Client user attends", client_id=other_client.id, participant_user_ids=[other_client_user.id])

    everything = {with_employee["id"], for_client["id"], internal["id"], by_manager["id"], attended_by_client_user["id"]}
    assert set(ids(client.get(BASE, headers=admin))) == everything
    assert set(ids(client.get(BASE, headers=manager))) == everything

    emp = auth(world.a.employee)
    assert ids(client.get(BASE, headers=emp)) == [with_employee["id"]]
    assert client.get(f"{BASE}/{with_employee['id']}", headers=emp).status_code == 200
    for hidden in (for_client, internal, by_manager):
        assert client.get(f"{BASE}/{hidden['id']}", headers=emp).status_code == 404

    cli = auth(world.a.client_user)
    assert ids(client.get(BASE, headers=cli)) == [for_client["id"]]
    assert client.get(f"{BASE}/{for_client['id']}", headers=cli).status_code == 200
    for hidden in (with_employee, internal, by_manager, attended_by_client_user):
        assert client.get(f"{BASE}/{hidden['id']}", headers=cli).status_code == 404

    # a client user of a different client only gets the meeting they attend
    other = auth(other_client_user)
    assert ids(client.get(BASE, headers=other)) == [attended_by_client_user["id"]]
    assert client.get(f"{BASE}/{for_client['id']}", headers=other).status_code == 404


def test_filters_search_sort(client, world, db):
    h = auth(world.a.admin)
    project = make_project(db, world.a, world.a.client_record)
    today = date.today()
    past = make(client, h, title="Kickoff call", meeting_date=str(today - timedelta(days=10)), meeting_type="sales")
    client.put(f"{BASE}/{past['id']}", json={"status": "completed"}, headers=h)
    soon = make(client, h, title="Design review", meeting_date=str(today + timedelta(days=2)), meeting_type="project_review", project_id=project.id, client_id=world.a.client_record.id)
    later = make(client, h, title="Budget review", meeting_date=str(today + timedelta(days=20)), meeting_type="internal")
    cancelled = make(client, h, title="Cancelled review", meeting_date=str(today + timedelta(days=3)))
    client.put(f"{BASE}/{cancelled['id']}", json={"status": "cancelled"}, headers=h)
    mine_only = make(client, auth(world.a.manager), title="Manager sync", meeting_date=str(today + timedelta(days=4)))

    def get(**params):
        res = client.get(BASE, params=params, headers=h)
        assert res.status_code == 200, res.text
        return ids(res)

    assert get(status="completed") == [past["id"]]
    assert get(status="cancelled") == [cancelled["id"]]
    assert get(meeting_type="sales") == [past["id"]]
    assert get(client_id=world.a.client_record.id) == [soon["id"]]
    assert get(project_id=project.id) == [soon["id"]]
    assert set(get(search="review")) == {soon["id"], later["id"], cancelled["id"]}
    assert set(get(date_from=str(today), date_to=str(today + timedelta(days=3)))) == {soon["id"], cancelled["id"]}
    assert set(get(upcoming="true")) == {soon["id"], later["id"], mine_only["id"]}  # scheduled and today or later
    assert set(get(mine="true")) == {past["id"], soon["id"], later["id"], cancelled["id"]}  # created by the admin, not the manager's
    assert get(sort_by="meeting_date", sort_order="asc")[0] == past["id"]
    assert get(sort_by="title", sort_order="asc")[0] == later["id"]
    assert client.get(BASE, params={"sort_by": "description"}, headers=h).status_code == 422
    assert client.get(BASE, params={"date_from": "2026-12-01", "date_to": "2026-01-01"}, headers=h).status_code == 422
    page = client.get(BASE, params={"limit": 2, "page": 2, "sort_by": "meeting_date", "sort_order": "asc"}, headers=h).json()
    assert page["total"] == 5 and page["total_pages"] == 3 and len(page["data"]) == 2

    manager_mine = client.get(BASE, params={"mine": "true"}, headers=auth(world.a.manager))
    assert ids(manager_mine) == [mine_only["id"]]


# ---- participant responses ---------------------------------------------------

def test_participant_can_patch_only_own_response(client, world, factory):
    admin = auth(world.a.admin)
    outsider = factory.make_user(world.a.company, RoleName.EMPLOYEE)
    m = make(client, admin, participant_user_ids=[world.a.employee.id, world.a.manager.id])
    emp = auth(world.a.employee)
    url = f"{BASE}/{m['id']}/participants"

    res = client.patch(f"{url}/{world.a.employee.id}", json={"response_status": "declined"}, headers=emp)
    assert res.status_code == 200, res.text
    assert {p["user_id"]: p["response_status"] for p in res.json()["data"]["participants"]}[world.a.employee.id] == "declined"
    assert client.patch(f"{url}/{world.a.employee.id}", json={"response_status": "accepted"}, headers=emp).status_code == 200

    # cannot answer for someone else...
    assert client.patch(f"{url}/{world.a.manager.id}", json={"response_status": "accepted"}, headers=emp).status_code == 403
    # ...but admin/manager can answer for anyone
    by_admin = client.patch(f"{url}/{world.a.employee.id}", json={"response_status": "pending"}, headers=admin)
    assert by_admin.status_code == 200
    assert {p["user_id"]: p["response_status"] for p in by_admin.json()["data"]["participants"]}[world.a.employee.id] == "pending"
    assert client.patch(f"{url}/{world.a.employee.id}", json={"response_status": "accepted"}, headers=auth(world.a.manager)).status_code == 200

    # invalid value, unknown participant, and a user who cannot even see the meeting
    assert client.patch(f"{url}/{world.a.employee.id}", json={"response_status": "maybe"}, headers=emp).status_code == 422
    assert client.patch(f"{url}/{outsider.id}", json={"response_status": "accepted"}, headers=admin).status_code == 404
    assert client.patch(f"{url}/{outsider.id}", json={"response_status": "accepted"}, headers=auth(outsider)).status_code == 404
    # a client user attending can answer for themselves
    cm = make(client, admin, client_id=world.a.client_record.id, participant_user_ids=[world.a.client_user.id])
    own = client.patch(f"{BASE}/{cm['id']}/participants/{world.a.client_user.id}", json={"response_status": "accepted"}, headers=auth(world.a.client_user))
    assert own.status_code == 200


# ---- notifications -----------------------------------------------------------

def test_notifications_on_invite_reschedule_cancel_add_delete(client, world, db):
    h = auth(world.a.manager)
    emp, admin = world.a.employee, world.a.admin
    m = make(client, h, title="Roadmap", participant_user_ids=[emp.id])

    invites = notes_for(db, emp, "invitation")
    assert len(invites) == 1 and invites[0].type.value == "meeting"
    assert invites[0].reference_type == "meeting" and invites[0].reference_id == m["id"] and invites[0].is_read is False
    assert notes_for(db, world.a.manager) == []  # actor never notified

    # reschedule -> existing participants notified
    res = client.put(f"{BASE}/{m['id']}", json={"start_time": "14:00", "end_time": "15:00"}, headers=h)
    assert res.status_code == 200
    assert len(notes_for(db, emp, "rescheduled")) == 1
    assert notes_for(db, world.a.manager) == []
    # editing only the title does not notify anyone
    client.put(f"{BASE}/{m['id']}", json={"title": "Roadmap 2"}, headers=h)
    assert len(notes_for(db, emp)) == 2

    # adding a participant -> only the new one is invited
    client.post(f"{BASE}/{m['id']}/participants", json={"user_ids": [admin.id, emp.id]}, headers=h)
    assert len(notes_for(db, admin, "invitation")) == 1
    assert len(notes_for(db, emp)) == 2

    # cancelling -> everyone but the actor
    client.put(f"{BASE}/{m['id']}", json={"status": "cancelled"}, headers=h)
    assert len(notes_for(db, emp, "cancelled")) == 1 and len(notes_for(db, admin, "cancelled")) == 1
    assert notes_for(db, world.a.manager) == []
    # cancelling again does not re-notify
    client.put(f"{BASE}/{m['id']}", json={"status": "cancelled", "location": "x"}, headers=h)
    assert len(notes_for(db, emp, "cancelled")) == 1

    # deleting -> participants told
    before = len(notes_for(db, emp))
    client.delete(f"{BASE}/{m['id']}", headers=h)
    assert len(notes_for(db, emp)) == before + 1


def test_rescheduling_by_participant_admin_does_not_notify_self(client, world, db):
    m = make(client, auth(world.a.manager), participant_user_ids=[world.a.admin.id, world.a.employee.id])
    client.put(f"{BASE}/{m['id']}", json={"meeting_date": str(TOMORROW + timedelta(days=1))}, headers=auth(world.a.admin))
    assert len(notes_for(db, world.a.admin, "rescheduled")) == 0
    assert len(notes_for(db, world.a.manager, "rescheduled")) == 1  # the creator is a participant too
    assert len(notes_for(db, world.a.employee, "rescheduled")) == 1


def test_super_admin_creates_with_company(client, world):
    h = auth(world.super_admin)
    assert client.post(BASE, json=payload(), headers=h).status_code == 400
    res = client.post(BASE, params={"company_id": world.a.company.id}, json=payload(participant_user_ids=[world.a.employee.id]), headers=h)
    assert res.status_code == 201
    assert [p["user_id"] for p in res.json()["data"]["participants"]] == [world.a.employee.id]  # no company => not auto-added
