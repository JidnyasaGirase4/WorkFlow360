"""The caller's own notification inbox. (Creating notifications lives in `services/notifications.py`.)"""
from sqlalchemy import Select, func, select, update
from sqlalchemy.orm import Session

from app.core.deps import Ctx
from app.core.enums import NotificationType
from app.core.exceptions import NotFoundError
from app.models.notification import Notification


def list_query(ctx: Ctx, *, is_read: bool | None, type_: NotificationType | None) -> Select:
    stmt = select(Notification).where(Notification.user_id == ctx.user.id)
    if is_read is not None:
        stmt = stmt.where(Notification.is_read == is_read)
    if type_ is not None:
        stmt = stmt.where(Notification.type == type_)
    return stmt


def unread_count(db: Session, ctx: Ctx) -> int:
    return db.scalar(select(func.count()).select_from(Notification).where(Notification.user_id == ctx.user.id, Notification.is_read.is_(False))) or 0


def get_own(db: Session, ctx: Ctx, notification_id: int) -> Notification:
    """Someone else's notification looks exactly like a missing one."""
    row = db.scalars(select(Notification).where(Notification.id == notification_id, Notification.user_id == ctx.user.id)).first()
    if row is None:
        raise NotFoundError("Notification not found")
    return row


def mark_read(db: Session, ctx: Ctx, notification_id: int) -> Notification:
    notification = get_own(db, ctx, notification_id)
    notification.is_read = True
    db.commit()
    return notification


def mark_all_read(db: Session, ctx: Ctx) -> int:
    result = db.execute(
        update(Notification).where(Notification.user_id == ctx.user.id, Notification.is_read.is_(False)).values(is_read=True)
    )
    db.commit()
    return result.rowcount


def delete(db: Session, ctx: Ctx, notification_id: int) -> None:
    db.delete(get_own(db, ctx, notification_id))
    db.commit()
