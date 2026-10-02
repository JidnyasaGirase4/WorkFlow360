from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import ExpenseCategory
from app.database.base import Base, TimestampMixin, enum_type

if TYPE_CHECKING:
    from app.models.employee import Employee
    from app.models.project import Project


class Expense(Base, TimestampMixin):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[ExpenseCategory] = mapped_column(enum_type(ExpenseCategory), default=ExpenseCategory.OTHER, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    employee_id: Mapped[int | None] = mapped_column(ForeignKey("employees.id", ondelete="SET NULL"))
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"))
    description: Mapped[str | None] = mapped_column(Text)
    attachment: Mapped[str | None] = mapped_column(String(500))  # safe path relative to UPLOAD_DIR
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    employee: Mapped["Employee | None"] = relationship(viewonly=True)
    project: Mapped["Project | None"] = relationship(viewonly=True)

    @property
    def employee_name(self) -> str | None:
        return self.employee.user.name if self.employee else None

    @property
    def project_name(self) -> str | None:
        return self.project.name if self.project else None

    @property
    def has_attachment(self) -> bool:
        return bool(self.attachment)

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_expenses_amount_positive"),
        Index("ix_expenses_company_date", "company_id", "expense_date"),
        Index("ix_expenses_project_id", "project_id"),
        Index("ix_expenses_category", "category"),
    )
