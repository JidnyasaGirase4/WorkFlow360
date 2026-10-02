from sqlalchemy import ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import GenericStatus
from app.database.base import Base, TimestampMixin, enum_type


class Department(Base, TimestampMixin):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[GenericStatus] = mapped_column(enum_type(GenericStatus), default=GenericStatus.ACTIVE, nullable=False)

    __table_args__ = (UniqueConstraint("company_id", "name", name="uq_departments_company_name"),)
