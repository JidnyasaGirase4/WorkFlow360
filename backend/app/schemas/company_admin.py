import re
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, EmailStr, HttpUrl, StringConstraints, field_validator, model_validator

from app.core.enums import CompanyStatus
from app.schemas.common import LongText, Name, ORMModel, Phone, RequestModel, ShortText
from app.schemas.user import UserOut, validate_new_password

CURRENCIES = ("USD", "INR", "EUR", "GBP", "AED", "SGD", "AUD")
MONTHS = ("january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december")

_TZ_RE = re.compile(r"^(UTC|[A-Za-z]+(/[A-Za-z0-9_+\-]+){1,2})$")  # IANA style, e.g. Asia/Kolkata
_GSTIN_RE = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")


def _currency(value: str) -> str:
    value = value.strip().upper()
    if value not in CURRENCIES:
        raise ValueError(f"Currency must be one of {', '.join(CURRENCIES)}")
    return value


def _month(value: str) -> str:
    value = value.strip().lower()
    if value not in MONTHS:
        raise ValueError("fiscal_year_start must be a month name, january to december")
    return value


def _timezone(value: str) -> str:
    if not _TZ_RE.match(value.strip()):
        raise ValueError("Timezone must be an IANA name such as Asia/Kolkata")
    return value.strip()


def _gstin(value: str) -> str:
    value = value.strip().upper()
    if not _GSTIN_RE.match(value):
        raise ValueError("Enter a valid 15-character GSTIN")
    return value


Currency = Annotated[str, AfterValidator(_currency)]
Month = Annotated[str, AfterValidator(_month)]
Timezone = Annotated[str, AfterValidator(_timezone)]
Gstin = Annotated[str, AfterValidator(_gstin)]
Slug = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=160)]


class _CompanyFields(RequestModel):
    industry: ShortText | None = None
    address: LongText | None = None
    phone: Phone | None = None
    email: EmailStr | None = None
    website: str | None = None
    gstin: Gstin | None = None
    timezone: Timezone = "Asia/Kolkata"
    currency: Currency = "INR"
    fiscal_year_start: Month = "april"
    logo_url: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None

    @model_validator(mode="before")
    @classmethod
    def _blank_to_none(cls, data):
        # A cleared form input arrives as "" -- store it as NULL rather than failing format checks.
        if isinstance(data, dict):
            optional = ("industry", "address", "phone", "email", "website", "gstin", "logo_url")
            return {k: (None if k in optional and isinstance(v, str) and not v.strip() else v) for k, v in data.items()}
        return data

    @field_validator("website")
    @classmethod
    def _website(cls, v):
        if v:
            HttpUrl(v if "://" in v else f"https://{v}")  # raises on garbage
        return v


class CompanyAdminInit(RequestModel):
    """The first company_admin created together with the company."""

    name: Name
    email: EmailStr
    phone: Phone | None = None
    password: str

    @model_validator(mode="after")
    def _password(self):
        validate_new_password(self.password)
        return self


class CompanyCreate(_CompanyFields):
    name: ShortText
    slug: Slug | None = None  # generated from the name when omitted
    admin: CompanyAdminInit


class CompanyUpdate(_CompanyFields):
    """Used by PUT /companies/me and PUT /companies/{id}: send only the fields to change."""

    name: ShortText | None = None
    timezone: Timezone | None = None
    currency: Currency | None = None
    fiscal_year_start: Month | None = None

    @model_validator(mode="after")
    def _required_columns(self):
        for field in ("name", "timezone", "currency", "fiscal_year_start"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class CompanyStatusUpdate(RequestModel):
    status: CompanyStatus


class CompanyOut(ORMModel):
    id: int
    name: str
    slug: str
    industry: str | None
    address: str | None
    phone: str | None
    email: str | None
    website: str | None
    gstin: str | None
    timezone: str
    currency: str
    fiscal_year_start: str
    logo_url: str | None
    status: CompanyStatus
    created_at: datetime
    updated_at: datetime


class CompanyListItem(CompanyOut):
    user_count: int


class CompanyCreated(CompanyOut):
    admin: UserOut
