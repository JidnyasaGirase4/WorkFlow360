from pydantic import EmailStr, model_validator

from app.schemas.common import Name, ORMModel, Phone, RequestModel
from app.schemas.user import UserOut, validate_new_password


class PasswordConfirmMixin(RequestModel):
    """Enforces password strength and that both password fields match."""

    @model_validator(mode="after")
    def _passwords(self):
        password = getattr(self, "new_password", None) or getattr(self, "password", None)
        validate_new_password(password)
        if password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class RegisterRequest(PasswordConfirmMixin):
    """Creates a new company workspace and its first admin."""

    name: Name
    email: EmailStr
    phone: Phone | None = None
    company_name: Name
    password: str
    confirm_password: str


class LoginRequest(RequestModel):
    email: EmailStr
    password: str


class RefreshRequest(RequestModel):
    refresh_token: str


class LogoutRequest(RequestModel):
    refresh_token: str | None = None


class ForgotPasswordRequest(RequestModel):
    email: EmailStr


class ResetPasswordRequest(PasswordConfirmMixin):
    token: str
    new_password: str
    confirm_password: str


class ChangePasswordRequest(PasswordConfirmMixin):
    current_password: str
    new_password: str
    confirm_password: str

    @model_validator(mode="after")
    def _differs(self):
        if self.current_password == self.new_password:
            raise ValueError("New password must be different from the current password")
        return self


class VerifyEmailRequest(RequestModel):
    token: str


class TokenPair(ORMModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # access token lifetime in seconds


class AuthResult(TokenPair):
    user: UserOut


class CompanyBrief(ORMModel):
    id: int
    name: str
    slug: str
    currency: str
    timezone: str


class MeOut(ORMModel):
    user: UserOut
    company: CompanyBrief | None
    employee_id: int | None
    permissions: list[str]
