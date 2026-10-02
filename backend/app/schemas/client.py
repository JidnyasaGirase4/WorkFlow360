from datetime import datetime
from decimal import Decimal

from pydantic import EmailStr, HttpUrl, field_validator

from app.core.enums import ClientStatus
from app.schemas.common import LongText, Name, ORMModel, Phone, RequestModel, ShortText


class ContactCreate(RequestModel):
    name: Name
    email: EmailStr | None = None
    phone: Phone | None = None
    designation: str | None = None
    is_primary: bool = False


class ContactUpdate(RequestModel):
    name: Name | None = None
    email: EmailStr | None = None
    phone: Phone | None = None
    designation: str | None = None
    is_primary: bool | None = None


class ContactOut(ORMModel):
    id: int
    client_id: int
    name: str
    email: str | None
    phone: str | None
    designation: str | None
    is_primary: bool
    created_at: datetime
    updated_at: datetime


class _ClientFields(RequestModel):
    company_name: ShortText
    contact_name: Name | None = None
    email: EmailStr | None = None
    phone: Phone | None = None
    website: str | None = None
    industry: str | None = None
    address: LongText | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    gstin: str | None = None
    status: ClientStatus = ClientStatus.ACTIVE

    @field_validator("website")
    @classmethod
    def _website(cls, v):
        if v:
            HttpUrl(v if "://" in v else f"https://{v}")  # raises on garbage
        return v


class ClientCreate(_ClientFields):
    contacts: list[ContactCreate] = []


class ClientUpdate(RequestModel):
    company_name: ShortText | None = None
    contact_name: Name | None = None
    email: EmailStr | None = None
    phone: Phone | None = None
    website: str | None = None
    industry: str | None = None
    address: LongText | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    gstin: str | None = None
    status: ClientStatus | None = None


class ClientOut(ORMModel):
    id: int
    company_id: int
    company_name: str
    contact_name: str | None
    email: str | None
    phone: str | None
    website: str | None
    industry: str | None
    address: str | None
    city: str | None
    state: str | None
    country: str | None
    gstin: str | None
    status: ClientStatus
    created_by: int | None
    created_at: datetime
    updated_at: datetime


class ClientStats(ORMModel):
    projects: int
    active_projects: int
    total_billed: Decimal
    total_paid: Decimal
    outstanding: Decimal
    open_tickets: int


class ClientDetail(ClientOut):
    contacts: list[ContactOut]
    stats: ClientStats
