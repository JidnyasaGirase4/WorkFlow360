from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import Field, StringConstraints, model_validator

from app.core.enums import ProjectStatus
from app.schemas.common import LongText, ORMModel, RequestModel, ShortText

ProjectCode = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]
Budget = Annotated[Decimal, Field(ge=0, max_digits=14, decimal_places=2)]


class ProjectCreate(RequestModel):
    name: ShortText
    description: LongText | None = None
    project_code: ProjectCode | None = None  # generated (PRJ-001, ...) when omitted
    client_id: int | None = None
    manager_id: int | None = None
    start_date: date | None = None
    end_date: date | None = None
    budget: Budget = Decimal("0")
    status: ProjectStatus = ProjectStatus.PLANNING
    # Only stored while the project has no tasks; afterwards it is derived from them.
    progress: int = Field(0, ge=0, le=100)
    member_ids: list[int] = []

    @model_validator(mode="after")
    def _dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        return self


class ProjectUpdate(RequestModel):
    name: ShortText | None = None
    description: LongText | None = None
    project_code: ProjectCode | None = None
    client_id: int | None = None
    manager_id: int | None = None
    start_date: date | None = None
    end_date: date | None = None
    budget: Budget | None = None
    status: ProjectStatus | None = None
    progress: int | None = Field(None, ge=0, le=100)

    @model_validator(mode="after")
    def _validate(self):
        for field in ("name", "project_code", "budget", "status", "progress"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        return self


class MemberCreate(RequestModel):
    employee_id: int
    role: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)] | None = None


class MemberOut(ORMModel):
    employee_id: int
    user_id: int
    name: str
    designation: str | None
    role: str | None


class ProjectBase(ORMModel):
    id: int
    company_id: int
    client_id: int | None
    name: str
    description: str | None
    project_code: str
    manager_id: int | None
    start_date: date | None
    end_date: date | None
    status: ProjectStatus
    progress: int
    created_by: int | None
    created_at: datetime
    updated_at: datetime


class ProjectOut(ProjectBase):
    budget: Decimal | None  # null for client users (internal number)
    spent: Decimal | None  # SUM(expenses.amount); null for client users
    client_name: str | None
    manager_name: str | None
    members: list[MemberOut]
    task_count: int
    completed_task_count: int


class ActivityOut(ORMModel):
    id: int
    user_id: int | None
    user_name: str | None
    action: str
    entity_type: str
    entity_id: int | None
    description: str | None
    created_at: datetime
