from typing import Annotated

from fastapi import APIRouter, Query

from app.core.deps import CurrentCtx, DbSession
from app.schemas.search import SearchResults
from app.services import search as service
from app.utils.responses import ERROR_RESPONSES, Envelope, ok

router = APIRouter(prefix="/search", tags=["Search"], responses={401: ERROR_RESPONSES[401], 422: ERROR_RESPONSES[422]})


@router.get(
    "",
    response_model=Envelope[SearchResults],
    response_model_exclude_none=True,
    summary="Global search across modules",
    description="Case-insensitive contains-search (wildcards in `q` are treated literally). Each category is capped at `limit` and is "
    "present only when the caller has that module's view permission; row-level rules apply (an employee finds only their projects "
    "and assigned tasks, a client only their own projects, non-draft invoices and tickets). Super admins search all companies "
    "unless `?company_id=` is given.",
)
def search(
    ctx: CurrentCtx,
    db: DbSession,
    q: Annotated[str, Query(min_length=2, max_length=100, description="Search text, at least 2 characters")],
    limit: Annotated[int, Query(ge=1, le=20, description="Maximum hits per category")] = 5,
    company_id: Annotated[int | None, Query(description="Super admin only")] = None,
):
    return ok(service.search(db, ctx, q, limit))
