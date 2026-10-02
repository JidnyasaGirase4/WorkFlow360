from datetime import date, datetime
from typing import Annotated

from pydantic import Field, model_validator

from app.core.enums import LeaveStatus, LeaveType
from app.schemas.common import ORMModel, RequestModel

Reason = Annotated[str, Field(max_length=500)]


class LeaveCreate(RequestModel):
    leave_type: LeaveType
    start_date: date
    end_date: date
    reason: Reason | None = None

    @model_validator(mode="after")
    def _range(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class LeaveReject(RequestModel):
    reason: Annotated[str, Field(min_length=2, max_length=500)]


class LeaveOut(ORMModel):
    id: int
    company_id: int
    employee_id: int
    employee_name: str
    employee_code: str
    department_id: int | None
    department_name: str | None
    leave_type: LeaveType
    start_date: date
    end_date: date
    days: float
    reason: str | None
    status: LeaveStatus
    decided_by: int | None
    decided_by_name: str | None
    decided_at: date | None
    rejection_reason: str | None
    created_at: datetime  # "applied on"
    updated_at: datetime


class LeaveBalanceItem(ORMModel):
    total: float
    used: float
    pending: float
    remaining: float


class LeaveBalance(ORMModel):
    employee_id: int
    year: int
    casual: LeaveBalanceItem
    sick: LeaveBalanceItem
    earned: LeaveBalanceItem
