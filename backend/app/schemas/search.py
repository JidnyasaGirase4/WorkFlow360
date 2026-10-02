from pydantic import Field

from app.schemas.common import ORMModel


class SearchHit(ORMModel):
    id: int
    title: str
    subtitle: str = ""
    status: str = ""


class SearchResults(ORMModel):
    """Only the categories the caller may search are present; the rest are omitted (not empty lists)."""

    query: str
    total_results: int = Field(description="Number of hits returned across all categories (each capped at `limit`)")
    clients: list[SearchHit] | None = None
    leads: list[SearchHit] | None = None
    projects: list[SearchHit] | None = None
    employees: list[SearchHit] | None = None
    tasks: list[SearchHit] | None = None
    invoices: list[SearchHit] | None = None
    tickets: list[SearchHit] | None = None
