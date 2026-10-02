from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import Field, StringConstraints, model_validator

from app.core.enums import AttendanceStatus
from app.schemas.common import ORMModel, RequestModel

HHMM = Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]
Notes = Annotated[str, Field(max_length=255)]


def minutes(value: str | None) -> int | None:
    return None if not value else int(value[:2]) * 60 + int(value[3:5])


class CheckInRequest(RequestModel):
    status: Literal["wfh"] | None = None  # only "wfh" can be chosen; late/present are derived from the time
    notes: Notes | None = None


class AttendanceCreate(RequestModel):
    employee_id: int
    attendance_date: date
    check_in: HHMM | None = None
    check_out: HHMM | None = None
    status: AttendanceStatus = AttendanceStatus.PRESENT
    notes: Notes | None = None

    @model_validator(mode="after")
    def _order(self):
        if self.check_in and self.check_out and self.check_out < self.check_in:
            raise ValueError("check_out cannot be before check_in")
        return self


class AttendanceUpdate(RequestModel):
    check_in: HHMM | None = None
    check_out: HHMM | None = None
    status: AttendanceStatus | None = None
    notes: Notes | None = None

    @model_validator(mode="after")
    def _order(self):
        if self.check_in and self.check_out and self.check_out < self.check_in:
            raise ValueError("check_out cannot be before check_in")
        if "status" in self.model_fields_set and self.status is None:
            raise ValueError("status cannot be null")
        return self


class AttendanceOut(ORMModel):
    id: int
    company_id: int
    employee_id: int
    employee_name: str
    employee_code: str
    designation: str | None
    department_id: int | None
    department_name: str | None
    attendance_date: date
    check_in: str | None
    check_out: str | None
    worked_minutes: int
    status: AttendanceStatus
    notes: str | None
    created_at: datetime

    @classmethod
    def from_record(cls, rec) -> "AttendanceOut":
        emp = rec.employee
        start, end = minutes(rec.check_in), minutes(rec.check_out)
        return cls(
            id=rec.id,
            company_id=rec.company_id,
            employee_id=rec.employee_id,
            employee_name=emp.user.name,
            employee_code=emp.employee_code,
            designation=emp.designation,
            department_id=emp.department_id,
            department_name=emp.department.name if emp.department else None,
            attendance_date=rec.attendance_date,
            check_in=rec.check_in,
            check_out=rec.check_out,
            worked_minutes=end - start if start is not None and end is not None and end >= start else 0,
            status=rec.status,
            notes=rec.notes,
            created_at=rec.created_at,
        )


class AttendanceToday(ORMModel):
    date: date
    total_employees: int
    not_marked: int
    counts: dict[str, int]
    records: list[AttendanceOut]


class AttendanceMonthSummary(ORMModel):
    month: str
    employee_id: int
    present: int
    late: int
    wfh: int
    absent: int
    half_day: int
    on_leave: int
    total_records: int


class HolidayCreate(RequestModel):
    holiday_date: date
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]


class HolidayOut(ORMModel):
    id: int
    company_id: int
    holiday_date: date
    name: str
