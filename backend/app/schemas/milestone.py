from datetime import date, datetime

from pydantic import Field, model_validator

from app.core.enums import MilestoneStatus
from app.schemas.common import LongText, ORMModel, RequestModel, ShortText


class MilestoneCreate(RequestModel):
    name: ShortText
    description: LongText | None = None
    due_date: date | None = None
    status: MilestoneStatus = MilestoneStatus.PENDING
    # Only stored while the milestone has no tasks; afterwards it is derived from them.
    progress: int = Field(0, ge=0, le=100)


class MilestoneUpdate(RequestModel):
    name: ShortText | None = None
    description: LongText | None = None
    due_date: date | None = None
    status: MilestoneStatus | None = None
    progress: int | None = Field(None, ge=0, le=100)

    @model_validator(mode="after")
    def _no_null_required(self):
        for field in ("name", "status", "progress"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class MilestoneBase(ORMModel):
    id: int
    project_id: int
    name: str
    description: str | None
    due_date: date | None
    status: MilestoneStatus
    progress: int
    created_at: datetime
    updated_at: datetime


class MilestoneOut(MilestoneBase):
    task_count: int
    completed_task_count: int
    is_overdue: bool
