from datetime import datetime

from app.core.enums import NotificationType
from app.schemas.common import ORMModel


class NotificationOut(ORMModel):
    id: int
    user_id: int
    title: str
    message: str
    type: NotificationType
    reference_type: str | None
    reference_id: int | None
    is_read: bool
    created_at: datetime


class CountOut(ORMModel):
    count: int
