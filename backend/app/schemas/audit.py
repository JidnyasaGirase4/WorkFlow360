from datetime import datetime

from app.schemas.common import ORMModel


class AuditLogOut(ORMModel):
    id: int
    user_id: int | None
    user_name: str | None  # None for system events or a since-deleted user
    company_id: int | None
    action: str
    entity_type: str
    entity_id: int | None
    description: str | None
    ip_address: str | None
    created_at: datetime
