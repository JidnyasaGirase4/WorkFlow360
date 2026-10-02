from typing import Any

from app.schemas.common import ORMModel


class ReportData(ORMModel):
    """`summary` holds the totals, `rows` the (paginated) detail lines, `chart` ready-to-plot points
    (`label` + `value`, with extra series keys where useful). Money is a JSON number with 2 decimals."""

    summary: dict[str, Any]
    rows: list[dict[str, Any]]
    chart: list[dict[str, Any]]


class ReportPage(ORMModel):
    """Same paging fields as `Page[T]`, but `data` is the report object; paging applies to `data.rows`."""

    success: bool = True
    message: str = "OK"
    data: ReportData
    page: int
    limit: int
    total: int
    total_pages: int
