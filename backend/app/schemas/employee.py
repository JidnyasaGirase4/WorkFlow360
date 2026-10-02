from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated, Literal

from pydantic import AfterValidator, EmailStr, Field, StringConstraints, field_validator, model_validator

from app.core.enums import EmploymentStatus, EmploymentType, UserStatus
from app.schemas.common import LongText, Name, ORMModel, Phone, RequestModel
from app.schemas.leave import LeaveBalance
from app.schemas.user import validate_new_password

Designation = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
EmployeeCode = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]
Salary = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2), AfterValidator(lambda v: v.quantize(Decimal("0.01"), ROUND_HALF_UP))]
Skills = Annotated[list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]], Field(max_length=30)]
Short = Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)]


class _EmployeeFields(RequestModel):
    department_id: int | None = None
    designation: Designation | None = None
    employee_code: EmployeeCode | None = None
    joining_date: date | None = None
    salary: Salary | None = None
    employment_type: EmploymentType = EmploymentType.FULL_TIME
    address: LongText | None = None
    emergency_contact_name: Short | None = None
    emergency_contact_phone: Phone | None = None
    emergency_contact_relation: Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)] | None = None
    date_of_birth: date | None = None
    gender: Annotated[str, StringConstraints(strip_whitespace=True, max_length=20)] | None = None
    location: Short | None = None
    skills: Skills | None = None
    manager_id: int | None = None

    @field_validator("date_of_birth")
    @classmethod
    def _past(cls, v):
        if v and v >= date.today():
            raise ValueError("date_of_birth must be in the past")
        return v


class EmployeeCreate(_EmployeeFields):
    name: Name
    email: EmailStr
    phone: Phone | None = None
    role: Literal["employee", "manager"] = "employee"
    password: str | None = None  # omitted -> a strong temporary password is generated and returned once
    employment_status: Literal["active", "on_leave"] = "active"

    @field_validator("password")
    @classmethod
    def _password(cls, v):
        return validate_new_password(v) if v is not None else v


class EmployeeUpdate(RequestModel):
    # linked user account
    name: Name | None = None
    email: EmailStr | None = None
    phone: Phone | None = None
    # employee profile
    department_id: int | None = None
    designation: Designation | None = None
    employee_code: EmployeeCode | None = None
    joining_date: date | None = None
    salary: Salary | None = None
    employment_status: EmploymentStatus | None = None
    employment_type: EmploymentType | None = None
    address: LongText | None = None
    emergency_contact_name: Short | None = None
    emergency_contact_phone: Phone | None = None
    emergency_contact_relation: Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)] | None = None
    date_of_birth: date | None = None
    gender: Annotated[str, StringConstraints(strip_whitespace=True, max_length=20)] | None = None
    location: Short | None = None
    skills: Skills | None = None
    manager_id: int | None = None

    @model_validator(mode="after")
    def _not_null(self):
        for field in ("name", "email", "employee_code", "employment_status", "employment_type"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self

    @field_validator("date_of_birth")
    @classmethod
    def _past(cls, v):
        if v and v >= date.today():
            raise ValueError("date_of_birth must be in the past")
        return v


class EmployeeOut(ORMModel):
    """Fields below the 'directory' block are null unless the caller may see them (see services.employees.serialize)."""

    # directory (visible to every internal user)
    id: int
    company_id: int
    user_id: int
    employee_code: str
    name: str
    email: str
    phone: str | None
    role: str
    profile_image: str | None
    department_id: int | None
    department_name: str | None
    designation: str | None
    location: str | None
    employment_status: EmploymentStatus
    # admin / manager / the employee themself
    user_status: UserStatus | None = None
    joining_date: date | None = None
    employment_type: EmploymentType | None = None
    manager_id: int | None = None
    manager_name: str | None = None
    skills: list[str] | None = None
    gender: str | None = None
    date_of_birth: date | None = None
    address: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    emergency_contact_relation: str | None = None
    # view_salary holders or the employee themself
    salary: Decimal | None = None
    created_at: datetime
    updated_at: datetime


class EmployeeStats(ORMModel):
    project_count: int
    open_task_count: int
    leave_balance: LeaveBalance


class EmployeeDetail(EmployeeOut):
    stats: EmployeeStats | None = None  # null in the directory (limited) view


class EmployeeCreated(EmployeeDetail):
    temporary_password: str | None = None  # only when the server generated the password; shown once


class EmployeeActivityOut(ORMModel):
    id: int
    action: str
    entity_type: str
    entity_id: int | None
    description: str | None
    ip_address: str | None
    created_at: datetime
