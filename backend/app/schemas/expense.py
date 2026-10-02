from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import Field, StringConstraints, model_validator

from app.core.enums import ExpenseCategory
from app.schemas.common import LongText, ORMModel, RequestModel

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
ExpenseAmount = Annotated[Decimal, Field(gt=0, max_digits=14, decimal_places=2)]


class ExpenseCreate(RequestModel):
    title: Title
    category: ExpenseCategory = ExpenseCategory.OTHER
    amount: ExpenseAmount
    expense_date: date
    employee_id: int | None = Field(None, description="Employee who paid / incurred it (same company)")
    project_id: int | None = None
    description: LongText | None = None


class ExpenseUpdate(RequestModel):
    title: Title | None = None
    category: ExpenseCategory | None = None
    amount: ExpenseAmount | None = None
    expense_date: date | None = None
    employee_id: int | None = None
    project_id: int | None = None
    description: LongText | None = None

    @model_validator(mode="after")
    def _not_null(self):
        for field in ("title", "category", "amount", "expense_date"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class ExpenseOut(ORMModel):
    id: int
    company_id: int
    title: str
    category: ExpenseCategory
    amount: Decimal
    expense_date: date
    employee_id: int | None
    employee_name: str | None
    project_id: int | None
    project_name: str | None
    description: str | None
    has_attachment: bool
    created_by: int | None
    created_at: datetime
    updated_at: datetime


class CategoryTotal(ORMModel):
    category: ExpenseCategory
    total: Decimal
    count: int


class MonthTotal(ORMModel):
    month: str  # YYYY-MM
    total: Decimal
    count: int


class ExpenseSummary(ORMModel):
    date_from: date | None
    date_to: date | None
    total_amount: Decimal
    count: int
    by_category: list[CategoryTotal]
    by_month: list[MonthTotal]
