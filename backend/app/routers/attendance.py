from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.deps import CurrentCtx, DbSession, Needs
from app.core.enums import AttendanceStatus
from app.models.employee import AttendanceRecord
from app.schemas.attendance import (
    AttendanceCreate,
    AttendanceMonthSummary,
    AttendanceOut,
    AttendanceToday,
    AttendanceUpdate,
    CheckInRequest,
    HolidayCreate,
    HolidayOut,
)
from app.services import attendance as service
from app.utils.pagination import Pagination, Sorting, apply_sort, paginate
from app.utils.responses import ERROR_RESPONSES, Envelope, Page, ok

router = APIRouter(prefix="/attendance", tags=["Attendance"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})
holidays_router = APIRouter(prefix="/holidays", tags=["Attendance"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})
extra_routers = [holidays_router]

SORT_FIELDS = {
    "id": AttendanceRecord.id,
    "attendance_date": AttendanceRecord.attendance_date,
    "check_in": AttendanceRecord.check_in,
    "status": AttendanceRecord.status,
    "created_at": AttendanceRecord.created_at,
}
CONFLICT = ERROR_RESPONSES[422] | {"description": "State conflict"}


@router.post(
    "/check-in",
    response_model=Envelope[AttendanceOut],
    status_code=status.HTTP_201_CREATED,
    summary="Check in for today",
    description="One record per employee per day (409 on a second check-in). After 10:00 server time the status is `late`; "
    "send `{\"status\": \"wfh\"}` to check in from home.",
    responses={409: CONFLICT},
)
def check_in(ctx: Needs("mark_attendance"), db: DbSession, body: CheckInRequest | None = None):
    return ok(AttendanceOut.from_record(service.check_in(db, ctx, body)), "Checked in successfully")


@router.post(
    "/check-out",
    response_model=Envelope[AttendanceOut],
    summary="Check out for today",
    description="409 when there is no check-in today or the caller already checked out.",
    responses={409: CONFLICT},
)
def check_out(ctx: Needs("mark_attendance"), db: DbSession):
    return ok(AttendanceOut.from_record(service.check_out(db, ctx)), "Checked out successfully")


@router.get(
    "",
    response_model=Page[AttendanceOut],
    summary="List attendance records",
    description="Callers with `view_attendance` see the whole company; everyone else only their own records.",
)
def list_attendance(
    ctx: CurrentCtx,
    db: DbSession,
    pagination: Pagination,
    sorting: Sorting,
    employee_id: int | None = None,
    date_: Annotated[date | None, Query(alias="date", description="Exact day")] = None,
    date_from: date | None = None,
    date_to: date | None = None,
    status_: Annotated[AttendanceStatus | None, Query(alias="status")] = None,
    department_id: int | None = None,
):
    stmt = service.list_query(ctx, employee_id=employee_id, on_date=date_, date_from=date_from, date_to=date_to, status=status_, department_id=department_id)
    stmt = apply_sort(stmt, sorting, SORT_FIELDS, "attendance_date")
    return paginate(db, stmt, pagination, AttendanceOut.from_record)


@router.get("/today", response_model=Envelope[AttendanceToday], summary="Today's attendance summary", description="Counts by status plus today's records.")
def attendance_today(ctx: Needs("view_attendance"), db: DbSession):
    return ok(service.today_summary(db, ctx))


@router.get("/me/summary", response_model=Envelope[AttendanceMonthSummary], summary="My monthly attendance counts")
def my_summary(
    ctx: Needs("mark_attendance"),
    db: DbSession,
    month: Annotated[str | None, Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$", description="YYYY-MM, defaults to the current month")] = None,
):
    return ok(service.month_summary(db, ctx, month))


@router.post(
    "",
    response_model=Envelope[AttendanceOut],
    status_code=status.HTTP_201_CREATED,
    summary="Create an attendance record manually",
    responses={404: ERROR_RESPONSES[404], 409: CONFLICT},
)
def create_attendance(body: AttendanceCreate, ctx: Needs("manage_attendance"), db: DbSession):
    return ok(AttendanceOut.from_record(service.create_record(db, ctx, body)), "Attendance recorded")


@router.put("/{record_id}", response_model=Envelope[AttendanceOut], summary="Update an attendance record", responses={404: ERROR_RESPONSES[404]})
def update_attendance(record_id: int, body: AttendanceUpdate, ctx: Needs("manage_attendance"), db: DbSession):
    return ok(AttendanceOut.from_record(service.update_record(db, ctx, record_id, body)), "Attendance updated")


@router.delete("/{record_id}", response_model=Envelope[None], summary="Delete an attendance record", responses={404: ERROR_RESPONSES[404]})
def delete_attendance(record_id: int, ctx: Needs("manage_attendance"), db: DbSession):
    service.delete_record(db, ctx, record_id)
    return ok(None, "Attendance record deleted")


# ---- holidays --------------------------------------------------------------

@holidays_router.get("", response_model=Envelope[list[HolidayOut]], summary="List holidays of a year", description="Open to every internal user of the company.")
def list_holidays(ctx: CurrentCtx, db: DbSession, year: Annotated[int | None, Query(ge=2000, le=2100)] = None):
    return ok(service.list_holidays(db, ctx, year or date.today().year))


@holidays_router.post(
    "",
    response_model=Envelope[HolidayOut],
    status_code=status.HTTP_201_CREATED,
    summary="Add a holiday",
    description="One holiday per company per date (409 otherwise).",
    responses={409: CONFLICT},
)
def create_holiday(body: HolidayCreate, ctx: Needs("manage_settings"), db: DbSession):
    return ok(service.create_holiday(db, ctx, body), "Holiday added")


@holidays_router.delete("/{holiday_id}", response_model=Envelope[None], summary="Remove a holiday", responses={404: ERROR_RESPONSES[404]})
def delete_holiday(holiday_id: int, ctx: Needs("manage_settings"), db: DbSession):
    service.delete_holiday(db, ctx, holiday_id)
    return ok(None, "Holiday removed")
