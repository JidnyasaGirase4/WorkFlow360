from datetime import datetime
from typing import Annotated

from pydantic import StringConstraints, computed_field

from app.core.enums import DocumentCategory, DocumentVisibility
from app.schemas.common import ORMModel, RequestModel

DocName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]


def human_size(size: int) -> str:
    value = float(size)
    for unit in ("B", "KB", "MB", "GB"):
        if value < 1024 or unit == "GB":
            return f"{int(value)} {unit}" if unit == "B" else f"{value:.1f} {unit}"
        value /= 1024
    return f"{size} B"  # pragma: no cover


class DocumentUpdate(RequestModel):
    name: DocName | None = None
    category: DocumentCategory | None = None
    visibility: DocumentVisibility | None = None


class DocumentOut(ORMModel):
    """The stored `file_path` is deliberately not exposed; files are only reachable via the download endpoint."""

    id: int
    company_id: int
    name: str
    file_name: str
    file_type: str
    file_size: int
    category: DocumentCategory
    visibility: DocumentVisibility
    client_id: int | None
    client_name: str | None = None
    project_id: int | None
    project_name: str | None = None
    employee_id: int | None
    uploaded_by: int | None
    uploaded_by_name: str | None = None
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def file_size_display(self) -> str:
        return human_size(self.file_size)
