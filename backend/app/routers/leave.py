from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.deps import CurrentCtx, DbSession, Needs
from app.core.enums import LeaveStatus, LeaveType
from app.models.employee import LeaveRequest
from app.schemas.leave import LeaveBalance, LeaveCreate, LeaveOut, LeaveReject
from app.services import leave as service
from app.utils.pagination import Pagination, Sorting, apply_sort, paginate
from app.utils.responses import ERROR_RESPONSES, Envelope, Page, ok

router = APIRouter(prefix="/leave", tags=["Leave"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})

SORT_FIELDS = {
    "id": LeaveRequest.id,
    "start_date": LeaveRequest.start_date,
    "end_date": LeaveRequest.end_date,
    "days": LeaveRequest.days,
    "status": LeaveRequest.status,
    "created_at": LeaveRequest.created_at,
}


@router.post(
    "",
    response_model=Envelope[LeaveOut],
    status_code=status.HTTP_201_CREATED,
    summary="Apply for leave",
    description="Applies for the caller. `days` is calendar days, inclusive. Overlap with own pending/approved leave is 409; "
    "exceeding the yearly balance (casual 12, sick 10, earned 18) is 422. Approvers are notified.",
    responses={409: ERROR_RESPONSES[422] | {"description": "Overlapping request"}, 422: ERROR_RESPONSES[422]},
)
def apply_leave(body: LeaveCreate, ctx: Needs("apply_leave"), db: DbSession):
    return ok(service.leave_out(db, service.apply_leave(db, ctx, body)), "Leave request submitted")


@router.get(
    "",
    response_model=Page[LeaveOut],
    summary="List leave requests",
    description="Callers with `view_leave` see the whole company; everyone else sees only their own requests.",
)
def list_leave(
    ctx: CurrentCtx,
    db: DbSession,
    pagination: Pagination,
    sorting: Sorting,
    status_: Annotated[LeaveStatus | None, Query(alias="status")] = None,
    type_: Annotated[LeaveType | None, Query(alias="type")] = None,
    employee_id: int | None = None,
    department_id: int | None = None,
    date_from: Annotated[date | None, Query(description="Requests ending on/after this date")] = None,
    date_to: Annotated[date | None, Query(description="Requests starting on/before this date")] = None,
    search: Annotated[str | None, Query(description="Matches employee name, email, code and reason")] = None,
):
    stmt = service.list_query(
        ctx, status=status_, leave_type=type_, employee_id=employee_id, department_id=department_id, date_from=date_from, date_to=date_to, search=search
    )
    stmt = apply_sort(stmt, sorting, SORT_FIELDS, "created_at")
    return paginate(db, stmt, pagination, lambda rec: service.leave_out(db, rec))


@router.get(
    "/balance",
    response_model=Envelope[LeaveBalance],
    summary="Leave balance",
    description="Per type `{total, used, pending, remaining}` for the year. Approvers may pass `employee_id`.",
    responses={404: ERROR_RESPONSES[404]},
)
def leave_balance(ctx: CurrentCtx, db: DbSession, employee_id: int | None = None, year: Annotated[int | None, Query(ge=2000, le=2100)] = None):
    return ok(service.balance_for(db, ctx, employee_id, year))


@router.patch(
    "/{leave_id}/approve",
    response_model=Envelope[LeaveOut],
    summary="Approve a leave request",
    description="Request must be pending (409). You can never decide your own request (403). Creates `on_leave` attendance for weekdays without a record.",
    responses={404: ERROR_RESPONSES[404]},
)
def approve_leave(leave_id: int, ctx: Needs("approve_leave"), db: DbSession):
    return ok(service.leave_out(db, service.approve(db, ctx, leave_id)), "Leave request approved")


@router.patch(
    "/{leave_id}/reject",
    response_model=Envelope[LeaveOut],
    summary="Reject a leave request",
    description="A reason is required.",
    responses={404: ERROR_RESPONSES[404]},
)
def reject_leave(leave_id: int, body: LeaveReject, ctx: Needs("approve_leave"), db: DbSession):
    return ok(service.leave_out(db, service.reject(db, ctx, leave_id, body.reason)), "Leave request rejected")


@router.patch(
    "/{leave_id}/cancel",
    response_model=Envelope[LeaveOut],
    summary="Cancel own pending leave request",
    responses={404: ERROR_RESPONSES[404]},
)
def cancel_leave(leave_id: int, ctx: Needs("apply_leave"), db: DbSession):
    return ok(service.leave_out(db, service.cancel(db, ctx, leave_id)), "Leave request cancelled")
