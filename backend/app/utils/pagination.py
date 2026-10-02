"""Pagination, sorting and search helpers. Sort fields are whitelisted, never interpolated."""
from dataclasses import dataclass
from math import ceil
from typing import Annotated, Any, Callable

from fastapi import Depends, Query
from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import UnprocessableError


@dataclass
class PageParams:
    page: int
    limit: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.limit


def page_params(
    page: Annotated[int, Query(ge=1, description="1-based page number")] = 1,
    limit: Annotated[int, Query(ge=1, le=100, description="Items per page (max 100)")] = 20,
) -> PageParams:
    return PageParams(page=page, limit=limit)


Pagination = Annotated[PageParams, Depends(page_params)]


@dataclass
class SortParams:
    sort_by: str | None
    sort_order: str


def sort_params(
    sort_by: Annotated[str | None, Query(description="Field to sort by (allowed fields vary per endpoint)")] = None,
    sort_order: Annotated[str, Query(pattern="^(asc|desc)$", description="asc or desc")] = "desc",
) -> SortParams:
    return SortParams(sort_by, sort_order)


Sorting = Annotated[SortParams, Depends(sort_params)]


def apply_sort(stmt: Select, sort: SortParams, allowed: dict[str, Any], default: str) -> Select:
    """`allowed` maps public field name -> column. Unknown fields are rejected with 422."""
    key = sort.sort_by or default
    if key not in allowed:
        raise UnprocessableError(f"Cannot sort by '{key}'", {"sort_by": f"Allowed: {', '.join(sorted(allowed))}"})
    column = allowed[key]
    order = column.asc() if sort.sort_order == "asc" else column.desc()
    pk = list(allowed.values())[0]  # stable tiebreaker
    return stmt.order_by(order, pk.desc() if pk is not column else pk.asc())


def like_any(term: str, *columns) -> Any:
    """Case-insensitive contains-search across columns; wildcards in user input are escaped."""
    escaped = term.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")
    pattern = f"%{escaped}%"
    return or_(*[col.like(pattern) for col in columns])


def paginate(db: Session, stmt: Select, params: PageParams, serialize: Callable[[Any], Any], *, unique: bool = False) -> dict[str, Any]:
    """Runs COUNT + page query and returns the standard paginated envelope."""
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    result = db.scalars(stmt.limit(params.limit).offset(params.offset))
    rows = result.unique().all() if unique else result.all()
    return {
        "success": True,
        "message": "OK",
        "data": [serialize(row) for row in rows],
        "page": params.page,
        "limit": params.limit,
        "total": total,
        "total_pages": ceil(total / params.limit) if total else 0,
    }
