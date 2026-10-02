from fastapi import APIRouter

from app.core.deps import DbSession, Needs
from app.schemas.role import PermissionGroup, RoleDetail, RoleOut, RolePermissionsUpdate
from app.services import roles as service
from app.utils.responses import ERROR_RESPONSES, Envelope, ok

router = APIRouter(prefix="/roles", tags=["Roles & Permissions"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})
permissions_router = APIRouter(prefix="/permissions", tags=["Roles & Permissions"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})
extra_routers = [permissions_router]


@router.get(
    "",
    response_model=Envelope[list[RoleOut]],
    summary="List roles",
    description="Each role with its permission count and the number of users holding it in the caller's company. "
    "The platform `super_admin` role is only visible to super admins.",
)
def list_roles(ctx: Needs("view_roles"), db: DbSession):
    return ok(service.list_roles(db, ctx))


@router.get("/{role_id}", response_model=Envelope[RoleDetail], summary="Get a role with its permission codes", responses={404: ERROR_RESPONSES[404]})
def get_role(role_id: int, ctx: Needs("view_roles"), db: DbSession):
    return ok(service.get_role(db, ctx, role_id))


@router.put(
    "/{role_id}/permissions",
    response_model=Envelope[RoleDetail],
    summary="Replace the permissions of a role (super admin only)",
    description="Roles are **global rows shared by every company**, so editing them is restricted to the super admin "
    "(403 for company admins). The list replaces the role's current permissions; unknown codes return 422. "
    "`super_admin` cannot be emptied and must keep `manage_roles`. The change applies immediately and is audited as `permission_change`.",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
def set_role_permissions(role_id: int, body: RolePermissionsUpdate, ctx: Needs("manage_roles"), db: DbSession):
    return ok(service.set_role_permissions(db, ctx, role_id, body.permissions), "Role permissions updated successfully")


@permissions_router.get(
    "",
    response_model=Envelope[list[PermissionGroup]],
    summary="List all permissions grouped by module",
)
def list_permissions(ctx: Needs("view_roles"), db: DbSession):
    return ok(service.list_permissions(db))
