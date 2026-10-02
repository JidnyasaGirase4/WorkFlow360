"""Idempotent creation of the reference data every install needs: roles + permissions."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import PERMISSIONS, ROLE_DISPLAY, ROLE_PERMISSIONS, clear_permission_cache
from app.models.role import Permission, Role


def seed_roles_and_permissions(db: Session) -> None:
    perms = {p.code: p for p in db.scalars(select(Permission))}
    for code, (module, description) in PERMISSIONS.items():
        if code not in perms:
            perms[code] = Permission(code=code, module=module, description=description)
            db.add(perms[code])

    roles = {r.name: r for r in db.scalars(select(Role))}
    for name, (display, description) in ROLE_DISPLAY.items():
        if name not in roles:
            roles[name] = Role(name=name, display_name=display, description=description)
            db.add(roles[name])
    db.flush()

    for name, codes in ROLE_PERMISSIONS.items():
        role = roles[name]
        current = {p.code for p in role.permissions}
        # Only add missing defaults; never strip permissions an admin granted or revoked later.
        if not current:
            role.permissions = [perms[c] for c in sorted(codes)]
    db.commit()
    clear_permission_cache()
