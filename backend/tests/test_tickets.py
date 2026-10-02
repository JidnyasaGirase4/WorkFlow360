import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.enums import RoleName, TicketStatus, UserStatus
from app.models import ActivityLog, Notification, Project, ProjectMember, Ticket, TicketAttachment, TicketComment
from app.services import tickets as ticket_service
from app.database.connection import engine
from tests.conftest import auth

BASE = "/api/v1/tickets"
PDF = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n"


@pytest.fixture
def db():
    """Own session at READ COMMITTED so rows written by API requests are visible without manual refreshes."""
    with Session(engine.execution_options(isolation_level="READ COMMITTED")) as session:
        yield session


def body(client_id, **over):
    return {"client_id": client_id, "subject": "Cannot log in", "description": "Login page throws an error", "priority": "high", "category": "Technical Issue", **over}


def create(client, user, client_id=None, **over):
    payload = body(client_id, **over)
    if client_id is None:
        payload.pop("client_id")
    res = client.post(BASE, json=payload, headers=auth(user))
    assert res.status_code == 201, res.text
    return res.json()["data"]


def make_ticket(client, world, **over):
    """A ticket raised by the admin for company A's client."""
    return create(client, world.a.admin, world.a.client_record.id, **over)


def set_status(client, user, ticket_id, status):
    return client.patch(f"{BASE}/{ticket_id}/status", json={"status": status}, headers=auth(user))


def assign(client, user, ticket_id, assignee):
    return client.patch(f"{BASE}/{ticket_id}/assign", json={"assigned_to": assignee.id}, headers=auth(user))


def comment(client, user, ticket_id, text="hello", internal=False):
    return client.post(f"{BASE}/{ticket_id}/comments", json={"comment": text, "is_internal": internal}, headers=auth(user))


def attach(client, user, ticket_id, *, filename="log.pdf", content=PDF, mime="application/pdf", **form):
    return client.post(f"{BASE}/{ticket_id}/attachments", headers=auth(user), files={"file": (filename, content, mime)}, data=form)


def make_project(db, tenant, code="P-1", client=None, members=()):
    project = Project(company_id=tenant.company.id, client_id=(client or tenant.client_record).id, name=f"Project {code}", project_code=code)
    db.add(project)
    db.flush()
    for emp in members:
        db.add(ProjectMember(project_id=project.id, employee_id=emp.id))
    db.commit()
    return project


# ---- creation & numbering ----------------------------------------------------------

def test_create_per_role(client, world):
    cid = world.a.client_record.id
    for user in (world.a.admin, world.a.manager, world.a.employee):
        data = create(client, user, cid)
        assert data["client_id"] == cid and data["client_name"] == world.a.client_record.company_name
        assert data["status"] == "open" and data["created_by"] == user.id and data["created_by_name"] == user.name
        assert data["comments"] == [] and data["comment_count"] == 0 and data["assigned_to"] is None
    # internal users must name the client
    res = client.post(BASE, json={"subject": "x y z", "description": "d"}, headers=auth(world.a.employee))
    assert res.status_code == 422 and "client_id" in res.json()["errors"]
    assert client.post(BASE, json=body(world.b.client_record.id), headers=auth(world.a.admin)).status_code == 404  # other company's client
    assert client.post(BASE, json=body(cid, status="closed"), headers=auth(world.a.admin)).status_code == 422  # unknown field
    assert client.post(BASE, json=body(cid, priority="asap"), headers=auth(world.a.admin)).status_code == 422
    assert client.post(BASE, json=body(cid, subject=""), headers=auth(world.a.admin)).status_code == 422
    assert client.post(BASE, json=body(cid)).status_code == 401
    assert client.post(BASE, json=body(cid), headers=auth(world.super_admin)).status_code == 400


def test_client_user_is_forced_to_own_client(client, world, factory):
    own = world.a.client_record
    assert create(client, world.a.client_user)["client_id"] == own.id
    assert create(client, world.a.client_user, own.id)["client_id"] == own.id
    other = factory.make_client(world.a.company, "Rival")
    res = client.post(BASE, json=body(other.id), headers=auth(world.a.client_user))
    assert res.status_code == 422
    assert client.post(BASE, json=body(world.b.client_record.id), headers=auth(world.a.client_user)).status_code == 422


def test_numbering_is_sequential_per_company(client, world):
    numbers_a = [make_ticket(client, world)["ticket_number"] for _ in range(3)]
    assert numbers_a == ["TCK-0001", "TCK-0002", "TCK-0003"]
    assert create(client, world.b.admin, world.b.client_record.id)["ticket_number"] == "TCK-0001"


def test_number_collision_is_retried_once(client, world, monkeypatch):
    make_ticket(client, world)  # TCK-0001 exists
    real = ticket_service._next_number
    calls = []

    def flaky(db, company_id):
        calls.append(1)
        return "TCK-0001" if len(calls) == 1 else real(db, company_id)

    monkeypatch.setattr(ticket_service, "_next_number", flaky)
    assert make_ticket(client, world)["ticket_number"] == "TCK-0002" and len(calls) == 2
    monkeypatch.setattr(ticket_service, "_next_number", lambda db, company_id: "TCK-0001")
    assert client.post(BASE, json=body(world.a.client_record.id), headers=auth(world.a.admin)).status_code == 409  # second attempt also collides


def test_create_with_project_rules(client, world, db, factory):
    project = make_project(db, world.a, members=[world.a.employee_emp])
    ok = make_ticket(client, world, project_id=project.id)
    assert ok["project_id"] == project.id and ok["project_name"] == project.name
    other_client = factory.make_client(world.a.company, "Rival")
    assert client.post(BASE, json=body(other_client.id, project_id=project.id), headers=auth(world.a.admin)).status_code == 422
    assert client.post(BASE, json=body(world.a.client_record.id, project_id=make_project(db, world.b, "P-B").id), headers=auth(world.a.admin)).status_code == 404
    # an employee cannot hang a ticket on a project they are not a member of
    hidden = make_project(db, world.a, "P-2")
    assert client.post(BASE, json=body(world.a.client_record.id, project_id=hidden.id), headers=auth(world.a.employee)).status_code == 404
    assert client.post(BASE, json=body(world.a.client_record.id, project_id=hidden.id), headers=auth(world.a.client_user)).status_code == 201  # client's own project
    assert client.post(BASE, json=body(world.a.client_record.id, project_id=999999), headers=auth(world.a.admin)).status_code == 404


def test_create_writes_audit_and_notifies_staff_for_client_tickets(client, world, db):
    data = create(client, world.a.client_user)
    assert db.scalar(select(ActivityLog.id).where(ActivityLog.action == "created", ActivityLog.entity_type == "ticket", ActivityLog.entity_id == data["id"]))
    notified = set(db.scalars(select(Notification.user_id).where(Notification.reference_type == "ticket", Notification.reference_id == data["id"])))
    assert notified == {world.a.admin.id, world.a.manager.id}
    before = db.scalar(select(Notification.id).order_by(Notification.id.desc()))
    make_ticket(client, world)  # internal creation notifies nobody
    assert db.scalar(select(Notification.id).order_by(Notification.id.desc())) == before


# ---- row-level visibility / isolation ---------------------------------------------------

def test_row_level_visibility(client, world, db, factory):
    cid = world.a.client_record.id
    mine = create(client, world.a.employee, cid, subject="Created by employee")
    assigned = make_ticket(client, world, subject="Assigned to employee")
    assert assign(client, world.a.admin, assigned["id"], world.a.employee).status_code == 200
    unrelated = make_ticket(client, world, subject="Unrelated")
    other_client = factory.make_client(world.a.company, "Rival")
    other_client_user = factory.make_user(world.a.company, RoleName.CLIENT, "rival@test.local", client=other_client)
    rival_ticket = create(client, world.a.admin, other_client.id, subject="Rival ticket")

    def ids(user):
        return {t["id"] for t in client.get(BASE, headers=auth(user), params={"limit": 100}).json()["data"]}

    assert ids(world.a.admin) == ids(world.a.manager) == {mine["id"], assigned["id"], unrelated["id"], rival_ticket["id"]}
    assert ids(world.a.employee) == {mine["id"], assigned["id"]}
    assert ids(world.a.client_user) == {mine["id"], assigned["id"], unrelated["id"]}
    assert ids(other_client_user) == {rival_ticket["id"]}
    assert ids(world.b.admin) == set()
    for hidden in (unrelated, rival_ticket):
        assert client.get(f"{BASE}/{hidden['id']}", headers=auth(world.a.employee)).status_code == 404
    assert client.get(f"{BASE}/{rival_ticket['id']}", headers=auth(world.a.client_user)).status_code == 404
    assert client.get(f"{BASE}/{mine['id']}", headers=auth(world.b.admin)).status_code == 404
    assert client.get(f"{BASE}/{mine['id']}", headers=auth(world.b.client_user)).status_code == 404
    assert client.get(f"{BASE}/{unrelated['id']}", headers=auth(world.a.manager)).status_code == 200
    # every mutation is 404 for another company
    hb = auth(world.b.admin)
    tid = unrelated["id"]
    assert client.put(f"{BASE}/{tid}", json={"subject": "hax"}, headers=hb).status_code == 404
    assert client.delete(f"{BASE}/{tid}", headers=hb).status_code == 404
    assert client.patch(f"{BASE}/{tid}/status", json={"status": "resolved"}, headers=hb).status_code == 404
    assert client.patch(f"{BASE}/{tid}/assign", json={"assigned_to": world.b.employee.id}, headers=hb).status_code == 404
    assert comment(client, world.b.admin, tid).status_code == 404
    assert attach(client, world.b.admin, tid).status_code == 404
    assert client.get(f"{BASE}/{tid}/comments", headers=hb).status_code == 404
    assert client.get(f"{BASE}/{tid}/attachments", headers=hb).status_code == 404
    assert client.get(f"/api/v1/clients/{cid}/tickets", headers=hb).status_code == 404
    assert client.get(BASE).status_code == 401


# ---- assignment ---------------------------------------------------------------------

def test_assign_rules_notification_and_audit(client, world, db, factory):
    t = make_ticket(client, world)
    res = assign(client, world.a.manager, t["id"], world.a.employee)
    assert res.status_code == 200 and res.json()["data"]["assigned_to"] == world.a.employee.id and res.json()["data"]["assignee_name"] == world.a.employee.name
    note = db.scalar(select(Notification).where(Notification.user_id == world.a.employee.id, Notification.reference_id == t["id"]))
    assert note is not None and note.type.value == "ticket"
    assert db.scalar(select(ActivityLog.id).where(ActivityLog.action == "assigned", ActivityLog.entity_id == t["id"]))
    # an admin assigning to themselves does not notify themselves
    assert assign(client, world.a.admin, t["id"], world.a.admin).status_code == 200
    assert db.scalar(select(Notification.id).where(Notification.user_id == world.a.admin.id, Notification.reference_id == t["id"], Notification.title.like("%assigned to you%"))) is None
    # unassign
    res = client.patch(f"{BASE}/{t['id']}/assign", json={"assigned_to": None}, headers=auth(world.a.admin))
    assert res.status_code == 200 and res.json()["data"]["assigned_to"] is None

    # who may assign
    assert assign(client, world.a.employee, t["id"], world.a.employee).status_code in (403, 404)
    assigned = make_ticket(client, world)
    assign(client, world.a.admin, assigned["id"], world.a.employee)
    assert assign(client, world.a.employee, assigned["id"], world.a.manager).status_code == 403  # visible to them, still not allowed
    assert assign(client, world.a.client_user, t["id"], world.a.employee).status_code == 403
    # who may be assigned
    assert assign(client, world.a.admin, t["id"], world.a.client_user).status_code == 422
    assert assign(client, world.a.admin, t["id"], world.b.employee).status_code == 404
    assert assign(client, world.a.admin, t["id"], world.super_admin).status_code == 404
    inactive = factory.make_user(world.a.company, RoleName.EMPLOYEE, "gone@test.local")
    inactive.status = UserStatus.INACTIVE
    db.commit()
    assert assign(client, world.a.admin, t["id"], inactive).status_code == 422
    assert client.patch(f"{BASE}/{t['id']}/assign", json={"assigned_to": 999999}, headers=auth(world.a.admin)).status_code == 404
    assert client.patch(f"{BASE}/{t['id']}/assign", json={"user": 1}, headers=auth(world.a.admin)).status_code == 422


# ---- status workflow ---------------------------------------------------------------

@pytest.mark.parametrize(
    "path",
    [
        ["in_progress", "waiting_for_client", "open", "in_progress", "resolved", "closed"],
        ["waiting_for_client", "resolved", "open", "resolved", "in_progress", "resolved", "closed"],
    ],
)
def test_valid_transition_paths_and_resolved_at(client, world, path):
    t = make_ticket(client, world)
    for status in path:
        res = set_status(client, world.a.manager, t["id"], status)
        assert res.status_code == 200, (status, res.text)
        data = res.json()["data"]
        assert data["status"] == status
        assert (data["resolved_at"] is not None) == (status in ("resolved", "closed"))


def test_resolved_at_set_kept_on_close_and_cleared_on_reopen(client, world):
    t = make_ticket(client, world)
    assert set_status(client, world.a.admin, t["id"], "resolved").json()["data"]["resolved_at"] is not None
    stamp = client.get(f"{BASE}/{t['id']}", headers=auth(world.a.admin)).json()["data"]["resolved_at"]
    assert set_status(client, world.a.admin, t["id"], "closed").json()["data"]["resolved_at"] == stamp
    assert set_status(client, world.a.admin, t["id"], "open").json()["data"]["resolved_at"] is None


@pytest.mark.parametrize(
    "start,target",
    [("open", "closed"), ("in_progress", "closed"), ("waiting_for_client", "closed"), ("open", "open"), ("resolved", "resolved")],
)
def test_invalid_transitions_rejected(client, world, start, target):
    t = make_ticket(client, world)
    if start != "open":
        assert set_status(client, world.a.admin, t["id"], start).status_code == 200
    assert set_status(client, world.a.admin, t["id"], target).status_code == 409
    assert set_status(client, world.a.admin, t["id"], "archived").status_code == 422


def test_closed_ticket_is_read_only_and_only_managers_reopen(client, world):
    t = make_ticket(client, world)
    assert assign(client, world.a.admin, t["id"], world.a.employee).status_code == 200
    for status in ("resolved", "closed"):
        assert set_status(client, world.a.admin, t["id"], status).status_code == 200
    tid = t["id"]
    for user in (world.a.admin, world.a.manager, world.a.employee, world.a.client_user):
        assert comment(client, user, tid).status_code == 409, user.email
    assert attach(client, world.a.admin, tid).status_code == 409
    assert client.put(f"{BASE}/{tid}", json={"subject": "New subject"}, headers=auth(world.a.admin)).status_code == 409
    assert assign(client, world.a.admin, tid, world.a.manager).status_code == 409
    # closed -> anything but open is refused, even for admins
    assert set_status(client, world.a.admin, tid, "in_progress").status_code == 409
    assert set_status(client, world.a.admin, tid, "resolved").status_code == 409
    # employees and clients cannot reopen
    assert set_status(client, world.a.employee, tid, "open").status_code == 403
    assert set_status(client, world.a.client_user, tid, "open").status_code == 403
    assert set_status(client, world.a.manager, tid, "open").status_code == 200
    assert comment(client, world.a.client_user, tid).status_code == 201  # writable again


def test_client_status_rules(client, world, db, factory):
    t = create(client, world.a.client_user)
    tid = t["id"]
    for status in ("in_progress", "resolved", "waiting_for_client"):
        assert set_status(client, world.a.client_user, tid, status).status_code == 403
    assert set_status(client, world.a.admin, tid, "resolved").status_code == 200
    assert set_status(client, world.a.client_user, tid, "open").status_code == 200  # reopen a resolved ticket
    assert set_status(client, world.a.client_user, tid, "closed").status_code == 200  # close their own ticket
    assert set_status(client, world.a.client_user, tid, "open").status_code == 403
    other_client = factory.make_client(world.a.company, "Rival")
    other = create(client, world.a.admin, other_client.id)
    assert set_status(client, world.a.client_user, other["id"], "closed").status_code == 404
    assert set_status(client, world.b.client_user, tid, "closed").status_code == 404


def test_employee_status_rules(client, world):
    cid = world.a.client_record.id
    t = make_ticket(client, world)
    assert set_status(client, world.a.employee, t["id"], "in_progress").status_code == 404  # not theirs: invisible
    assign(client, world.a.admin, t["id"], world.a.employee)
    for status in ("in_progress", "waiting_for_client", "open", "resolved", "open"):
        assert set_status(client, world.a.employee, t["id"], status).status_code == 200, status
    assert set_status(client, world.a.employee, t["id"], "resolved").status_code == 200
    assert set_status(client, world.a.employee, t["id"], "closed").status_code == 403
    # a ticket they merely created (not assigned to them) is theirs to view but not to move
    own = create(client, world.a.employee, cid)
    assert set_status(client, world.a.employee, own["id"], "in_progress").status_code == 403
    assert set_status(client, world.a.manager, own["id"], "in_progress").status_code == 200


def test_status_change_audit_and_notifications(client, world, db):
    t = create(client, world.a.client_user)  # creator = client user
    assign(client, world.a.admin, t["id"], world.a.employee)
    other_client_user = world.a.client_user
    res = set_status(client, world.a.manager, t["id"], "in_progress")
    assert res.status_code == 200
    log = db.scalar(select(ActivityLog).where(ActivityLog.action == "status_changed", ActivityLog.entity_id == t["id"]))
    assert log is not None and log.user_id == world.a.manager.id and "in_progress" in log.description
    recipients = set(db.scalars(select(Notification.user_id).where(Notification.reference_id == t["id"], Notification.title.like("%is now%"))))
    assert recipients == {world.a.employee.id, other_client_user.id}  # assignee + creator/client users, never the actor
    # the assignee changing status notifies the client but not themselves
    db.query(Notification).delete()
    db.commit()
    assert set_status(client, world.a.employee, t["id"], "waiting_for_client").status_code == 200
    assert set(db.scalars(select(Notification.user_id))) == {other_client_user.id}


# ---- comments -----------------------------------------------------------------------

def test_comments_and_internal_visibility(client, world, db):
    t = make_ticket(client, world)
    tid = t["id"]
    assign(client, world.a.admin, tid, world.a.employee)
    pub = comment(client, world.a.client_user, tid, "It still fails")
    assert pub.status_code == 201
    assert pub.json()["data"]["user_name"] == world.a.client_user.name and pub.json()["data"]["user_role"] == "client" and pub.json()["data"]["is_internal"] is False
    assert comment(client, world.a.employee, tid, "Looking into it").status_code == 201
    internal = comment(client, world.a.employee, tid, "Root cause: cache. Do not tell the client", internal=True)
    assert internal.status_code == 201 and internal.json()["data"]["is_internal"] is True
    assert comment(client, world.a.manager, tid, "manager note", internal=True).status_code == 201
    assert comment(client, world.a.client_user, tid, "sneaky", internal=True).status_code == 422
    assert client.post(f"{BASE}/{tid}/comments", json={"comment": ""}, headers=auth(world.a.admin)).status_code == 422

    # staff see everything, the client never sees or counts internal comments
    listed = client.get(f"{BASE}/{tid}/comments", headers=auth(world.a.admin)).json()["data"]
    assert [c["is_internal"] for c in listed] == [False, False, True, True]
    seen = client.get(f"{BASE}/{tid}/comments", headers=auth(world.a.client_user)).json()["data"]
    assert [c["comment"] for c in seen] == ["It still fails", "Looking into it"]
    detail = client.get(f"{BASE}/{tid}", headers=auth(world.a.client_user))
    assert detail.json()["data"]["comment_count"] == 2 and len(detail.json()["data"]["comments"]) == 2
    assert "Root cause" not in detail.text and "manager note" not in detail.text
    assert client.get(f"{BASE}/{tid}", headers=auth(world.a.admin)).json()["data"]["comment_count"] == 4
    rows = {r["id"]: r for r in client.get(BASE, headers=auth(world.a.client_user)).json()["data"]}
    assert rows[tid]["comment_count"] == 2
    assert {r["id"]: r["comment_count"] for r in client.get(BASE, headers=auth(world.a.admin)).json()["data"]}[tid] == 4
    assert "Root cause" not in client.get(BASE, headers=auth(world.a.client_user)).text
    # ...and internal comments never notify client users
    titles = db.scalars(select(Notification.title).where(Notification.user_id == world.a.client_user.id, Notification.reference_id == tid)).all()
    assert titles and all("internal" not in title for title in titles)
    assert db.scalar(select(ActivityLog.id).where(ActivityLog.action == "commented", ActivityLog.entity_id == tid))


def test_client_reply_reopens_waiting_ticket(client, world):
    t = make_ticket(client, world)
    set_status(client, world.a.admin, t["id"], "waiting_for_client")
    comment(client, world.a.admin, t["id"], "Any update?")  # staff comment does not move it
    assert client.get(f"{BASE}/{t['id']}", headers=auth(world.a.admin)).json()["data"]["status"] == "waiting_for_client"
    comment(client, world.a.client_user, t["id"], "Here you go")
    assert client.get(f"{BASE}/{t['id']}", headers=auth(world.a.admin)).json()["data"]["status"] == "open"
    # an in-progress ticket is not touched by a client comment
    set_status(client, world.a.admin, t["id"], "in_progress")
    comment(client, world.a.client_user, t["id"], "ping")
    assert client.get(f"{BASE}/{t['id']}", headers=auth(world.a.admin)).json()["data"]["status"] == "in_progress"


def test_comment_access(client, world):
    t = make_ticket(client, world)
    assert comment(client, world.a.employee, t["id"]).status_code == 404  # employee unrelated to the ticket
    assert comment(client, world.b.client_user, t["id"]).status_code == 404
    assert comment(client, world.a.client_user, 999999).status_code == 404


# ---- attachments ----------------------------------------------------------------------

def test_attachment_upload_list_download_delete(client, world, db):
    t = make_ticket(client, world)
    tid = t["id"]
    res = attach(client, world.a.client_user, tid)
    assert res.status_code == 201, res.text
    att = res.json()["data"]
    assert att["file_name"] == "log.pdf" and att["uploaded_by_name"] == world.a.client_user.name and "file_path" not in att
    row = db.get(TicketAttachment, att["id"])
    path = get_settings().upload_path / row.file_path
    assert row.file_path.startswith(f"{world.a.company.id}/tickets/") and path.read_bytes() == PDF
    assert [a["id"] for a in client.get(f"{BASE}/{tid}/attachments", headers=auth(world.a.admin)).json()["data"]] == [att["id"]]
    assert client.get(f"{BASE}/{tid}", headers=auth(world.a.admin)).json()["data"]["attachments"][0]["id"] == att["id"]
    dl = client.get(f"{BASE}/{tid}/attachments/{att['id']}/download", headers=auth(world.a.client_user))
    assert dl.status_code == 200 and dl.content == PDF and dl.headers["content-disposition"].startswith("attachment")
    # authorisation
    assert client.get(f"{BASE}/{tid}/attachments/{att['id']}/download", headers=auth(world.a.employee)).status_code == 404  # unrelated employee
    assert client.get(f"{BASE}/{tid}/attachments/{att['id']}/download", headers=auth(world.b.admin)).status_code == 404
    other = make_ticket(client, world)
    assert client.get(f"{BASE}/{other['id']}/attachments/{att['id']}/download", headers=auth(world.a.admin)).status_code == 404  # wrong ticket
    assert client.delete(f"{BASE}/{tid}/attachments/{att['id']}", headers=auth(world.a.employee)).status_code == 404
    assign(client, world.a.admin, tid, world.a.employee)
    assert client.delete(f"{BASE}/{tid}/attachments/{att['id']}", headers=auth(world.a.employee)).status_code == 403  # visible, but not theirs
    assert client.delete(f"{BASE}/{tid}/attachments/{att['id']}", headers=auth(world.a.client_user)).status_code == 200  # uploader
    db.expire_all()
    assert not path.exists() and db.get(TicketAttachment, att["id"]) is None
    # admin/manager may remove anyone's file
    again = attach(client, world.a.employee, tid).json()["data"]
    assert client.delete(f"{BASE}/{tid}/attachments/{again['id']}", headers=auth(world.a.manager)).status_code == 200


def test_attachment_validation(client, world):
    t = make_ticket(client, world)["id"]
    h = world.a.admin
    assert attach(client, h, t, filename="run.exe", content=b"MZ", mime="application/octet-stream").status_code == 422
    assert attach(client, h, t, mime="image/png").status_code == 422
    assert attach(client, h, t, content=b"not a pdf").status_code == 422
    assert attach(client, h, t, content=b"").status_code == 422
    assert client.post(f"{BASE}/{t}/attachments", headers=auth(h)).status_code == 422
    stored = attach(client, h, t, filename="../../x.pdf")
    assert stored.status_code == 201 and ".." not in stored.json()["data"]["file_name"] and "/" not in stored.json()["data"]["file_name"]


def test_attachments_follow_comment_visibility(client, world, db):
    t = make_ticket(client, world)
    tid = t["id"]
    assign(client, world.a.admin, tid, world.a.employee)
    public = comment(client, world.a.employee, tid, "see attached").json()["data"]
    internal = comment(client, world.a.employee, tid, "private notes", internal=True).json()["data"]
    on_public = attach(client, world.a.employee, tid, comment_id=public["id"]).json()["data"]
    on_internal = attach(client, world.a.employee, tid, comment_id=internal["id"]).json()["data"]
    loose = attach(client, world.a.employee, tid).json()["data"]
    assert on_public["comment_id"] == public["id"]

    def attachment_ids(user):
        return {a["id"] for a in client.get(f"{BASE}/{tid}/attachments", headers=auth(user)).json()["data"]}

    assert attachment_ids(world.a.admin) == {on_public["id"], on_internal["id"], loose["id"]}
    assert attachment_ids(world.a.client_user) == {on_public["id"], loose["id"]}
    assert client.get(f"{BASE}/{tid}/attachments/{on_internal['id']}/download", headers=auth(world.a.client_user)).status_code == 404
    assert client.get(f"{BASE}/{tid}/attachments/{on_internal['id']}/download", headers=auth(world.a.manager)).status_code == 200
    assert client.delete(f"{BASE}/{tid}/attachments/{on_internal['id']}", headers=auth(world.a.client_user)).status_code == 404
    # attached files are listed under their comment, and hidden with it
    admin_comments = {c["id"]: c for c in client.get(f"{BASE}/{tid}/comments", headers=auth(world.a.admin)).json()["data"]}
    assert [a["id"] for a in admin_comments[internal["id"]]["attachments"]] == [on_internal["id"]]
    client_view = client.get(f"{BASE}/{tid}", headers=auth(world.a.client_user))
    assert [a["id"] for c in client_view.json()["data"]["comments"] for a in c["attachments"]] == [on_public["id"]]
    assert {a["id"] for a in client_view.json()["data"]["attachments"]} == {on_public["id"], loose["id"]}
    # a client cannot attach to a comment they cannot see, nor to someone else's comment
    assert attach(client, world.a.client_user, tid, comment_id=internal["id"]).status_code == 404
    assert attach(client, world.a.client_user, tid, comment_id=public["id"]).status_code == 403
    other = make_ticket(client, world)
    assert attach(client, world.a.admin, other["id"], comment_id=public["id"]).status_code == 404  # comment of another ticket
    assert attach(client, world.a.manager, tid, comment_id=public["id"]).status_code == 201  # managers may


# ---- update / delete ---------------------------------------------------------------------

def test_update_rules(client, world, db):
    cid = world.a.client_record.id
    t = create(client, world.a.employee, cid)
    tid = t["id"]
    res = client.put(f"{BASE}/{tid}", json={"subject": "Better subject", "priority": "urgent", "category": "Billing"}, headers=auth(world.a.employee))
    assert res.status_code == 200 and res.json()["data"]["subject"] == "Better subject" and res.json()["data"]["priority"] == "urgent"
    project = make_project(db, world.a, members=[world.a.employee_emp, world.a.manager_emp])  # manager must be able to see the project
    assert client.put(f"{BASE}/{tid}", json={"project_id": project.id}, headers=auth(world.a.manager)).json()["data"]["project_name"] == project.name
    assert client.put(f"{BASE}/{tid}", json={"project_id": None}, headers=auth(world.a.manager)).json()["data"]["project_id"] is None
    assert client.put(f"{BASE}/{tid}", json={"subject": None}, headers=auth(world.a.manager)).status_code == 422
    assert client.put(f"{BASE}/{tid}", json={"ticket_number": "TCK-9999"}, headers=auth(world.a.manager)).status_code == 422
    assert db.scalar(select(ActivityLog.id).where(ActivityLog.action == "updated", ActivityLog.entity_id == tid))
    # creator loses the right once work has started; managers keep it
    set_status(client, world.a.manager, tid, "in_progress")
    assert client.put(f"{BASE}/{tid}", json={"subject": "Late edit"}, headers=auth(world.a.employee)).status_code == 403
    assert client.put(f"{BASE}/{tid}", json={"subject": "Manager edit"}, headers=auth(world.a.manager)).status_code == 200
    # others who can see it cannot edit
    other = make_ticket(client, world)
    assign(client, world.a.admin, other["id"], world.a.employee)
    assert client.put(f"{BASE}/{other['id']}", json={"subject": "Nope"}, headers=auth(world.a.employee)).status_code == 403
    # a client edits their own open ticket
    mine = create(client, world.a.client_user)
    assert client.put(f"{BASE}/{mine['id']}", json={"description": "More detail"}, headers=auth(world.a.client_user)).status_code == 200
    assert client.put(f"{BASE}/{other['id']}", json={"description": "x"}, headers=auth(world.a.client_user)).status_code == 403


def test_delete_ticket_removes_attachment_files(client, world, db):
    t = make_ticket(client, world)
    att = attach(client, world.a.admin, t["id"]).json()["data"]
    path = get_settings().upload_path / db.get(TicketAttachment, att["id"]).file_path
    comment(client, world.a.admin, t["id"])
    assign(client, world.a.admin, t["id"], world.a.employee)
    assert client.delete(f"{BASE}/{t['id']}", headers=auth(world.a.employee)).status_code == 403
    assert client.delete(f"{BASE}/{t['id']}", headers=auth(world.a.client_user)).status_code == 403
    assert client.delete(f"{BASE}/{t['id']}", headers=auth(world.a.manager)).status_code == 200
    assert not path.exists()
    db.expire_all()
    assert db.get(Ticket, t["id"]) is None
    assert db.scalar(select(TicketComment.id).where(TicketComment.ticket_id == t["id"])) is None
    assert db.scalar(select(TicketAttachment.id).where(TicketAttachment.ticket_id == t["id"])) is None
    assert client.get(f"{BASE}/{t['id']}", headers=auth(world.a.admin)).status_code == 404
    assert db.scalar(select(ActivityLog.id).where(ActivityLog.action == "deleted", ActivityLog.entity_id == t["id"]))


# ---- list filters -------------------------------------------------------------------------

def test_filters_search_sort_pagination(client, world, db, factory):
    cid = world.a.client_record.id
    other_client = factory.make_client(world.a.company, "Rival")
    project = make_project(db, world.a)
    make_ticket(client, world, subject="Printer jams", priority="low", category="Hardware")
    t2 = make_ticket(client, world, subject="Invoice wrong", priority="urgent", category="Billing", project_id=project.id)
    t3 = create(client, world.a.admin, other_client.id, subject="Login broken", priority="high", category="Technical")
    assign(client, world.a.admin, t2["id"], world.a.employee)
    set_status(client, world.a.admin, t3["id"], "in_progress")
    create(client, world.a.employee, cid, subject="Employee raised")
    h = auth(world.a.admin)

    def subjects(user=None, **params):
        res = client.get(BASE, params=params, headers=auth(user) if user else h)
        assert res.status_code == 200, res.text
        return sorted(t["subject"] for t in res.json()["data"])

    assert subjects(status="in_progress") == ["Login broken"]
    assert subjects(priority="urgent") == ["Invoice wrong"]
    assert subjects(client_id=other_client.id) == ["Login broken"]
    assert subjects(project_id=project.id) == ["Invoice wrong"]
    assert subjects(assigned_to=world.a.employee.id) == ["Invoice wrong"]
    assert subjects(category="Hardware") == ["Printer jams"]
    assert subjects(search="jams") == ["Printer jams"] and subjects(search=t2["ticket_number"]) == ["Invoice wrong"]
    assert subjects(search="%") == []
    assert subjects(world.a.employee, mine="true") == ["Employee raised", "Invoice wrong"]
    assert subjects(mine="true") == ["Invoice wrong", "Login broken", "Printer jams"]  # the admin raised these three
    assert client.get(BASE, params={"sort_by": "priority", "sort_order": "asc"}, headers=h).status_code == 200
    asc = [t["ticket_number"] for t in client.get(BASE, params={"sort_by": "ticket_number", "sort_order": "asc"}, headers=h).json()["data"]]
    assert asc == sorted(asc)
    page = client.get(BASE, params={"limit": 2, "page": 2}, headers=h).json()
    assert page["total"] == 4 and page["total_pages"] == 2 and len(page["data"]) == 2
    assert client.get(BASE, params={"sort_by": "description"}, headers=h).status_code == 422
    assert client.get(BASE, params={"status": "bogus"}, headers=h).status_code == 422
    assert client.get(BASE, params={"limit": 500}, headers=h).status_code == 422


def test_client_tickets_route(client, world, factory):
    own = make_ticket(client, world, subject="Mine")
    other_client = factory.make_client(world.a.company, "Rival")
    create(client, world.a.admin, other_client.id, subject="Theirs")
    url = f"/api/v1/clients/{world.a.client_record.id}/tickets"
    for user in (world.a.admin, world.a.manager, world.a.client_user):
        res = client.get(url, headers=auth(user))
        assert res.status_code == 200 and [t["id"] for t in res.json()["data"]] == [own["id"]], user.email
    assert client.get(url, headers=auth(world.a.employee)).json()["total"] == 0  # not assigned/created by them
    assert client.get(f"/api/v1/clients/{other_client.id}/tickets", headers=auth(world.a.client_user)).status_code == 404
    assert client.get(f"/api/v1/clients/{other_client.id}/tickets", headers=auth(world.a.admin)).json()["total"] == 1
    assert client.get("/api/v1/clients/999999/tickets", headers=auth(world.a.admin)).status_code == 404
    assert client.get(url).status_code == 401


def test_status_enum_values_in_output(client, world):
    t = make_ticket(client, world)
    assert {s.value for s in TicketStatus} == {"open", "in_progress", "waiting_for_client", "resolved", "closed"}
    assert client.get(f"{BASE}/{t['id']}", headers=auth(world.a.admin)).json()["data"]["priority"] == "high"
