"""Create in-app notifications. Call inside the transaction of the triggering change."""
from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.core.enums import NotificationType
from app.models.notification import Notification


def notify(
    db: Session,
    user_ids: Iterable[int | None],
    title: str,
    message: str,
    type: NotificationType,
    reference_type: str | None = None,
    reference_id: int | None = None,
    *,
    exclude_user_id: int | None = None,
) -> int:
    """Adds one notification per distinct recipient (skipping `exclude_user_id`, usually the actor). Returns count."""
    recipients = {uid for uid in user_ids if uid is not None and uid != exclude_user_id}
    for uid in recipients:
        db.add(Notification(user_id=uid, title=title, message=message, type=type, reference_type=reference_type, reference_id=reference_id))
    return len(recipients)
