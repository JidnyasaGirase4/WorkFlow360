"""Read-only access to the audit trail (rows are written by log_activity elsewhere and never modified)."""
from datetime import date, datetime, time, timedelta

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.core.deps import Ctx
from app.models.activity import ActivityLog
from app.models.user import User
from app.schemas.audit import AuditLogOut
from app.services.common import get_scoped_or_404
from app.utils.pagination import PageParams, like_any, paginate


def list_query(
    ctx: Ctx, *, user_id: int | None, entity_type: str | None, action: str | None,
    date_from: date | None, date_to: date | None, search: str | None,
) -> Select:
    stmt = ctx.scope(select(ActivityLog), ActivityLog)
    if user_id is not None:
        stmt = stmt.where(ActivityLog.user_id == user_id)
    if entity_type:
        stmt = stmt.where(ActivityLog.entity_type == entity_type)
    if action:
        stmt = stmt.where(ActivityLog.action == action)
    if date_from:
        stmt = stmt.where(ActivityLog.created_at >= datetime.combine(date_from, time.min))
    if date_to:  # inclusive of the whole end day
        stmt = stmt.where(ActivityLog.created_at < datetime.combine(date_to + timedelta(days=1), time.min))
    if search:
        stmt = stmt.where(like_any(search, ActivityLog.description))
    return stmt


def _serialize(rows: list[ActivityLog], names: dict[int, str]) -> list[AuditLogOut]:
    fields = [f for f in AuditLogOut.model_fields if f != "user_name"]
    return [AuditLogOut.model_validate({**{f: getattr(r, f) for f in fields}, "user_name": names.get(r.user_id)}) for r in rows]


def _names(db: Session, rows: list[ActivityLog]) -> dict[int, str]:
    ids = {r.user_id for r in rows if r.user_id is not None}
    return dict(db.execute(select(User.id, User.name).where(User.id.in_(ids))).all()) if ids else {}


def list_logs(db: Session, stmt: Select, pagination: PageParams) -> dict:
    page = paginate(db, stmt, pagination, lambda row: row)
    page["data"] = _serialize(page["data"], _names(db, page["data"]))
    return page


def get_log(db: Session, ctx: Ctx, log_id: int) -> AuditLogOut:
    row = get_scoped_or_404(db, ctx, ActivityLog, log_id, "Audit log")
    return _serialize([row], _names(db, [row]))[0]
