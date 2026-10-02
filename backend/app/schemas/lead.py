from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import EmailStr, Field, model_validator

from app.core.enums import LeadActivityType, LeadSource, LeadStatus, Priority
from app.schemas.client import ClientOut
from app.schemas.common import LongText, Name, ORMModel, Phone, RequestModel, ShortText

Money = Annotated[Decimal, Field(ge=0, max_digits=14, decimal_places=2)]

# Columns that are NOT NULL: an explicit `null` in a PUT body must be a 422, not a database error.
_NOT_NULL = ("company_name", "contact_name", "source", "status", "priority", "estimated_value")


class LeadCreate(RequestModel):
    company_name: ShortText
    contact_name: Name
    email: EmailStr | None = None
    phone: Phone | None = None
    source: LeadSource = LeadSource.OTHER
    status: LeadStatus = LeadStatus.NEW
    priority: Priority = Priority.MEDIUM
    estimated_value: Money = Decimal("0")
    owner_id: int | None = Field(None, description="Internal user of the same company. Defaults to the caller.")
    notes: LongText | None = None
    next_followup_date: date | None = None


class LeadUpdate(RequestModel):
    company_name: ShortText | None = None
    contact_name: Name | None = None
    email: EmailStr | None = None
    phone: Phone | None = None
    source: LeadSource | None = None
    status: LeadStatus | None = None
    priority: Priority | None = None
    estimated_value: Money | None = None
    owner_id: int | None = None
    notes: LongText | None = None
    next_followup_date: date | None = None

    @model_validator(mode="after")
    def _no_null_for_required(self):
        for name in _NOT_NULL:
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class LeadOut(ORMModel):
    id: int
    company_id: int
    company_name: str
    contact_name: str
    email: str | None
    phone: str | None
    source: LeadSource
    status: LeadStatus
    priority: Priority
    estimated_value: Decimal
    owner_id: int | None
    owner_name: str | None = None
    notes: str | None
    last_contact_date: date | None
    next_followup_date: date | None
    converted_client_id: int | None
    converted_at: datetime | None
    created_at: datetime
    updated_at: datetime


class PipelineStage(ORMModel):
    status: LeadStatus
    count: int
    total_value: Decimal


class Pipeline(ORMModel):
    stages: list[PipelineStage]
    total_count: int
    total_value: Decimal


class LeadActivityCreate(RequestModel):
    activity_type: LeadActivityType
    description: Annotated[str, Field(min_length=1, max_length=5000)]
    activity_date: datetime | None = Field(None, description="When it happened (defaults to now, UTC)")
    next_followup_date: date | None = Field(None, description="Only for follow_up activities: schedules the next follow-up")


class LeadActivityOut(ORMModel):
    id: int
    lead_id: int
    user_id: int | None
    user_name: str | None = None
    activity_type: LeadActivityType
    description: str
    activity_date: datetime
    created_at: datetime


class LeadConvert(RequestModel):
    existing_client_id: int | None = Field(None, description="Link to this client instead of creating one (409 duplicate override)")


class LeadConvertResult(ORMModel):
    lead: LeadOut
    client: ClientOut
