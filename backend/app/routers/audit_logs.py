from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app.core.deps import DbSession, Needs
from app.models.activity import ActivityLog
from app.schemas.audit import AuditLogOut
from app.services import audit as service
from app.utils.pagination import Pagination, Sorting, apply_sort
from app.utils.responses import ERROR_RESPONSES, Envelope, Page, ok

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})

SORT_FIELDS = {"id": ActivityLog.id, "created_at": ActivityLog.created_at, "action": ActivityLog.action, "entity_type": ActivityLog.entity_type}


@router.get(
    "",
    response_model=Page[AuditLogOut],
    summary="List audit log entries",
    description="Read-only trail, newest first. Company admins see their own company; a super admin sees every company "
    "(narrow with `?company_id=`). There is no way to edit or delete entries through the API.",
)
def list_audit_logs(
    ctx: Needs("view_audit_logs"),
    db: DbSession,
    pagination: Pagination,
    sorting: Sorting,
    user_id: int | None = None,
    entity_type: Annotated[str | None, Query(description="e.g. user, company, role, client")] = None,
    action: Annotated[str | None, Query(description="e.g. created, updated, status_changed, permission_change")] = None,
    date_from: Annotated[date | None, Query(description="Inclusive, YYYY-MM-DD")] = None,
    date_to: Annotated[date | None, Query(description="Inclusive, YYYY-MM-DD")] = None,
    search: Annotated[str | None, Query(description="Matches the description")] = None,
):
    stmt = service.list_query(ctx, user_id=user_id, entity_type=entity_type, action=action, date_from=date_from, date_to=date_to, search=search)
    stmt = apply_sort(stmt, sorting, SORT_FIELDS, "created_at")
    return service.list_logs(db, stmt, pagination)


@router.get("/{log_id}", response_model=Envelope[AuditLogOut], summary="Get one audit log entry", responses={404: ERROR_RESPONSES[404]})
def get_audit_log(log_id: int, ctx: Needs("view_audit_logs"), db: DbSession):
    return ok(service.get_log(db, ctx, log_id))
