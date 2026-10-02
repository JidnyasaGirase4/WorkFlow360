"""User administration. Company admins manage their own company's users; only a super admin touches platform accounts."""
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.deps import Ctx
from app.core.enums import RoleName, UserStatus
from app.core.exceptions import BadRequestError, ConflictError, ForbiddenError, NotFoundError, UnprocessableError
from app.core.security import hash_password
from app.models.client import Client
from app.models.company import Company
from app.models.role import Role
from app.models.user import User
from app.schemas.users_admin import AdminUserCreate, AdminUserUpdate
from app.services.activity import log_activity
from app.services.auth import find_user_by_email, revoke_all_sessions
from app.services.common import get_scoped_or_404
from app.utils.pagination import like_any

SUPER = RoleName.SUPER_ADMIN.value
COMPANY_ADMIN = RoleName.COMPANY_ADMIN.value
CLIENT = RoleName.CLIENT.value


def list_query(ctx: Ctx, *, search: str | None, role: RoleName | None, status: UserStatus | None) -> Select:
    stmt = ctx.scope(select(User), User).join(Role, User.role_id == Role.id)
    if not ctx.is_super:
        stmt = stmt.where(Role.name != SUPER)
    if ctx.is_client:  # a client user only ever sees themselves
        stmt = stmt.where(User.id == ctx.user.id)
    elif not ctx.is_admin:  # managers (and anyone else granted view_users) see internal users only
        stmt = stmt.where(Role.name != CLIENT)
    if search:
        stmt = stmt.where(like_any(search, User.name, User.email, User.phone))
    if role:
        stmt = stmt.where(Role.name == role.value)
    if status:
        stmt = stmt.where(User.status == status)
    return stmt


def _can_see(ctx: Ctx, user: User) -> bool:
    if user.role.name == SUPER:
        return ctx.is_super
    if ctx.is_client:
        return user.id == ctx.user.id
    return ctx.is_admin or user.role.name != CLIENT


def get_user(db: Session, ctx: Ctx, user_id: int) -> User:
    user = get_scoped_or_404(db, ctx, User, user_id, "User")
    if not _can_see(ctx, user):
        raise NotFoundError("User not found")  # same answer as a missing row
    return user


def _get_manageable(db: Session, ctx: Ctx, user_id: int) -> User:
    """Load a user the caller may modify. Company admin accounts can only be changed by an admin."""
    user = get_user(db, ctx, user_id)
    if user.role.name == COMPANY_ADMIN and not ctx.is_admin:
        raise ForbiddenError("Only an administrator can modify a company admin")
    return user


def _assert_can_grant(ctx: Ctx, role_name: str) -> None:
    if role_name == SUPER and not ctx.is_super:
        raise ForbiddenError("Only a super admin can grant the super_admin role")
    if role_name == COMPANY_ADMIN and not ctx.is_admin:
        raise ForbiddenError("Only an administrator can grant the company_admin role")


def _assert_not_self(ctx: Ctx, user: User, what: str) -> None:
    if user.id == ctx.user.id:
        raise ForbiddenError(f"You cannot {what} your own account")


def _assert_not_last_admin(db: Session, user: User) -> None:
    """A company must always keep an active company admin who can manage it."""
    if user.role.name != COMPANY_ADMIN or user.status != UserStatus.ACTIVE:
        return
    others = db.scalar(
        select(func.count()).select_from(User).join(Role, User.role_id == Role.id).where(
            User.company_id == user.company_id, Role.name == COMPANY_ADMIN, User.status == UserStatus.ACTIVE, User.id != user.id
        )
    )
    if not others:
        raise BadRequestError("A company must keep at least one active company admin")


def _assert_email_free(db: Session, email: str, exclude_id: int | None = None) -> None:
    existing = find_user_by_email(db, email)
    if existing and existing.id != exclude_id:
        raise ConflictError("A user with this email already exists", {"email": "Already exists"})


def _get_role(db: Session, name: RoleName) -> Role:
    role = db.scalar(select(Role).where(Role.name == name.value))
    if role is None:
        raise UnprocessableError("Unknown role", {"role": "Not found"})
    return role


def create_user(db: Session, ctx: Ctx, data: AdminUserCreate) -> User:
    role = _get_role(db, data.role)
    _assert_can_grant(ctx, role.name)
    company_id = None
    if role.name != SUPER:
        company_id = ctx.require_company()
        if db.get(Company, company_id) is None:
            raise NotFoundError("Company not found")
    email = data.email.lower()
    _assert_email_free(db, email)
    client_id = None
    if role.name == CLIENT:
        # the client record must belong to the same company the user is created in
        client = db.scalar(select(Client).where(Client.id == data.client_id, Client.company_id == company_id))
        if client is None:
            raise NotFoundError("Client not found")
        client_id = client.id
    user = User(
        company_id=company_id, client_id=client_id, name=data.name, email=email, phone=data.phone,
        password_hash=hash_password(data.password), role_id=role.id, status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.flush()
    log_activity(db, ctx, "created", "user", user.id, f"Created user {user.name} ({user.email}) with role {role.name}", company_id=company_id)
    db.commit()
    return user


def _change_role(db: Session, ctx: Ctx, user: User, new_role: RoleName) -> None:
    old_name = user.role.name
    _assert_not_self(ctx, user, "change the role of")
    _assert_can_grant(ctx, new_role.value)
    # super_admin and client accounts are tied to a different kind of record, so those changes need a fresh account
    if {old_name, new_role.value} & {SUPER, CLIENT}:
        raise UnprocessableError("Role cannot be changed to or from super_admin/client; create a new user instead", {"role": "Not allowed"})
    _assert_not_last_admin(db, user)
    role = _get_role(db, new_role)
    user.role = role
    log_activity(db, ctx, "permission_change", "user", user.id, f"Changed role of {user.name} from {old_name} to {role.name}", company_id=user.company_id)


def update_user(db: Session, ctx: Ctx, user_id: int, data: AdminUserUpdate) -> User:
    user = _get_manageable(db, ctx, user_id)
    changes = data.model_dump(exclude_unset=True)
    new_role = changes.pop("role", None)
    if "email" in changes:
        changes["email"] = changes["email"].lower()
        _assert_email_free(db, changes["email"], exclude_id=user.id)
    if new_role is not None and new_role.value != user.role.name:
        _change_role(db, ctx, user, new_role)
    changed = [field for field, value in changes.items() if getattr(user, field) != value]
    for field in changed:
        setattr(user, field, changes[field])
    if changed:
        log_activity(db, ctx, "updated", "user", user.id, f"Updated user {user.name} ({', '.join(changed)})", company_id=user.company_id)
    db.commit()
    return user


def update_status(db: Session, ctx: Ctx, user_id: int, status: UserStatus) -> User:
    user = _get_manageable(db, ctx, user_id)
    _assert_not_self(ctx, user, "change the status of")
    if status != UserStatus.ACTIVE:
        _assert_not_last_admin(db, user)
    old = user.status
    user.status = status
    if status != UserStatus.ACTIVE:
        revoke_all_sessions(db, user.id)  # existing refresh tokens must stop working immediately
    log_activity(db, ctx, "status_changed", "user", user.id, f"Changed status of {user.name} from {old.value} to {status.value}", company_id=user.company_id)
    db.commit()
    return user


def delete_user(db: Session, ctx: Ctx, user_id: int) -> None:
    """Soft delete: employees and business records reference users, so the account is deactivated, not removed."""
    user = _get_manageable(db, ctx, user_id)
    _assert_not_self(ctx, user, "delete")
    _assert_not_last_admin(db, user)
    user.status = UserStatus.INACTIVE
    revoke_all_sessions(db, user.id)
    log_activity(db, ctx, "deleted", "user", user.id, f"Deactivated user {user.name} ({user.email})", company_id=user.company_id)
    db.commit()
