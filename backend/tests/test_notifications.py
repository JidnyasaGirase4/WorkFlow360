from datetime import timedelta

from app.core.enums import NotificationType
from app.database.base import utcnow
from app.models import Notification
from tests.conftest import auth

BASE = "/api/v1/notifications"


def add(db, user, title="Hello", type_=NotificationType.SYSTEM, is_read=False, minutes_ago=0) -> Notification:
    note = Notification(
        user_id=user.id, title=title, message=f"{title} message", type=type_, is_read=is_read,
        reference_type="task", reference_id=7, created_at=utcnow() - timedelta(minutes=minutes_ago),
    )
    db.add(note)
    db.commit()
    return note


def test_list_is_own_only_newest_first_and_paginated(client, world, db):
    me, other = world.a.employee, world.a.manager
    oldest = add(db, me, "oldest", minutes_ago=30)
    newest = add(db, me, "newest", minutes_ago=1)
    middle = add(db, me, "middle", minutes_ago=10)
    add(db, other, "not mine")
    add(db, world.b.employee, "other company")

    res = client.get(BASE, headers=auth(me))
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True and body["total"] == 3
    assert [n["id"] for n in body["data"]] == [newest.id, middle.id, oldest.id]
    first = body["data"][0]
    assert first["user_id"] == me.id and first["type"] == "system" and first["is_read"] is False
    assert first["reference_type"] == "task" and first["reference_id"] == 7 and first["created_at"]

    page = client.get(BASE, params={"limit": 2, "page": 2}, headers=auth(me)).json()
    assert page["total_pages"] == 2 and [n["id"] for n in page["data"]] == [oldest.id]
    assert client.get(BASE, params={"limit": 1000}, headers=auth(me)).status_code == 422
    assert client.get(BASE, params={"sort_by": "message"}, headers=auth(me)).status_code == 422
    assert client.get(BASE).status_code == 401


def test_filters_by_read_state_and_type(client, world, db):
    me = world.a.admin
    unread_task = add(db, me, "t1", NotificationType.TASK)
    read_task = add(db, me, "t2", NotificationType.TASK, is_read=True)
    unread_meeting = add(db, me, "m1", NotificationType.MEETING)
    h = auth(me)

    def ids(**params):
        return {n["id"] for n in client.get(BASE, params=params, headers=h).json()["data"]}

    assert ids(is_read="false") == {unread_task.id, unread_meeting.id}
    assert ids(is_read="true") == {read_task.id}
    assert ids(type="task") == {unread_task.id, read_task.id}
    assert ids(type="meeting", is_read="false") == {unread_meeting.id}
    assert ids(type="invoice") == set()
    assert client.get(BASE, params={"type": "bogus"}, headers=h).status_code == 422


def test_unread_count_counts_only_own_unread(client, world, db):
    me = world.a.employee
    add(db, me)
    add(db, me)
    add(db, me, is_read=True)
    add(db, world.a.manager)
    res = client.get(f"{BASE}/unread-count", headers=auth(me))
    assert res.status_code == 200
    assert res.json()["data"] == {"count": 2}
    assert client.get(f"{BASE}/unread-count", headers=auth(world.a.client_user)).json()["data"] == {"count": 0}
    assert client.get(f"{BASE}/unread-count").status_code == 401


def test_mark_one_read(client, world, db):
    me = world.a.employee
    note = add(db, me)
    res = client.patch(f"{BASE}/{note.id}/read", headers=auth(me))
    assert res.status_code == 200 and res.json()["data"]["is_read"] is True and res.json()["data"]["id"] == note.id
    assert client.get(f"{BASE}/unread-count", headers=auth(me)).json()["data"]["count"] == 0
    # idempotent
    assert client.patch(f"{BASE}/{note.id}/read", headers=auth(me)).status_code == 200


def test_mark_all_read_only_touches_own(client, world, db):
    me, other = world.a.employee, world.a.manager
    add(db, me)
    add(db, me)
    add(db, me, is_read=True)
    theirs = add(db, other)
    res = client.patch(f"{BASE}/read-all", headers=auth(me))
    assert res.status_code == 200 and res.json()["data"] == {"count": 2}
    assert client.get(f"{BASE}/unread-count", headers=auth(me)).json()["data"]["count"] == 0
    assert client.get(f"{BASE}/unread-count", headers=auth(other)).json()["data"]["count"] == 1
    assert client.patch(f"{BASE}/read-all", headers=auth(me)).json()["data"] == {"count": 0}  # nothing left to change
    db.rollback()
    db.refresh(theirs)
    assert theirs.is_read is False


def test_delete_own_notification(client, world, db):
    me = world.a.employee
    note = add(db, me)
    res = client.delete(f"{BASE}/{note.id}", headers=auth(me))
    assert res.status_code == 200 and res.json()["data"] is None
    assert client.get(BASE, headers=auth(me)).json()["total"] == 0
    assert client.delete(f"{BASE}/{note.id}", headers=auth(me)).status_code == 404


def test_other_users_notifications_answer_404(client, world, db):
    note = add(db, world.a.manager, "private")
    for intruder in (world.a.employee, world.a.admin, world.b.admin, world.a.client_user, world.super_admin):
        h = auth(intruder)
        assert client.patch(f"{BASE}/{note.id}/read", headers=h).status_code == 404
        assert client.delete(f"{BASE}/{note.id}", headers=h).status_code == 404
        assert note.id not in [n["id"] for n in client.get(BASE, headers=h).json()["data"]]
    db.rollback()
    db.refresh(note)
    assert note.is_read is False  # untouched
    assert client.get(BASE, headers=auth(world.a.manager)).json()["total"] == 1
    assert client.patch(f"{BASE}/99999/read", headers=auth(world.a.manager)).status_code == 404


def test_every_role_has_an_inbox(client, world, db):
    for user in (world.a.admin, world.a.manager, world.a.employee, world.a.client_user, world.super_admin):
        add(db, user, f"for {user.id}")
        res = client.get(BASE, headers=auth(user))
        assert res.status_code == 200 and res.json()["total"] == 1
