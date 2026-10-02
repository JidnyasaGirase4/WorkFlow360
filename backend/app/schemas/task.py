from datetime import date, datetime
from typing import Annotated

from pydantic import Field, StringConstraints, field_validator, model_validator

from app.core.enums import Priority, TaskStatus
from app.schemas.common import LongText, ORMModel, RequestModel

TaskTitle = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
ChecklistText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]


class ChecklistItemIn(RequestModel):
    id: Annotated[str, StringConstraints(max_length=40)] | None = None  # kept when unique, otherwise assigned by the server
    text: ChecklistText
    done: bool = False


class ChecklistItem(ORMModel):
    id: str
    text: str
    done: bool


def _check_dates(start: date | None, due: date | None) -> None:
    if start and due and due < start:
        raise ValueError("due_date cannot be before start_date")


class TaskCreate(RequestModel):
    project_id: int
    milestone_id: int | None = None
    assigned_to: int | None = None
    title: TaskTitle
    description: LongText | None = None
    priority: Priority = Priority.MEDIUM
    status: TaskStatus = TaskStatus.TODO
    start_date: date | None = None
    due_date: date | None = None
    checklist: list[ChecklistItemIn] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def _dates(self):
        _check_dates(self.start_date, self.due_date)
        return self


class TaskUpdate(RequestModel):
    milestone_id: int | None = None
    assigned_to: int | None = None
    title: TaskTitle | None = None
    description: LongText | None = None
    priority: Priority | None = None
    status: TaskStatus | None = None
    start_date: date | None = None
    due_date: date | None = None
    checklist: list[ChecklistItemIn] | None = Field(None, max_length=100)

    @model_validator(mode="after")
    def _validate(self):
        for field in ("title", "priority", "status", "checklist"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        _check_dates(self.start_date, self.due_date)
        return self


class StatusUpdate(RequestModel):
    status: TaskStatus


class AssignUpdate(RequestModel):
    assigned_to: int | None  # required key; null unassigns


class ChecklistUpdate(RequestModel):
    checklist: list[ChecklistItemIn] = Field(max_length=100)


class CommentCreate(RequestModel):
    comment: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]


class CommentOut(ORMModel):
    id: int
    task_id: int
    user_id: int | None
    user_name: str | None
    comment: str
    created_at: datetime


class AttachmentOut(ORMModel):
    id: int
    task_id: int
    uploaded_by: int | None
    uploaded_by_name: str | None
    file_name: str
    file_type: str
    file_size: int
    created_at: datetime


class TaskBase(ORMModel):
    id: int
    company_id: int
    project_id: int
    milestone_id: int | None
    assigned_to: int | None
    created_by: int | None
    title: str
    description: str | None
    priority: Priority
    status: TaskStatus
    start_date: date | None
    due_date: date | None
    completed_at: datetime | None
    checklist: list[ChecklistItem]
    created_at: datetime
    updated_at: datetime

    @field_validator("checklist", mode="before")
    @classmethod
    def _null_checklist(cls, v):
        return v or []


class TaskOut(TaskBase):
    project_name: str | None
    milestone_name: str | None
    assignee_name: str | None
    assignee_user_id: int | None
    created_by_name: str | None
    comment_count: int
    attachment_count: int
    is_overdue: bool
