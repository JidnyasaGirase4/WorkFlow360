from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import Field, StringConstraints

from app.core.enums import PaymentMethod
from app.schemas.common import LongText, ORMModel, RequestModel

Reference = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


class PaymentCreate(RequestModel):
    """Client, company and resulting balance are derived from the invoice, never supplied."""

    invoice_id: int
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2, description="Must not exceed the invoice's outstanding balance")
    payment_date: date = Field(description="Cannot be in the future")
    payment_method: PaymentMethod
    reference_number: Reference | None = None
    notes: LongText | None = None


class PaymentOut(ORMModel):
    id: int
    payment_number: str
    company_id: int
    invoice_id: int
    invoice_number: str
    client_id: int
    client_name: str
    amount: Decimal
    payment_date: date
    payment_method: PaymentMethod
    reference_number: str | None
    notes: str | None
    created_by: int | None
    created_at: datetime
