"""Request-scoped dependencies: authentication, company context, permission checks."""
from dataclasses import dataclass, field
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.core.enums import CompanyStatus, RoleName, UserStatus
from app.core.exceptions import BadRequestError, ForbiddenError, UnauthorizedError
from app.core.permissions import get_role_permissions
from app.core.security import ACCESS, decode_token
from app.database.connection import get_db
from app.models.company import Company
from app.models.employee import Employee
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False, description="Paste the access token returned by POST /auth/login")

DbSession = Annotated[Session, Depends(get_db)]


@dataclass
class Ctx:
    """Everything an endpoint needs to know about who is calling and for which company."""

    db: Session
    user: User
    role: str
    permissions: frozenset[str]
    company_id: int | None  # None => super admin looking across all companies
    employee_id: int | None = None
    client_id: int | None = None
    ip: str | None = field(default=None)

    @property
    def is_super(self) -> bool:
        return self.role == RoleName.SUPER_ADMIN.value

    @property
    def is_admin(self) -> bool:
        return self.role in (RoleName.SUPER_ADMIN.value, RoleName.COMPANY_ADMIN.value)

    @property
    def is_manager(self) -> bool:
        return self.role == RoleName.MANAGER.value

    @property
    def is_employee(self) -> bool:
        return self.role == RoleName.EMPLOYEE.value

    @property
    def is_client(self) -> bool:
        return self.role == RoleName.CLIENT.value

    @property
    def is_internal(self) -> bool:
        return not self.is_client

    def can(self, code: str) -> bool:
        return code in self.permissions

    def require(self, code: str) -> None:
        if code not in self.permissions:
            raise ForbiddenError()

    def require_company(self) -> int:
        """Company to attach new records to. Super admins must pick one with ?company_id=."""
        if self.company_id is None:
            raise BadRequestError("Super admins must pass ?company_id= when creating company data")
        return self.company_id

    def scope(self, stmt: Select, model) -> Select:
        """Restrict a query to the caller's company (no-op for a super admin viewing all)."""
        if self.company_id is not None:
            stmt = stmt.where(model.company_id == self.company_id)
        return stmt


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def get_ctx(
    request: Request,
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> Ctx:
    if credentials is None:
        raise UnauthorizedError()
    payload = decode_token(credentials.credentials, ACCESS)
    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise UnauthorizedError("User no longer exists")
    if user.status != UserStatus.ACTIVE:
        raise ForbiddenError(f"Your account is {user.status.value}")

    role = user.role.name
    company_id = user.company_id
    if role == RoleName.SUPER_ADMIN.value:
        raw = request.query_params.get("company_id")
        company_id = int(raw) if raw and raw.isdigit() else None
    else:
        company = db.get(Company, user.company_id) if user.company_id else None
        if company is None or company.status != CompanyStatus.ACTIVE:
            raise ForbiddenError("Your company workspace is not active")

    employee_id = None
    if role not in (RoleName.CLIENT.value, RoleName.SUPER_ADMIN.value):
        employee_id = db.scalar(select(Employee.id).where(Employee.user_id == user.id))

    return Ctx(
        db=db,
        user=user,
        role=role,
        permissions=get_role_permissions(db, user.role_id),
        company_id=company_id,
        employee_id=employee_id,
        client_id=user.client_id if role == RoleName.CLIENT.value else None,
        ip=_client_ip(request),
    )


CurrentCtx = Annotated[Ctx, Depends(get_ctx)]


def require_permission(*codes: str):
    """Dependency factory: caller must be authenticated and hold *all* the given permissions."""

    def dependency(ctx: CurrentCtx) -> Ctx:
        for code in codes:
            ctx.require(code)
        return ctx

    dependency.required_permissions = codes  # read by scripts/export_docs.py
    return dependency


def Needs(*codes: str):  # noqa: N802 - reads like a type in signatures: `ctx: Needs("view_clients")`
    """Typed shorthand for `Annotated[Ctx, Depends(require_permission(...))]`."""
    return Annotated[Ctx, Depends(require_permission(*codes))]


def require_roles(*roles: RoleName):
    allowed = {r.value for r in roles}

    def dependency(ctx: CurrentCtx) -> Ctx:
        if ctx.role not in allowed:
            raise ForbiddenError()
        return ctx

    return dependency
