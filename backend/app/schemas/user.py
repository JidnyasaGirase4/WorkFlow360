from datetime import datetime
from typing import Annotated

from pydantic import BeforeValidator, EmailStr, model_validator

from app.core.enums import RoleName, UserStatus
from app.core.security import password_problems
from app.schemas.common import Name, ORMModel, Phone, RequestModel


def _role_name(value):
    return value.name if hasattr(value, "name") else value


RoleField = Annotated[str, BeforeValidator(_role_name)]


def validate_new_password(password: str) -> str:
    problems = password_problems(password)
    if problems:
        raise ValueError("Password needs " + ", ".join(problems))
    if len(password.encode()) > 72:
        raise ValueError("Password must be at most 72 bytes")
    return password


class UserOut(ORMModel):
    id: int
    company_id: int | None
    client_id: int | None
    name: str
    email: str
    phone: str | None
    role: RoleField
    status: UserStatus
    profile_image: str | None
    last_login: datetime | None
    email_verified: bool
    created_at: datetime
    updated_at: datetime


class UserCreate(RequestModel):
    name: Name
    email: EmailStr
    phone: Phone | None = None
    password: str
    role: RoleName
    client_id: int | None = None  # required when role == client

    @model_validator(mode="after")
    def _check(self):
        validate_new_password(self.password)
        return self


class UserUpdate(RequestModel):
    name: Name | None = None
    email: EmailStr | None = None
    phone: Phone | None = None
    profile_image: str | None = None
    role: RoleName | None = None


class UserStatusUpdate(RequestModel):
    status: UserStatus
