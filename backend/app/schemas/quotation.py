from datetime import date, datetime
from decimal import Decimal

from pydantic import Field, model_validator

from app.core.enums import QuotationStatus
from app.schemas.common import LongText, ORMModel, RequestModel
from app.schemas.invoice import Amount, LineItemIn, LineItemOut


class QuotationCreate(RequestModel):
    client_id: int
    project_id: int | None = Field(None, description="Must belong to the same client")
    issue_date: date
    valid_until: date | None = None
    notes: LongText | None = None
    additional_discount: Amount = Field(Decimal("0"), description="Quotation-level discount amount, on top of the line discounts")
    items: list[LineItemIn] = Field(min_length=1, max_length=200)

    @model_validator(mode="after")
    def _dates(self):
        if self.valid_until and self.valid_until < self.issue_date:
            raise ValueError("valid_until cannot be before issue_date")
        return self


class QuotationUpdate(RequestModel):
    """Draft or sent quotations only. `items`, when sent, replaces all lines."""

    client_id: int | None = None
    project_id: int | None = None
    issue_date: date | None = None
    valid_until: date | None = None
    notes: LongText | None = None
    additional_discount: Amount | None = None
    items: list[LineItemIn] | None = Field(None, min_length=1, max_length=200)

    @model_validator(mode="after")
    def _not_null(self):
        for field in ("client_id", "issue_date", "additional_discount", "items"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class QuotationOut(ORMModel):
    id: int
    company_id: int
    quotation_number: str
    client_id: int
    client_name: str
    project_id: int | None
    project_name: str | None
    issue_date: date
    valid_until: date | None
    subtotal: Decimal
    discount_amount: Decimal
    additional_discount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    status: QuotationStatus
    notes: str | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime


class QuotationDetail(QuotationOut):
    items: list[LineItemOut]
    invoice_id: int | None = Field(None, description="The invoice this quotation was converted into, if any")
    invoice_number: str | None = None


class ConvertResult(ORMModel):
    quotation_id: int
    invoice_id: int
    invoice_number: str
