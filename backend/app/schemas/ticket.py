from datetime import datetime
from typing import Annotated

from pydantic import StringConstraints

from app.core.enums import Priority, TicketStatus
from app.schemas.common import ORMModel, RequestModel

Subject = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=255)]
Body = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]
Category = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


class TicketCreate(RequestModel):
    client_id: int | None = None  # required for internal creators; client users are pinned to their own client
    project_id: int | None = None
    subject: Subject
    description: Body
    category: Category | None = None
    priority: Priority = Priority.MEDIUM


class TicketUpdate(RequestModel):
    project_id: int | None = None
    subject: Subject | None = None
    description: Body | None = None
    category: Category | None = None
    priority: Priority | None = None


class TicketStatusUpdate(RequestModel):
    status: TicketStatus


class TicketAssign(RequestModel):
    assigned_to: int | None = None  # null unassigns


class CommentCreate(RequestModel):
    comment: Body
    is_internal: bool = False


class AttachmentOut(ORMModel):
    """The stored `file_path` is not exposed; download goes through the authorised endpoint."""

    id: int
    ticket_id: int
    comment_id: int | None
    uploaded_by: int | None
    uploaded_by_name: str | None = None
    file_name: str
    file_type: str
    file_size: int
    created_at: datetime


class CommentOut(ORMModel):
    id: int
    ticket_id: int
    user_id: int | None
    user_name: str | None = None
    user_role: str | None = None
    comment: str
    is_internal: bool
    created_at: datetime
    attachments: list[AttachmentOut] = []


class TicketOut(ORMModel):
    id: int
    company_id: int
    ticket_number: str
    client_id: int
    client_name: str | None = None
    project_id: int | None
    project_name: str | None = None
    subject: str
    description: str
    category: str | None
    priority: Priority
    status: TicketStatus
    assigned_to: int | None
    assignee_name: str | None = None
    created_by: int | None
    created_by_name: str | None = None
    resolved_at: datetime | None
    comment_count: int = 0
    created_at: datetime
    updated_at: datetime


class TicketDetail(TicketOut):
    comments: list[CommentOut] = []
    attachments: list[AttachmentOut] = []
