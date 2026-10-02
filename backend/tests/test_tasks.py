from datetime import date, timedelta

import pytest

from app.core.enums import RoleName
from app.models import ActivityLog, Notification, Task, TaskAttachment
from app.utils.files import resolve_stored_path
from tests.conftest import auth

TASKS = "/api/v1/tasks"
PROJECTS = "/api/v1/projects"
PDF = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"


@pytest.fixture
def project(client, world):
    """Project of company A: manager_emp manages it, employee_emp is a member."""
    body = {"name": "Website", "manager_id": world.a.manager_emp.id, "member_ids": [world.a.employee_emp.id], "client_id": world.a.client_record.id}
    return client.post(PROJECTS, json=body, headers=auth(world.a.admin)).json()["data"]


def new_task(client, headers, project_id, **over):
    res = client.post(TASKS, json={"project_id": project_id, "title": "Build login", **over}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()["data"]


def status_of(client, headers, task_id, status):
    return client.patch(f"{TASKS}/{task_id}/status", json={"status": status}, headers=headers)


def fresh(db):
    db.rollback()  # end the session's old snapshot so it sees what the API committed
    return db


def upload(client, headers, task_id, name="spec.pdf", content=PDF, mime="application/pdf"):
    return client.post(f"{TASKS}/{task_id}/attachments", files={"file": (name, content, mime)}, headers=headers)


# ---- create & validation --------------------------------------------------

def test_create_task_and_output_fields(client, world, project):
    h = auth(world.a.manager)
    ms = client.post(f"{PROJECTS}/{project['id']}/milestones", json={"name": "Alpha"}, headers=h).json()["data"]
    res = client.post(
        TASKS,
        json={
            "project_id": project["id"], "milestone_id": ms["id"], "assigned_to": world.a.employee_emp.id, "title": "Design hero",
            "priority": "high", "start_date": str(date.today()), "due_date": str(date.today() + timedelta(days=3)),
            "checklist": [{"text": "Draft"}, {"text": "Review", "done": True}],
        },
        headers=h,
    )
    assert res.status_code == 201, res.text
    task = res.json()["data"]
    assert task["status"] == "todo" and task["priority"] == "high" and task["created_by"] == world.a.manager.id
    assert task["project_name"] == "Website" and task["milestone_name"] == "Alpha"
    assert task["assignee_name"] == world.a.employee.name and task["assignee_user_id"] == world.a.employee.id
    assert task["comment_count"] == 0 and task["attachment_count"] == 0 and task["is_overdue"] is False
    assert [(c["text"], c["done"]) for c in task["checklist"]] == [("Draft", False), ("Review", True)]
    assert len({c["id"] for c in task["checklist"]}) == 2 and all(c["id"] for c in task["checklist"])
    got = client.get(f"{TASKS}/{task['id']}", headers=h).json()["data"]
    assert got["title"] == "Design hero"


def test_create_validation(client, world, project):
    h = auth(world.a.manager)
    today = date.today()

    def post(**over):
        return client.post(TASKS, json={"project_id": project["id"], "title": "T", **over}, headers=h).status_code

    assert post(start_date=str(today), due_date=str(today - timedelta(days=1))) == 422
    assert post(priority="critical") == 422
    assert post(status="done") == 422
    assert post(title="") == 422
    assert post(checklist=[{"text": ""}]) == 422
    assert post(company_id=1) == 422
    assert client.post(TASKS, json={"title": "no project"}, headers=h).status_code == 422
    assert post() == 201
    # milestone of another project
    other = client.post(PROJECTS, json={"name": "Other", "manager_id": world.a.manager_emp.id}, headers=h).json()["data"]
    foreign_ms = client.post(f"{PROJECTS}/{other['id']}/milestones", json={"name": "M"}, headers=h).json()["data"]
    assert post(milestone_id=foreign_ms["id"]) == 422
    assert post(milestone_id=999999) == 422


def test_project_must_be_visible_to_creator(client, world, project, factory):
    # a manager who neither manages nor belongs to the project cannot create tasks in it
    stranger = factory.make_user(world.a.company, RoleName.MANAGER, name="Stranger")
    factory.make_employee(stranger)
    assert client.post(TASKS, json={"project_id": project["id"], "title": "T"}, headers=auth(stranger)).status_code == 404
    assert client.post(TASKS, json={"project_id": project["id"], "title": "T"}, headers=auth(world.b.admin)).status_code == 404
    assert client.post(TASKS, json={"project_id": 999999, "title": "T"}, headers=auth(world.a.admin)).status_code == 404


def test_create_permissions(client, world, project):
    body = {"project_id": project["id"], "title": "T"}
    assert client.post(TASKS, json=body, headers=auth(world.a.employee)).status_code == 403
    assert client.post(TASKS, json=body, headers=auth(world.a.client_user)).status_code == 403
    assert client.post(TASKS, json=body).status_code == 401
    assert client.post(TASKS, json=body, headers=auth(world.a.admin)).status_code == 201


# ---- assignment -----------------------------------------------------------

def test_assignee_must_be_project_member(client, world, project, factory):
    h = auth(world.a.manager)
    outsider = factory.make_employee(factory.make_user(world.a.company, RoleName.EMPLOYEE, name="Outsider"))
    b_employee = world.b.employee_emp
    assert client.post(TASKS, json={"project_id": project["id"], "title": "T", "assigned_to": outsider.id}, headers=h).status_code == 422
    assert client.post(TASKS, json={"project_id": project["id"], "title": "T", "assigned_to": b_employee.id}, headers=h).status_code == 404
    task = new_task(client, h, project["id"])

    assert client.patch(f"{TASKS}/{task['id']}/assign", json={"assigned_to": outsider.id}, headers=h).status_code == 422
    assert client.patch(f"{TASKS}/{task['id']}/assign", json={"assigned_to": b_employee.id}, headers=h).status_code == 404
    assert client.patch(f"{TASKS}/{task['id']}/assign", json={}, headers=h).status_code == 422
    assert client.put(f"{TASKS}/{task['id']}", json={"assigned_to": outsider.id}, headers=h).status_code == 422

    ok = client.patch(f"{TASKS}/{task['id']}/assign", json={"assigned_to": world.a.employee_emp.id}, headers=h)
    assert ok.status_code == 200 and ok.json()["data"]["assignee_name"] == world.a.employee.name
    cleared = client.patch(f"{TASKS}/{task['id']}/assign", json={"assigned_to": None}, headers=h)
    assert cleared.json()["data"]["assigned_to"] is None and cleared.json()["data"]["assignee_name"] is None


def test_assignment_notifies_assignee_and_is_audited(client, world, project, db):
    h = auth(world.a.manager)
    task = new_task(client, h, project["id"])
    client.patch(f"{TASKS}/{task['id']}/assign", json={"assigned_to": world.a.employee_emp.id}, headers=h)
    fresh(db)
    notes = db.query(Notification).filter_by(user_id=world.a.employee.id, reference_type="task", reference_id=task["id"]).all()
    assert len(notes) == 1 and notes[0].type.value == "task" and "Build login" in notes[0].message
    assert db.query(ActivityLog).filter_by(entity_type="task", entity_id=task["id"], action="assigned", user_id=world.a.manager.id).count() == 1
    assert db.query(ActivityLog).filter_by(entity_type="task", entity_id=task["id"], action="created").count() == 1

    # assigning to yourself does not notify you; re-assigning the same person is a no-op
    client.patch(f"{TASKS}/{task['id']}/assign", json={"assigned_to": world.a.employee_emp.id}, headers=h)
    self_task = new_task(client, h, project["id"], assigned_to=world.a.manager_emp.id)
    fresh(db)
    assert db.query(Notification).filter_by(user_id=world.a.manager.id, reference_id=self_task["id"]).count() == 0
    assert db.query(Notification).filter_by(user_id=world.a.employee.id, reference_id=task["id"]).count() == 1


# ---- employee powers vs manager ------------------------------------------

def test_employee_limited_powers(client, world, project, db):
    m = auth(world.a.manager)
    e = auth(world.a.employee)
    mine = new_task(client, m, project["id"], assigned_to=world.a.employee_emp.id, checklist=[{"text": "One"}, {"text": "Two"}])
    theirs = new_task(client, m, project["id"], title="Manager's own", assigned_to=world.a.manager_emp.id)

    # visibility: only their own task
    listing = client.get(TASKS, headers=e).json()
    assert [t["id"] for t in listing["data"]] == [mine["id"]]
    assert client.get(f"{TASKS}/{theirs['id']}", headers=e).status_code == 404
    assert client.get(f"{TASKS}/{mine['id']}", headers=e).status_code == 200

    # allowed: status + checklist
    assert status_of(client, e, mine["id"], "in_progress").json()["data"]["status"] == "in_progress"
    items = client.get(f"{TASKS}/{mine['id']}", headers=e).json()["data"]["checklist"]
    items[0]["done"] = True
    patched = client.patch(f"{TASKS}/{mine['id']}/checklist", json={"checklist": items}, headers=e)
    assert patched.status_code == 200
    assert [(c["id"], c["done"]) for c in patched.json()["data"]["checklist"]] == [(items[0]["id"], True), (items[1]["id"], False)]

    # forbidden: PUT, assign, delete
    assert client.put(f"{TASKS}/{mine['id']}", json={"title": "Hacked"}, headers=e).status_code == 403
    assert client.patch(f"{TASKS}/{mine['id']}/assign", json={"assigned_to": world.a.employee_emp.id}, headers=e).status_code == 403
    assert client.patch(f"{TASKS}/{mine['id']}/assign", json={"assigned_to": None}, headers=e).status_code == 403
    assert client.delete(f"{TASKS}/{mine['id']}", headers=e).status_code == 403
    assert client.get(f"{TASKS}/{mine['id']}", headers=e).json()["data"]["title"] == "Build login"

    # someone else's task: not even visible (404), status and checklist untouched
    assert status_of(client, e, theirs["id"], "completed").status_code == 404
    assert client.patch(f"{TASKS}/{theirs['id']}/checklist", json={"checklist": []}, headers=e).status_code == 404

    # visible only because they created it -> still not theirs to update
    db.add(Task(company_id=world.a.company.id, project_id=project["id"], title="Created by employee", assigned_to=world.a.manager_emp.id, created_by=world.a.employee.id))
    db.commit()
    created = db.query(Task).filter_by(title="Created by employee").one()
    assert client.get(f"{TASKS}/{created.id}", headers=e).status_code == 200
    assert status_of(client, e, created.id, "completed").status_code == 403
    assert client.patch(f"{TASKS}/{created.id}/checklist", json={"checklist": []}, headers=e).status_code == 403

    # manager can do everything
    assert client.put(f"{TASKS}/{mine['id']}", json={"title": "Renamed", "priority": "urgent"}, headers=m).json()["data"]["title"] == "Renamed"
    assert client.delete(f"{TASKS}/{mine['id']}", headers=m).status_code == 200


def test_client_has_no_task_access(client, world, project):
    task = new_task(client, auth(world.a.admin), project["id"])
    c = auth(world.a.client_user)
    assert client.get(TASKS, headers=c).status_code == 403
    assert client.get(f"{TASKS}/{task['id']}", headers=c).status_code == 403
    assert status_of(client, c, task["id"], "completed").status_code == 403
    assert client.get(f"{TASKS}/{task['id']}/comments", headers=c).status_code == 403
    assert client.post(f"{TASKS}/{task['id']}/comments", json={"comment": "hi"}, headers=c).status_code == 403
    assert client.get(f"{PROJECTS}/{project['id']}/tasks", headers=c).status_code == 403
    assert upload(client, c, task["id"]).status_code == 403


def test_manager_scope(client, world, project, factory):
    admin = auth(world.a.admin)
    task = new_task(client, admin, project["id"])
    other_project = client.post(PROJECTS, json={"name": "Not manager's"}, headers=admin).json()["data"]
    hidden = new_task(client, admin, other_project["id"], title="Hidden")
    m = auth(world.a.manager)
    assert [t["id"] for t in client.get(TASKS, headers=m).json()["data"]] == [task["id"]]
    assert client.get(f"{TASKS}/{hidden['id']}", headers=m).status_code == 404
    assert client.put(f"{TASKS}/{hidden['id']}", json={"title": "x"}, headers=m).status_code == 404
    assert client.delete(f"{TASKS}/{hidden['id']}", headers=m).status_code == 404
    assert client.get(f"{PROJECTS}/{other_project['id']}/tasks", headers=m).status_code == 404
    assert client.get(TASKS, headers=admin).json()["total"] == 2


# ---- update / status flow -------------------------------------------------

def test_full_update(client, world, project):
    h = auth(world.a.manager)
    task = new_task(client, h, project["id"], due_date=str(date.today() + timedelta(days=5)), start_date=str(date.today()))
    res = client.put(
        f"{TASKS}/{task['id']}",
        json={"title": "New title", "description": "Details", "priority": "low", "assigned_to": world.a.employee_emp.id, "checklist": [{"text": "a"}]},
        headers=h,
    )
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["title"] == "New title" and data["priority"] == "low" and data["assigned_to"] == world.a.employee_emp.id and len(data["checklist"]) == 1
    assert client.put(f"{TASKS}/{task['id']}", json={"due_date": str(date.today() - timedelta(days=2))}, headers=h).status_code == 422
    assert client.put(f"{TASKS}/{task['id']}", json={"title": None}, headers=h).status_code == 422
    assert client.put(f"{TASKS}/{task['id']}", json={"project_id": 5}, headers=h).status_code == 422
    assert client.put(f"{TASKS}/{task['id']}", json={"due_date": None}, headers=h).json()["data"]["due_date"] is None


def test_status_flow_completed_at_progress_notifications_and_audit(client, world, project, db):
    m = auth(world.a.manager)
    e = auth(world.a.employee)
    pid = project["id"]
    ms = client.post(f"{PROJECTS}/{pid}/milestones", json={"name": "M"}, headers=m).json()["data"]
    task = new_task(client, m, pid, assigned_to=world.a.employee_emp.id, milestone_id=ms["id"])
    other = new_task(client, m, pid, title="Other", milestone_id=ms["id"])
    assert task["completed_at"] is None

    assert status_of(client, e, task["id"], "in_progress").status_code == 200
    done = status_of(client, e, task["id"], "completed").json()["data"]
    assert done["status"] == "completed" and done["completed_at"] is not None
    assert client.get(f"{PROJECTS}/{pid}", headers=m).json()["data"]["progress"] == 50
    assert client.get(f"/api/v1/milestones/{ms['id']}", headers=m).json()["data"]["progress"] == 50

    # a repeated status is a no-op (completed_at unchanged)
    again = status_of(client, e, task["id"], "completed").json()["data"]
    assert again["completed_at"] == done["completed_at"]

    reopened = status_of(client, e, task["id"], "review").json()["data"]
    assert reopened["completed_at"] is None
    assert client.get(f"{PROJECTS}/{pid}", headers=m).json()["data"]["progress"] == 0
    assert status_of(client, m, other["id"], "completed").status_code == 200
    assert client.get(f"{PROJECTS}/{pid}", headers=m).json()["data"]["progress"] == 50
    assert status_of(client, e, task["id"], "finished").status_code == 422

    fresh(db)
    # the manager created the task -> notified of the employee's changes; the actor never notifies themselves
    to_manager = db.query(Notification).filter_by(user_id=world.a.manager.id, reference_type="task", reference_id=task["id"]).all()
    assert len(to_manager) == 3 and all(n.type.value == "task" for n in to_manager)
    assert db.query(Notification).filter_by(user_id=world.a.employee.id, reference_id=task["id"]).count() == 1  # only the initial assignment
    logs = db.query(ActivityLog).filter_by(entity_type="task", entity_id=task["id"], action="status_changed").order_by(ActivityLog.id).all()
    assert [log.user_id for log in logs] == [world.a.employee.id] * 3
    assert "todo -> in_progress" in logs[0].description


def test_status_change_by_manager_notifies_assignee(client, world, project, db):
    admin = auth(world.a.admin)
    task = new_task(client, admin, project["id"], assigned_to=world.a.employee_emp.id)
    status_of(client, admin, task["id"], "review")
    fresh(db)
    users = {n.user_id for n in db.query(Notification).filter_by(reference_type="task", reference_id=task["id"]).all()}
    assert users == {world.a.employee.id, world.a.manager.id}  # assignee (assignment + status) and project manager; not the admin actor


def test_create_completed_task_sets_completed_at(client, world, project):
    task = new_task(client, auth(world.a.manager), project["id"], status="completed")
    assert task["completed_at"] is not None
    assert client.get(f"{PROJECTS}/{project['id']}", headers=auth(world.a.manager)).json()["data"]["progress"] == 100


def test_delete_task_recomputes_progress_and_removes_files(client, world, project, db):
    m = auth(world.a.manager)
    a = new_task(client, m, project["id"])
    b = new_task(client, m, project["id"])
    status_of(client, m, a["id"], "completed")
    att = upload(client, m, b["id"]).json()["data"]
    fresh(db)
    path = resolve_stored_path(db.get(TaskAttachment, att["id"]).file_path)
    assert path.is_file()

    assert client.delete(f"{TASKS}/{b['id']}", headers=m).status_code == 200
    assert client.get(f"{TASKS}/{b['id']}", headers=m).status_code == 404
    assert client.get(f"{PROJECTS}/{project['id']}", headers=m).json()["data"]["progress"] == 100
    assert not path.exists()
    fresh(db)
    assert db.query(TaskAttachment).filter_by(task_id=b["id"]).count() == 0
    assert db.query(ActivityLog).filter_by(entity_type="task", entity_id=b["id"], action="deleted").count() == 1


# ---- comments -------------------------------------------------------------

def test_comments(client, world, project, db):
    m, e = auth(world.a.manager), auth(world.a.employee)
    task = new_task(client, m, project["id"], assigned_to=world.a.employee_emp.id)
    url = f"{TASKS}/{task['id']}/comments"

    res = client.post(url, json={"comment": "Started on this"}, headers=e)
    assert res.status_code == 201 and res.json()["data"]["user_name"] == world.a.employee.name
    client.post(url, json={"comment": "Thanks!"}, headers=m)
    assert client.post(url, json={"comment": "  "}, headers=e).status_code == 422
    assert client.post(url, json={}, headers=e).status_code == 422

    comments = client.get(url, headers=m).json()["data"]
    assert [(c["user_name"], c["comment"]) for c in comments] == [(world.a.employee.name, "Started on this"), (world.a.manager.name, "Thanks!")]
    assert client.get(f"{TASKS}/{task['id']}", headers=m).json()["data"]["comment_count"] == 2

    fresh(db)
    # creator notified of the employee's comment, assignee of the manager's; nobody of their own
    assert db.query(Notification).filter_by(user_id=world.a.manager.id, reference_id=task["id"], title="New comment on a task").count() == 1
    assert db.query(Notification).filter_by(user_id=world.a.employee.id, reference_id=task["id"], title="New comment on a task").count() == 1

    # not visible: other company, employee not on the task
    other = new_task(client, m, project["id"], title="Not for employee")
    assert client.get(f"{TASKS}/{other['id']}/comments", headers=e).status_code == 404
    assert client.post(f"{TASKS}/{other['id']}/comments", json={"comment": "x"}, headers=e).status_code == 404
    assert client.get(url, headers=auth(world.b.admin)).status_code == 404
    assert client.post(url, json={"comment": "x"}, headers=auth(world.b.admin)).status_code == 404


# ---- attachments ----------------------------------------------------------

def test_attachment_upload_list_download_delete(client, world, project, db):
    m, e = auth(world.a.manager), auth(world.a.employee)
    task = new_task(client, m, project["id"], assigned_to=world.a.employee_emp.id)
    base = f"{TASKS}/{task['id']}/attachments"

    res = upload(client, e, task["id"], name="../../spec sheet.pdf")
    assert res.status_code == 201, res.text
    att = res.json()["data"]
    assert att["file_name"] == "spec sheet.pdf" and att["file_size"] == len(PDF) and att["uploaded_by_name"] == world.a.employee.name
    assert "file_path" not in att
    assert client.get(f"{TASKS}/{task['id']}", headers=m).json()["data"]["attachment_count"] == 1
    assert [a["id"] for a in client.get(base, headers=m).json()["data"]] == [att["id"]]

    fresh(db)
    stored = db.get(TaskAttachment, att["id"])
    assert stored.file_path.startswith(f"{world.a.company.id}/tasks/") and stored.file_path.endswith(".pdf") and "spec" not in stored.file_path
    path = resolve_stored_path(stored.file_path)

    dl = client.get(f"{base}/{att['id']}/download", headers=m)
    assert dl.status_code == 200 and dl.content == PDF and dl.headers["content-type"] == "application/pdf"
    assert "attachment" in dl.headers["content-disposition"] and dl.headers["x-content-type-options"] == "nosniff"
    assert client.get(f"{base}/{att['id']}/download", headers=e).status_code == 200
    assert client.get(f"{base}/999999/download", headers=m).status_code == 404

    # a manager may delete anyone's file; here the uploader deletes their own
    assert client.delete(f"{base}/{att['id']}", headers=e).status_code == 200
    assert not path.exists()
    assert client.get(f"{base}/{att['id']}/download", headers=m).status_code == 404
    fresh(db)
    assert db.query(ActivityLog).filter_by(entity_type="task", entity_id=task["id"], action="uploaded").count() == 1


def test_attachment_validation(client, world, project):
    m = auth(world.a.manager)
    task = new_task(client, m, project["id"])
    tid = task["id"]
    assert upload(client, m, tid, name="malware.exe", content=b"MZ....", mime="application/octet-stream").status_code == 422  # extension
    assert upload(client, m, tid, name="noext", content=PDF).status_code == 422
    assert upload(client, m, tid, name="spec.pdf", content=PDF, mime="text/plain").status_code == 422  # MIME mismatch
    assert upload(client, m, tid, name="fake.pdf", content=b"<html>not a pdf</html>").status_code == 422  # content signature
    assert upload(client, m, tid, name="empty.pdf", content=b"").status_code == 422
    assert upload(client, m, tid, name="big.pdf", content=PDF + b"0" * (10 * 1024 * 1024)).status_code == 422  # > 10 MB
    assert client.post(f"{TASKS}/{tid}/attachments", headers=m).status_code == 422  # no file
    assert client.get(f"{TASKS}/{tid}", headers=m).json()["data"]["attachment_count"] == 0
    assert upload(client, m, tid, name="notes.txt", content=b"hello", mime="text/plain").status_code == 201


def test_attachment_authorization(client, world, project, factory):
    m, e = auth(world.a.manager), auth(world.a.employee)
    other_emp_user = factory.make_user(world.a.company, RoleName.EMPLOYEE, name="Other Employee")
    other_emp = factory.make_employee(other_emp_user)
    client.post(f"{PROJECTS}/{project['id']}/members", json={"employee_id": other_emp.id}, headers=auth(world.a.admin))

    task = new_task(client, m, project["id"], assigned_to=world.a.employee_emp.id)
    att = upload(client, m, task["id"]).json()["data"]
    url = f"{TASKS}/{task['id']}/attachments/{att['id']}"

    # a member of the project who is not on the task cannot see, download or attach
    stranger = auth(other_emp_user)
    assert client.get(f"{url}/download", headers=stranger).status_code == 404
    assert client.get(f"{TASKS}/{task['id']}/attachments", headers=stranger).status_code == 404
    assert upload(client, stranger, task["id"]).status_code == 404
    assert client.delete(url, headers=stranger).status_code == 404
    # other company / client / anonymous
    assert client.get(f"{url}/download", headers=auth(world.b.admin)).status_code == 404
    assert client.get(f"{url}/download", headers=auth(world.a.client_user)).status_code == 403
    assert client.get(f"{url}/download").status_code == 401
    # the assignee sees the manager's file but may not delete it
    assert client.get(f"{url}/download", headers=e).status_code == 200
    assert client.delete(url, headers=e).status_code == 403
    # attachment ids do not cross tasks
    second = new_task(client, m, project["id"], title="Second")
    assert client.get(f"{TASKS}/{second['id']}/attachments/{att['id']}/download", headers=m).status_code == 404
    assert client.delete(url, headers=m).status_code == 200


# ---- filters, search, sorting --------------------------------------------

def test_filters_search_sort_and_pagination(client, world, project):
    admin = auth(world.a.admin)
    today = date.today()
    pid = project["id"]
    ms = client.post(f"{PROJECTS}/{pid}/milestones", json={"name": "M"}, headers=admin).json()["data"]
    overdue = new_task(client, admin, pid, title="Fix login bug", priority="urgent", due_date=str(today - timedelta(days=2)), assigned_to=world.a.employee_emp.id)
    done_late = new_task(client, admin, pid, title="Old finished", due_date=str(today - timedelta(days=9)), status="completed")
    soon = new_task(client, admin, pid, title="Write docs", priority="low", due_date=str(today + timedelta(days=2)), milestone_id=ms["id"])
    nodate = new_task(client, admin, pid, title="Backlog item", assigned_to=world.a.manager_emp.id)
    other_project = client.post(PROJECTS, json={"name": "Second"}, headers=admin).json()["data"]
    elsewhere = new_task(client, admin, other_project["id"], title="Elsewhere login")

    def ids(**params):
        return {t["id"] for t in client.get(TASKS, params=params, headers=admin).json()["data"]}

    assert ids() == {overdue["id"], done_late["id"], soon["id"], nodate["id"], elsewhere["id"]}
    assert ids(project_id=pid) == {overdue["id"], done_late["id"], soon["id"], nodate["id"]}
    assert ids(milestone_id=ms["id"]) == {soon["id"]}
    assert ids(assigned_to=world.a.employee_emp.id) == {overdue["id"]}
    assert ids(status="completed") == {done_late["id"]}
    assert ids(priority="urgent") == {overdue["id"]}
    assert ids(search="login") == {overdue["id"], elsewhere["id"]}
    assert ids(search="%") == set()
    assert ids(due_date_from=str(today - timedelta(days=3)), due_date_to=str(today + timedelta(days=3))) == {overdue["id"], soon["id"]}
    assert ids(overdue="true") == {overdue["id"]}  # completed tasks are never overdue
    assert ids(project_id=pid, status="todo", priority="medium") == {nodate["id"]}
    assert client.get(TASKS, params={"status": "done"}, headers=admin).status_code == 422
    assert client.get(TASKS, params={"due_date_from": "yesterday"}, headers=admin).status_code == 422

    flags = {t["id"]: t["is_overdue"] for t in client.get(TASKS, headers=admin).json()["data"]}
    assert flags[overdue["id"]] is True and flags[done_late["id"]] is False and flags[soon["id"]] is False

    # mine = assigned to the caller (manager_emp / employee_emp); admin has no employee record -> nothing
    assert ids(mine="true") == set()
    assert {t["id"] for t in client.get(TASKS, params={"mine": "true"}, headers=auth(world.a.manager)).json()["data"]} == {nodate["id"]}
    assert {t["id"] for t in client.get(TASKS, params={"mine": "true"}, headers=auth(world.a.employee)).json()["data"]} == {overdue["id"]}

    page = client.get(TASKS, params={"limit": 2, "page": 2, "sort_by": "title", "sort_order": "asc"}, headers=admin).json()
    assert page["total"] == 5 and page["total_pages"] == 3
    assert [t["title"] for t in page["data"]] == ["Fix login bug", "Old finished"]
    assert client.get(TASKS, params={"sort_by": "description; drop"}, headers=admin).status_code == 422
    assert client.get(TASKS, params={"sort_by": "due_date", "sort_order": "asc"}, headers=admin).status_code == 200

    project_tasks = client.get(f"{PROJECTS}/{pid}/tasks", params={"status": "todo"}, headers=admin).json()
    assert {t["id"] for t in project_tasks["data"]} == {overdue["id"], soon["id"], nodate["id"]}
    assert client.get(f"{PROJECTS}/{other_project['id']}/tasks", headers=auth(world.a.manager)).status_code == 404


# ---- checklist ------------------------------------------------------------

def test_checklist_ids(client, world, project):
    m = auth(world.a.manager)
    task = new_task(client, m, project["id"], checklist=[{"id": "keep-1", "text": "kept"}, {"id": "keep-1", "text": "duplicate id"}, {"text": "fresh"}])
    ids = [c["id"] for c in task["checklist"]]
    assert len(set(ids)) == 3  # a duplicated id is re-assigned, so every id ends up unique
    updated = client.patch(f"{TASKS}/{task['id']}/checklist", json={"checklist": [{"id": ids[2], "text": "fresh", "done": True}, {"text": "new"}]}, headers=m).json()["data"]
    assert updated["checklist"][0] == {"id": ids[2], "text": "fresh", "done": True}
    assert updated["checklist"][1]["id"] not in {ids[2]}
    assert client.patch(f"{TASKS}/{task['id']}/checklist", json={"checklist": "nope"}, headers=m).status_code == 422
    assert client.patch(f"{TASKS}/{task['id']}/checklist", json={"checklist": []}, headers=m).json()["data"]["checklist"] == []


# ---- isolation ------------------------------------------------------------

def test_company_isolation(client, world, project):
    task = new_task(client, auth(world.a.admin), project["id"])
    b = auth(world.b.admin)
    url = f"{TASKS}/{task['id']}"
    assert client.get(url, headers=b).status_code == 404
    assert client.put(url, json={"title": "x"}, headers=b).status_code == 404
    assert client.delete(url, headers=b).status_code == 404
    assert status_of(client, b, task["id"], "completed").status_code == 404
    assert client.patch(f"{url}/assign", json={"assigned_to": None}, headers=b).status_code == 404
    assert client.patch(f"{url}/checklist", json={"checklist": []}, headers=b).status_code == 404
    assert client.get(TASKS, headers=b).json()["total"] == 0
    assert client.get(f"{PROJECTS}/{project['id']}/tasks", headers=b).status_code == 404
    # B cannot create tasks in A's project, nor put A's milestone on its own task
    assert client.post(TASKS, json={"project_id": project["id"], "title": "x"}, headers=b).status_code == 404
    b_project = client.post(PROJECTS, json={"name": "B"}, headers=b).json()["data"]
    a_ms = client.post(f"{PROJECTS}/{project['id']}/milestones", json={"name": "M"}, headers=auth(world.a.admin)).json()["data"]
    assert client.post(TASKS, json={"project_id": b_project["id"], "title": "x", "milestone_id": a_ms["id"]}, headers=b).status_code == 422
    assert client.get(url).status_code == 401
