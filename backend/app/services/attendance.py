"""Attendance (check-in/out, manual records, summaries) and company holidays."""
from datetime import date, datetime

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.deps import Ctx
from app.core.enums import AttendanceStatus, EmploymentStatus
from app.core.exceptions import ConflictError, ForbiddenError, UnprocessableError
from app.models.employee import AttendanceRecord, Employee, Holiday
from app.schemas.attendance import AttendanceCreate, AttendanceMonthSummary, AttendanceOut, AttendanceToday, AttendanceUpdate, CheckInRequest, HolidayCreate, minutes
from app.services.activity import log_activity
from app.services.common import get_scoped_or_404
from app.services.leave import own_employee_id

LATE_AFTER = "10:00"  # check-ins after this (server local time, HH:MM) are "late"


def _now() -> datetime:
    """Server local time. Tests monkeypatch this."""
    return datetime.now()


# ---- check-in / check-out --------------------------------------------------

def check_in(db: Session, ctx: Ctx, data: CheckInRequest | None) -> AttendanceRecord:
    employee_id = own_employee_id(ctx)
    now = _now()
    today, clock = now.date(), now.strftime("%H:%M")
    rec = db.scalar(select(AttendanceRecord).where(AttendanceRecord.employee_id == employee_id, AttendanceRecord.attendance_date == today))
    # A manually entered "absent" placeholder with no times may still be checked in over.
    if rec is not None and (rec.check_in or rec.status != AttendanceStatus.ABSENT):
        if rec.check_in:
            raise ConflictError(f"You already checked in today at {rec.check_in}")
        raise ConflictError(f"Today is already recorded as {rec.status.value}")

    if data and data.status == "wfh":
        status = AttendanceStatus.WFH
    else:
        status = AttendanceStatus.LATE if clock > LATE_AFTER else AttendanceStatus.PRESENT
    if rec is None:
        rec = AttendanceRecord(company_id=ctx.require_company(), employee_id=employee_id, attendance_date=today)
        db.add(rec)
    rec.check_in, rec.status = clock, status
    if data and data.notes:
        rec.notes = data.notes
    db.flush()
    log_activity(db, ctx, "checked_in", "attendance", rec.id, f"Checked in at {clock} ({status.value})")
    db.commit()
    return rec


def check_out(db: Session, ctx: Ctx) -> AttendanceRecord:
    employee_id = own_employee_id(ctx)
    now = _now()
    clock = now.strftime("%H:%M")
    rec = db.scalar(select(AttendanceRecord).where(AttendanceRecord.employee_id == employee_id, AttendanceRecord.attendance_date == now.date()))
    if rec is None or not rec.check_in:
        raise ConflictError("You have not checked in today")
    if rec.check_out:
        raise ConflictError(f"You already checked out today at {rec.check_out}")
    if clock < rec.check_in:
        raise ConflictError("Check-out cannot be before check-in")
    rec.check_out = clock
    log_activity(db, ctx, "checked_out", "attendance", rec.id, f"Checked out at {clock}")
    db.commit()
    return rec


# ---- queries ---------------------------------------------------------------

def list_query(
    ctx: Ctx,
    *,
    employee_id: int | None,
    on_date: date | None,
    date_from: date | None,
    date_to: date | None,
    status: AttendanceStatus | None,
    department_id: int | None,
) -> Select:
    if not (ctx.can("view_attendance") or ctx.can("mark_attendance")):
        raise ForbiddenError()
    stmt = ctx.scope(select(AttendanceRecord), AttendanceRecord).join(Employee, Employee.id == AttendanceRecord.employee_id)
    if not ctx.can("view_attendance"):  # everyone else only sees their own days
        stmt = stmt.where(AttendanceRecord.employee_id == (ctx.employee_id or 0))
    if employee_id:
        stmt = stmt.where(AttendanceRecord.employee_id == employee_id)
    if on_date:
        stmt = stmt.where(AttendanceRecord.attendance_date == on_date)
    if date_from:
        stmt = stmt.where(AttendanceRecord.attendance_date >= date_from)
    if date_to:
        stmt = stmt.where(AttendanceRecord.attendance_date <= date_to)
    if status:
        stmt = stmt.where(AttendanceRecord.status == status)
    if department_id:
        stmt = stmt.where(Employee.department_id == department_id)
    return stmt


def today_summary(db: Session, ctx: Ctx) -> AttendanceToday:
    today = _now().date()
    records = db.scalars(
        ctx.scope(select(AttendanceRecord), AttendanceRecord).where(AttendanceRecord.attendance_date == today).order_by(AttendanceRecord.check_in, AttendanceRecord.id)
    ).all()
    counts = {s.value: 0 for s in AttendanceStatus}
    for rec in records:
        counts[rec.status.value] += 1
    active = db.scalar(
        ctx.scope(select(func.count(Employee.id)), Employee).where(Employee.employment_status.in_([EmploymentStatus.ACTIVE, EmploymentStatus.ON_LEAVE]))
    ) or 0
    return AttendanceToday(
        date=today,
        total_employees=active,
        not_marked=max(0, active - len(records)),
        counts=counts,
        records=[AttendanceOut.from_record(r) for r in records],
    )


def month_summary(db: Session, ctx: Ctx, month: str | None) -> AttendanceMonthSummary:
    employee_id = own_employee_id(ctx)
    if month is None:
        month = _now().strftime("%Y-%m")
    year, mon = int(month[:4]), int(month[5:7])
    start = date(year, mon, 1)
    end = date(year + (mon == 12), mon % 12 + 1, 1)
    rows = db.execute(
        select(AttendanceRecord.status, func.count())
        .where(AttendanceRecord.employee_id == employee_id, AttendanceRecord.attendance_date >= start, AttendanceRecord.attendance_date < end)
        .group_by(AttendanceRecord.status)
    ).all()
    counts = {s.value: 0 for s in AttendanceStatus} | {status.value: n for status, n in rows}
    return AttendanceMonthSummary(month=month, employee_id=employee_id, total_records=sum(counts.values()), **counts)


# ---- manual records --------------------------------------------------------

def _check_order(check_in: str | None, check_out: str | None) -> None:
    if check_in and check_out and minutes(check_out) < minutes(check_in):
        raise UnprocessableError("check_out cannot be before check_in", {"check_out": "Before check_in"})


def _assert_free_slot(db: Session, employee_id: int, day: date, exclude_id: int | None = None) -> None:
    stmt = select(AttendanceRecord.id).where(AttendanceRecord.employee_id == employee_id, AttendanceRecord.attendance_date == day)
    if exclude_id:
        stmt = stmt.where(AttendanceRecord.id != exclude_id)
    if db.scalar(stmt):
        raise ConflictError("An attendance record already exists for this employee on this date", {"attendance_date": "Already recorded"})


def create_record(db: Session, ctx: Ctx, data: AttendanceCreate) -> AttendanceRecord:
    emp = get_scoped_or_404(db, ctx, Employee, data.employee_id, "Employee")
    _assert_free_slot(db, emp.id, data.attendance_date)
    rec = AttendanceRecord(company_id=emp.company_id, **data.model_dump())
    db.add(rec)
    db.flush()
    log_activity(db, ctx, "created", "attendance", rec.id, f"Recorded {rec.status.value} for {emp.user.name} on {rec.attendance_date}")
    db.commit()
    return rec


def get_record(db: Session, ctx: Ctx, record_id: int) -> AttendanceRecord:
    return get_scoped_or_404(db, ctx, AttendanceRecord, record_id, "Attendance record")


def update_record(db: Session, ctx: Ctx, record_id: int, data: AttendanceUpdate) -> AttendanceRecord:
    rec = get_record(db, ctx, record_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(rec, field, value)
    _check_order(rec.check_in, rec.check_out)
    log_activity(db, ctx, "updated", "attendance", rec.id, f"Updated attendance of {rec.employee.user.name} on {rec.attendance_date}")
    db.commit()
    return rec


def delete_record(db: Session, ctx: Ctx, record_id: int) -> None:
    rec = get_record(db, ctx, record_id)
    label = f"attendance of {rec.employee.user.name} on {rec.attendance_date}"
    db.delete(rec)
    log_activity(db, ctx, "deleted", "attendance", record_id, f"Deleted {label}")
    db.commit()


# ---- holidays --------------------------------------------------------------

def list_holidays(db: Session, ctx: Ctx, year: int) -> list[Holiday]:
    if ctx.is_client:
        raise ForbiddenError()
    stmt = ctx.scope(select(Holiday), Holiday).where(Holiday.holiday_date.between(date(year, 1, 1), date(year, 12, 31)))
    return list(db.scalars(stmt.order_by(Holiday.holiday_date)))


def create_holiday(db: Session, ctx: Ctx, data: HolidayCreate) -> Holiday:
    company_id = ctx.require_company()
    if db.scalar(select(Holiday.id).where(Holiday.company_id == company_id, Holiday.holiday_date == data.holiday_date)):
        raise ConflictError("A holiday is already defined on this date", {"holiday_date": "Already exists"})
    holiday = Holiday(company_id=company_id, **data.model_dump())
    db.add(holiday)
    db.flush()
    log_activity(db, ctx, "created", "holiday", holiday.id, f"Added holiday {holiday.name} on {holiday.holiday_date}")
    db.commit()
    return holiday


def delete_holiday(db: Session, ctx: Ctx, holiday_id: int) -> None:
    holiday = get_scoped_or_404(db, ctx, Holiday, holiday_id, "Holiday")
    label = f"{holiday.name} on {holiday.holiday_date}"
    db.delete(holiday)
    log_activity(db, ctx, "deleted", "holiday", holiday_id, f"Removed holiday {label}")
    db.commit()
