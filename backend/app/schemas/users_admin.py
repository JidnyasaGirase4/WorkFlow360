"""Admin-side user management payloads (the base shapes live in app.schemas.user)."""
from pydantic import model_validator

from app.core.enums import RoleName
from app.schemas.user import UserCreate, UserUpdate


class AdminUserCreate(UserCreate):
    """`client_id` is required for (and only valid with) the `client` role."""

    @model_validator(mode="after")
    def _client_link(self):
        if self.role == RoleName.CLIENT and self.client_id is None:
            raise ValueError("client_id is required for the client role")
        if self.role != RoleName.CLIENT and self.client_id is not None:
            raise ValueError("client_id is only allowed for the client role")
        return self


class AdminUserUpdate(UserUpdate):
    @model_validator(mode="after")
    def _not_null(self):
        for field in ("name", "email", "role"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self
