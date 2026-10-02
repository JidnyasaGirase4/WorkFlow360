"""Standard response envelopes used by every endpoint."""
from typing import Any, Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Envelope(BaseModel, Generic[T]):
    success: bool = True
    message: str = "OK"
    data: T


class Page(BaseModel, Generic[T]):
    success: bool = True
    message: str = "OK"
    data: list[T]
    page: int
    limit: int
    total: int
    total_pages: int


class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    errors: dict[str, Any] = {}


# Reusable `responses=` block so Swagger documents the shared error shapes.
ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorResponse, "description": "Missing, invalid or expired access token"},
    403: {"model": ErrorResponse, "description": "Authenticated but not allowed"},
    404: {"model": ErrorResponse, "description": "Record not found (or belongs to another company)"},
    422: {"model": ErrorResponse, "description": "Validation error"},
}


def ok(data: Any = None, message: str = "OK") -> dict[str, Any]:
    return {"success": True, "message": message, "data": data}
