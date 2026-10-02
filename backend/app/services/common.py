"""Small helpers shared by every service."""
from typing import TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import Ctx
from app.core.exceptions import NotFoundError

M = TypeVar("M")


def get_scoped_or_404(db: Session, ctx: Ctx, model: type[M], record_id: int, label: str | None = None) -> M:
    """Load a company-owned row by id. A row from another company looks exactly like a missing one (404)."""
    stmt = ctx.scope(select(model).where(model.id == record_id), model)
    row = db.scalars(stmt).unique().first()
    if row is None:
        raise NotFoundError(f"{label or model.__name__} not found")
    return row


def assert_same_company(ctx: Ctx, company_id: int | None, label: str = "Record") -> None:
    """Guard for foreign keys supplied by the caller (e.g. client_id on a new project)."""
    if company_id is None or (ctx.company_id is not None and company_id != ctx.company_id):
        raise NotFoundError(f"{label} not found")


def get_referenced(db: Session, ctx: Ctx, model: type[M], record_id: int | None, label: str) -> M | None:
    """Validate an optional FK from the request body belongs to the caller's company."""
    if record_id is None:
        return None
    return get_scoped_or_404(db, ctx, model, record_id, label)
