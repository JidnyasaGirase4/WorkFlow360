"""Shared Pydantic building blocks."""
import re
from typing import Annotated

import email_validator
from pydantic import AfterValidator, BaseModel, ConfigDict, StringConstraints

from app.core.config import get_settings

# Demo accounts use @workflow360.local (a reserved domain). Allow such domains outside production only.
if not get_settings().is_production:
    email_validator.TEST_ENVIRONMENT = True
    if "local" in email_validator.SPECIAL_USE_DOMAIN_NAMES:
        email_validator.SPECIAL_USE_DOMAIN_NAMES.remove("local")

_PHONE_RE = re.compile(r"^\+?[0-9][0-9 ()\-]{6,19}$")


def _validate_phone(value: str) -> str:
    value = value.strip()
    if not _PHONE_RE.match(value):
        raise ValueError("Enter a valid phone number (digits, spaces, dashes, optional leading +)")
    return value


Phone = Annotated[str, AfterValidator(_validate_phone)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)]


class ORMModel(BaseModel):
    """Response models: readable straight from SQLAlchemy objects."""

    model_config = ConfigDict(from_attributes=True)


class RequestModel(BaseModel):
    """Request models: trim strings and reject unknown fields so typos surface as 422."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
