from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import MilestoneStatus
from app.database.base import Base, TimestampMixin, enum_type


class Milestone(Base, TimestampMixin):
    __tablename__ = "milestones"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[MilestoneStatus] = mapped_column(enum_type(MilestoneStatus), default=MilestoneStatus.PENDING, nullable=False)
    progress: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)

    __table_args__ = (
        CheckConstraint("progress BETWEEN 0 AND 100", name="ck_milestones_progress"),
        Index("ix_milestones_project_id", "project_id"),
    )
