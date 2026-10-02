from typing import Annotated

from fastapi import APIRouter, Query

from app.core.deps import CurrentCtx, DbSession
from app.core.enums import NotificationType
from app.models.notification import Notification
from app.schemas.notification import CountOut, NotificationOut
from app.services import notification_center as service
from app.utils.pagination import Pagination, Sorting, apply_sort, paginate
from app.utils.responses import ERROR_RESPONSES, Envelope, Page, ok

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
    responses={401: ERROR_RESPONSES[401]},
)

SORT_FIELDS = {"id": Notification.id, "created_at": Notification.created_at}


# Fixed paths (/unread-count, /read-all) are declared before the /{id} routes.
@router.get(
    "",
    response_model=Page[NotificationOut],
    summary="List my notifications",
    description="Only the caller's own notifications, newest first.",
)
def list_notifications(
    ctx: CurrentCtx,
    db: DbSession,
    pagination: Pagination,
    sorting: Sorting,
    is_read: bool | None = None,
    type_: Annotated[NotificationType | None, Query(alias="type")] = None,
):
    stmt = apply_sort(service.list_query(ctx, is_read=is_read, type_=type_), sorting, SORT_FIELDS, "created_at")
    return paginate(db, stmt, pagination, NotificationOut.model_validate)


@router.get("/unread-count", response_model=Envelope[CountOut], summary="Number of my unread notifications")
def unread_count(ctx: CurrentCtx, db: DbSession):
    return ok({"count": service.unread_count(db, ctx)})


@router.patch(
    "/read-all",
    response_model=Envelope[CountOut],
    summary="Mark all my notifications as read",
    description="Returns how many notifications were changed.",
)
def read_all(ctx: CurrentCtx, db: DbSession):
    return ok({"count": service.mark_all_read(db, ctx)}, "All notifications marked as read")


@router.patch(
    "/{notification_id}/read",
    response_model=Envelope[NotificationOut],
    summary="Mark one notification as read",
    responses={404: ERROR_RESPONSES[404]},
)
def read_one(notification_id: int, ctx: CurrentCtx, db: DbSession):
    return ok(service.mark_read(db, ctx, notification_id), "Notification marked as read")


@router.delete(
    "/{notification_id}",
    response_model=Envelope[None],
    summary="Delete one of my notifications",
    responses={404: ERROR_RESPONSES[404]},
)
def delete_notification(notification_id: int, ctx: CurrentCtx, db: DbSession):
    service.delete(db, ctx, notification_id)
    return ok(None, "Notification deleted successfully")
