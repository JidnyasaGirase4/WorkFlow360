"""Leave requests: applying, balances, approval workflow."""
from datetime import date, timedelta

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.deps import Ctx
from app.core.enums import AttendanceStatus, LeaveStatus, LeaveType, NotificationType, RoleName, UserStatus
from app.core.exceptions import BadRequestError, ConflictError, ForbiddenError, UnprocessableError
from app.models.employee import AttendanceRecord, Employee, LeaveRequest
from app.models.role import Permission, role_permissions
from app.models.user import User
from app.schemas.leave import LeaveCreate, LeaveOut
from app.services.activity import log_activity
from app.services.common import get_scoped_or_404
from app.services.notifications import notify
from app.utils.pagination import like_any

ENTITLEMENTS: dict[LeaveType, int] = {LeaveType.CASUAL: 12, LeaveType.SICK: 10, LeaveType.EARNED: 18}
_ADMIN_ROLES = (RoleName.COMPANY_ADMIN.value, RoleName.SUPER_ADMIN.value)


def own_employee_id(ctx: Ctx) -> int:
    if ctx.is_client:
        raise ForbiddenError()
    if ctx.employee_id is None:
        raise BadRequestError("Your account has no employee profile")
    return ctx.employee_id


def leave_out(db: Session, rec: LeaveRequest) -> LeaveOut:
    emp = rec.employee
    decider = db.get(User, rec.decided_by) if rec.decided_by else None
    return LeaveOut(
        id=rec.id,
        company_id=rec.company_id,
        employee_id=rec.employee_id,
        employee_name=emp.user.name,
        employee_code=emp.employee_code,
        department_id=emp.department_id,
        department_name=emp.department.name if emp.department else None,
        leave_type=rec.leave_type,
        start_date=rec.start_date,
        end_date=rec.end_date,
        days=float(rec.days),
        reason=rec.reason,
        status=rec.status,
        decided_by=rec.decided_by,
        decided_by_name=decider.name if decider else None,
        decided_at=rec.decided_at,
        rejection_reason=rec.rejection_reason,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


def list_query(
    ctx: Ctx,
    *,
    status: LeaveStatus | None,
    leave_type: LeaveType | None,
    employee_id: int | None,
    department_id: int | None,
    date_from: date | None,
    date_to: date | None,
    search: str | None,
) -> Select:
    if not (ctx.can("view_leave") or ctx.can("apply_leave")):
        raise ForbiddenError()
    stmt = ctx.scope(select(LeaveRequest), LeaveRequest).join(Employee, Employee.id == LeaveRequest.employee_id).join(User, User.id == Employee.user_id)
    if not ctx.can("view_leave"):  # everyone else only ever sees their own requests
        stmt = stmt.where(LeaveRequest.employee_id == (ctx.employee_id or 0))
    if status:
        stmt = stmt.where(LeaveRequest.status == status)
    if leave_type:
        stmt = stmt.where(LeaveRequest.leave_type == leave_type)
    if employee_id:
        stmt = stmt.where(LeaveRequest.employee_id == employee_id)
    if department_id:
        stmt = stmt.where(Employee.department_id == department_id)
    if date_from:  # requests overlapping the window
        stmt = stmt.where(LeaveRequest.end_date >= date_from)
    if date_to:
        stmt = stmt.where(LeaveRequest.start_date <= date_to)
    if search:
        stmt = stmt.where(like_any(search, User.name, User.email, Employee.employee_code, LeaveRequest.reason))
    return stmt


# ---- balance --------------------------------------------------------------

def compute_balance(db: Session, employee_id: int, year: int) -> dict:
    """Per type {total, used, pending, remaining}. A request counts toward the year it starts in."""
    rows = db.execute(
        select(LeaveRequest.leave_type, LeaveRequest.status, func.sum(LeaveRequest.days))
        .where(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.status.in_([LeaveStatus.APPROVED, LeaveStatus.PENDING]),
            LeaveRequest.start_date >= date(year, 1, 1),
            LeaveRequest.start_date <= date(year, 12, 31),
        )
        .group_by(LeaveRequest.leave_type, LeaveRequest.status)
    ).all()
    taken = {(leave_type, status): float(total) for leave_type, status, total in rows}
    result: dict = {"employee_id": employee_id, "year": year}
    for leave_type, total in ENTITLEMENTS.items():
        used = taken.get((leave_type, LeaveStatus.APPROVED), 0.0)
        pending = taken.get((leave_type, LeaveStatus.PENDING), 0.0)
        result[leave_type.value] = {"total": total, "used": used, "pending": pending, "remaining": max(0.0, total - used - pending)}
    return result


def balance_for(db: Session, ctx: Ctx, employee_id: int | None, year: int | None) -> dict:
    if employee_id is None or employee_id == ctx.employee_id:
        target = own_employee_id(ctx)
    else:
        if not (ctx.can("approve_leave") or ctx.can("view_leave")):
            raise ForbiddenError()
        target = get_scoped_or_404(db, ctx, Employee, employee_id, "Employee").id
    return compute_balance(db, target, year or date.today().year)


# ---- workflow -------------------------------------------------------------

def _approver_user_ids(db: Session, company_id: int) -> list[int]:
    return list(
        db.scalars(
            select(User.id)
            .join(role_permissions, role_permissions.c.role_id == User.role_id)
            .join(Permission, Permission.id == role_permissions.c.permission_id)
            .where(Permission.code == "approve_leave", User.company_id == company_id, User.status == UserStatus.ACTIVE)
        )
    )


def apply_leave(db: Session, ctx: Ctx, data: LeaveCreate) -> LeaveRequest:
    employee_id = own_employee_id(ctx)
    emp = get_scoped_or_404(db, ctx, Employee, employee_id, "Employee")
    overlap = db.scalar(
        select(LeaveRequest.id).where(
            LeaveRequest.employee_id == emp.id,
            LeaveRequest.status.in_([LeaveStatus.PENDING, LeaveStatus.APPROVED]),
            LeaveRequest.start_date <= data.end_date,
            LeaveRequest.end_date >= data.start_date,
        )
    )
    if overlap:
        raise ConflictError("You already have a pending or approved leave request overlapping these dates", {"start_date": "Overlaps an existing request"})

    days = (data.end_date - data.start_date).days + 1
    balance = compute_balance(db, emp.id, data.start_date.year)[data.leave_type.value]
    if days > balance["remaining"]:
        raise UnprocessableError(
            f"Insufficient {data.leave_type.value} leave balance: requested {days} day(s), {balance['remaining']:g} remaining of {balance['total']}",
            {"requested": days, **balance},
        )

    rec = LeaveRequest(
        company_id=emp.company_id, employee_id=emp.id, leave_type=data.leave_type,
        start_date=data.start_date, end_date=data.end_date, days=days, reason=data.reason, status=LeaveStatus.PENDING,
    )
    db.add(rec)
    db.flush()
    log_activity(db, ctx, "created", "leave_request", rec.id, f"Applied for {days} day(s) of {rec.leave_type.value} leave ({rec.start_date} to {rec.end_date})")
    notify(
        db, _approver_user_ids(db, emp.company_id), "New leave request",
        f"{emp.user.name} applied for {days} day(s) of {rec.leave_type.value} leave from {rec.start_date} to {rec.end_date}.",
        NotificationType.SYSTEM, "leave_request", rec.id, exclude_user_id=emp.user_id,
    )
    db.commit()
    return rec


def _get_decidable(db: Session, ctx: Ctx, leave_id: int) -> LeaveRequest:
    rec = get_scoped_or_404(db, ctx, LeaveRequest, leave_id, "Leave request")
    if rec.employee.user_id == ctx.user.id:
        raise ForbiddenError("You cannot approve or reject your own leave request")
    if ctx.is_manager and rec.employee.user.role.name in _ADMIN_ROLES:
        raise ForbiddenError("Managers cannot decide leave requests of administrators")
    if rec.status != LeaveStatus.PENDING:
        raise ConflictError(f"This request is already {rec.status.value}")
    return rec


def _mark_on_leave(db: Session, rec: LeaveRequest) -> int:
    existing = set(
        db.scalars(
            select(AttendanceRecord.attendance_date).where(
                AttendanceRecord.employee_id == rec.employee_id,
                AttendanceRecord.attendance_date.between(rec.start_date, rec.end_date),
            )
        )
    )
    created = 0
    day = rec.start_date
    while day <= rec.end_date:
        if day.weekday() < 5 and day not in existing:
            db.add(AttendanceRecord(company_id=rec.company_id, employee_id=rec.employee_id, attendance_date=day, status=AttendanceStatus.ON_LEAVE, notes="Approved leave"))
            created += 1
        day += timedelta(days=1)
    return created


def approve(db: Session, ctx: Ctx, leave_id: int) -> LeaveRequest:
    rec = _get_decidable(db, ctx, leave_id)
    rec.status = LeaveStatus.APPROVED
    rec.decided_by, rec.decided_at, rec.rejection_reason = ctx.user.id, date.today(), None
    _mark_on_leave(db, rec)
    name = rec.employee.user.name
    log_activity(db, ctx, "approved", "leave_request", rec.id, f"Approved {rec.leave_type.value} leave of {name} ({rec.start_date} to {rec.end_date})")
    notify(
        db, [rec.employee.user_id], "Leave request approved",
        f"Your {rec.leave_type.value} leave from {rec.start_date} to {rec.end_date} was approved by {ctx.user.name}.",
        NotificationType.SYSTEM, "leave_request", rec.id,
    )
    db.commit()
    return rec


def reject(db: Session, ctx: Ctx, leave_id: int, reason: str) -> LeaveRequest:
    rec = _get_decidable(db, ctx, leave_id)
    rec.status = LeaveStatus.REJECTED
    rec.decided_by, rec.decided_at, rec.rejection_reason = ctx.user.id, date.today(), reason
    name = rec.employee.user.name
    log_activity(db, ctx, "rejected", "leave_request", rec.id, f"Rejected {rec.leave_type.value} leave of {name} ({rec.start_date} to {rec.end_date}): {reason}")
    notify(
        db, [rec.employee.user_id], "Leave request rejected",
        f"Your {rec.leave_type.value} leave from {rec.start_date} to {rec.end_date} was rejected by {ctx.user.name}. Reason: {reason}",
        NotificationType.SYSTEM, "leave_request", rec.id,
    )
    db.commit()
    return rec


def cancel(db: Session, ctx: Ctx, leave_id: int) -> LeaveRequest:
    rec = get_scoped_or_404(db, ctx, LeaveRequest, leave_id, "Leave request")
    if rec.employee_id != ctx.employee_id:
        raise ForbiddenError("Only the applicant can cancel a leave request")
    if rec.status != LeaveStatus.PENDING:
        raise ConflictError(f"Only pending requests can be cancelled (this one is {rec.status.value})")
    rec.status = LeaveStatus.CANCELLED
    log_activity(db, ctx, "cancelled", "leave_request", rec.id, f"Cancelled {rec.leave_type.value} leave ({rec.start_date} to {rec.end_date})")
    db.commit()
    return rec
