from sqlalchemy import Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import CompanyStatus
from app.database.base import Base, TimestampMixin, enum_type


class Company(Base, TimestampMixin):
    """A tenant / workspace. Every business record hangs off one company."""

    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    slug: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    industry: Mapped[str | None] = mapped_column(String(100))
    address: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(255))
    website: Mapped[str | None] = mapped_column(String(255))
    gstin: Mapped[str | None] = mapped_column(String(30))
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata", nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    fiscal_year_start: Mapped[str] = mapped_column(String(12), default="april", nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[CompanyStatus] = mapped_column(enum_type(CompanyStatus), default=CompanyStatus.ACTIVE, nullable=False)

    __table_args__ = (Index("ix_companies_status", "status"),)
