"""Audit trail. Call inside the same transaction as the change being recorded."""
from sqlalchemy.orm import Session

from app.core.deps import Ctx
from app.models.activity import ActivityLog


def log_activity(
    db: Session,
    ctx: Ctx | None,
    action: str,
    entity_type: str,
    entity_id: int | None,
    description: str,
    *,
    user_id: int | None = None,
    company_id: int | None = None,
    ip: str | None = None,
) -> ActivityLog:
    """Adds an audit row to the session (caller commits). Pass ctx, or explicit ids for unauthenticated flows (login)."""
    entry = ActivityLog(
        user_id=ctx.user.id if ctx else user_id,
        company_id=(ctx.company_id if ctx and ctx.company_id is not None else company_id),
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        ip_address=ctx.ip if ctx else ip,
    )
    db.add(entry)
    return entry
