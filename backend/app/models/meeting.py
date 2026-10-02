from datetime import date, datetime, time

from sqlalchemy import Date, ForeignKey, Index, String, Text, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import MeetingStatus, MeetingType, ResponseStatus
from app.database.base import Base, TimestampMixin, enum_type


class Meeting(Base, TimestampMixin):
    __tablename__ = "meetings"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id", ondelete="SET NULL"))
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    meeting_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time | None] = mapped_column(Time)
    meeting_type: Mapped[MeetingType] = mapped_column(enum_type(MeetingType), default=MeetingType.OTHER, nullable=False)
    meeting_link: Mapped[str | None] = mapped_column(String(500))
    location: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[MeetingStatus] = mapped_column(enum_type(MeetingStatus), default=MeetingStatus.SCHEDULED, nullable=False)

    participants: Mapped[list["MeetingParticipant"]] = relationship(back_populates="meeting", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_meetings_company_date", "company_id", "meeting_date"),
        Index("ix_meetings_client_id", "client_id"),
        Index("ix_meetings_project_id", "project_id"),
    )


class MeetingParticipant(Base):
    __tablename__ = "meeting_participants"

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    response_status: Mapped[ResponseStatus] = mapped_column(enum_type(ResponseStatus), default=ResponseStatus.PENDING, nullable=False)

    meeting: Mapped[Meeting] = relationship(back_populates="participants")

    __table_args__ = (
        UniqueConstraint("meeting_id", "user_id", name="uq_meeting_participants_meeting_user"),
        Index("ix_meeting_participants_user_id", "user_id"),
    )
