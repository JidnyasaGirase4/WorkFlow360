from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import Field, StringConstraints, model_validator

from app.core.enums import InvoiceStatus
from app.schemas.common import LongText, ORMModel, RequestModel
from app.schemas.payment import PaymentOut

Quantity = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]
Amount = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]
TaxRate = Annotated[Decimal, Field(ge=0, le=100, max_digits=5, decimal_places=2)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
PaymentTerms = Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)]


class LineItemIn(RequestModel):
    """One billable line. Totals are never accepted: the server computes them."""

    description: Description
    quantity: Quantity
    unit_price: Amount
    tax_rate: TaxRate = Decimal("0")
    discount: Amount = Field(Decimal("0"), description="Absolute amount taken off this line (not a percentage); cannot exceed quantity x unit_price")


class LineItemOut(ORMModel):
    id: int
    description: str
    quantity: Decimal
    unit_price: Decimal
    tax_rate: Decimal
    discount: Decimal
    total: Decimal


class InvoiceCreate(RequestModel):
    client_id: int
    project_id: int | None = Field(None, description="Must belong to the same client")
    issue_date: date
    due_date: date
    payment_terms: PaymentTerms | None = None
    notes: LongText | None = None
    additional_discount: Amount = Field(Decimal("0"), description="Invoice-level discount amount, on top of the line discounts")
    items: list[LineItemIn] = Field(min_length=1, max_length=200)

    @model_validator(mode="after")
    def _dates(self):
        if self.due_date < self.issue_date:
            raise ValueError("due_date cannot be before issue_date")
        return self


class InvoiceUpdate(RequestModel):
    """Only draft invoices (or sent ones with no payments) can be edited. `items`, when sent, replaces all lines."""

    client_id: int | None = None
    project_id: int | None = None
    issue_date: date | None = None
    due_date: date | None = None
    payment_terms: PaymentTerms | None = None
    notes: LongText | None = None
    additional_discount: Amount | None = None
    items: list[LineItemIn] | None = Field(None, min_length=1, max_length=200)

    @model_validator(mode="after")
    def _not_null(self):
        for field in ("client_id", "issue_date", "due_date", "additional_discount", "items"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class ActivityEntry(ORMModel):
    id: int
    actor: str | None
    action: str
    description: str | None
    created_at: datetime


class InvoiceOut(ORMModel):
    id: int
    company_id: int
    invoice_number: str
    client_id: int
    client_name: str
    project_id: int | None
    project_name: str | None
    quotation_id: int | None
    issue_date: date
    due_date: date
    subtotal: Decimal
    discount_amount: Decimal
    additional_discount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    paid_amount: Decimal
    balance_amount: Decimal
    status: InvoiceStatus
    payment_terms: str | None
    notes: str | None
    created_by: int | None
    payments_count: int
    created_at: datetime
    updated_at: datetime


class InvoiceDetail(InvoiceOut):
    items: list[LineItemOut]
    payments: list[PaymentOut]
    activity: list[ActivityEntry] = []  # internal users only
