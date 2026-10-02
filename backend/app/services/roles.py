"""Roles are global rows shared by every company, so changing what a role may do is a platform-level (super admin) action."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import Ctx
from app.core.enums import RoleName
from app.core.exceptions import ForbiddenError, NotFoundError, UnprocessableError
from app.core.permissions import clear_permission_cache
from app.models.role import Permission, Role
from app.models.user import User
from app.services.activity import log_activity

SUPER = RoleName.SUPER_ADMIN.value


def _user_counts(db: Session, ctx: Ctx) -> dict[int, int]:
    stmt = ctx.scope(select(User.role_id, func.count()).group_by(User.role_id), User)
    return dict(db.execute(stmt).all())


def _role_dict(role: Role, user_count: int, *, with_codes: bool = False) -> dict:
    data = {
        "id": role.id, "name": role.name, "display_name": role.display_name, "description": role.description,
        "permission_count": len(role.permissions), "user_count": user_count,
    }
    if with_codes:
        data["permissions"] = sorted(p.code for p in role.permissions)
    return data


def _visible(ctx: Ctx, role: Role) -> bool:
    return ctx.is_super or role.name != SUPER  # the platform role is invisible to company users


def list_roles(db: Session, ctx: Ctx) -> list[dict]:
    counts = _user_counts(db, ctx)
    roles = db.scalars(select(Role).order_by(Role.id)).all()
    return [_role_dict(r, counts.get(r.id, 0)) for r in roles if _visible(ctx, r)]


def _get_role(db: Session, ctx: Ctx, role_id: int) -> Role:
    role = db.get(Role, role_id)
    if role is None or not _visible(ctx, role):
        raise NotFoundError("Role not found")
    return role


def get_role(db: Session, ctx: Ctx, role_id: int) -> dict:
    role = _get_role(db, ctx, role_id)
    return _role_dict(role, _user_counts(db, ctx).get(role.id, 0), with_codes=True)


def list_permissions(db: Session) -> list[dict]:
    groups: dict[str, list[Permission]] = {}
    for perm in db.scalars(select(Permission).order_by(Permission.module, Permission.code)):
        groups.setdefault(perm.module, []).append(perm)
    return [{"module": module, "permissions": perms} for module, perms in groups.items()]


def set_role_permissions(db: Session, ctx: Ctx, role_id: int, codes: list[str]) -> dict:
    if not ctx.is_super:
        raise ForbiddenError("Roles are shared by every company; only a super admin can change their permissions")
    role = _get_role(db, ctx, role_id)
    found = {p.code: p for p in db.scalars(select(Permission).where(Permission.code.in_(codes)))} if codes else {}
    unknown = sorted(set(codes) - set(found))
    if unknown:
        raise UnprocessableError("Unknown permission codes", {"permissions": f"Unknown: {', '.join(unknown)}"})
    if role.name == SUPER:
        if not codes:
            raise UnprocessableError("The super_admin role cannot have all its permissions removed", {"permissions": "Cannot be empty"})
        if "manage_roles" not in found:  # otherwise nobody could ever restore permissions
            raise UnprocessableError("super_admin must keep the manage_roles permission", {"permissions": "manage_roles is required"})
    before = {p.code for p in role.permissions}
    role.permissions = [found[c] for c in codes]
    added, removed = sorted(set(codes) - before), sorted(before - set(codes))
    log_activity(
        db, ctx, "permission_change", "role", role.id,
        f"Updated permissions of role {role.name}: added [{', '.join(added)}], removed [{', '.join(removed)}]",
    )
    db.commit()
    clear_permission_cache()  # permissions are cached per role; drop stale entries so the change applies immediately
    return _role_dict(role, _user_counts(db, ctx).get(role.id, 0), with_codes=True)
