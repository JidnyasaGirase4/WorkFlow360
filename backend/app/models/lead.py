from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import LeadActivityType, LeadSource, LeadStatus, Priority
from app.database.base import Base, TimestampMixin, enum_type, utcnow


class Lead(Base, TimestampMixin):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False)
    company_name: Mapped[str] = mapped_column(String(150), nullable=False)
    contact_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(30))
    source: Mapped[LeadSource] = mapped_column(enum_type(LeadSource), default=LeadSource.OTHER, nullable=False)
    status: Mapped[LeadStatus] = mapped_column(enum_type(LeadStatus), default=LeadStatus.NEW, nullable=False)
    priority: Mapped[Priority] = mapped_column(enum_type(Priority), default=Priority.MEDIUM, nullable=False)
    estimated_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    notes: Mapped[str | None] = mapped_column(Text)
    last_contact_date: Mapped[date | None] = mapped_column(Date)
    next_followup_date: Mapped[date | None] = mapped_column(Date)
    # Set once converted; guards against creating the same client twice.
    converted_client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id", ondelete="SET NULL"))
    converted_at: Mapped[datetime | None] = mapped_column(DateTime)

    __table_args__ = (
        Index("ix_leads_company_status", "company_id", "status"),
        Index("ix_leads_owner_id", "owner_id"),
        Index("ix_leads_next_followup", "next_followup_date"),
    )


class LeadActivity(Base):
    __tablename__ = "lead_activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    activity_type: Mapped[LeadActivityType] = mapped_column(enum_type(LeadActivityType), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    activity_date: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (Index("ix_lead_activities_lead_id", "lead_id"),)
