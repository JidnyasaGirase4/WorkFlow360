from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.deps import DbSession, Needs
from app.core.enums import RoleName, UserStatus
from app.models.role import Role
from app.models.user import User
from app.schemas.user import UserOut, UserStatusUpdate
from app.schemas.users_admin import AdminUserCreate, AdminUserUpdate
from app.services import users as service
from app.utils.pagination import Pagination, Sorting, apply_sort, paginate
from app.utils.responses import ERROR_RESPONSES, Envelope, Page, ok

router = APIRouter(prefix="/users", tags=["Users"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})

SORT_FIELDS = {
    "id": User.id, "name": User.name, "email": User.email, "role": Role.name,
    "status": User.status, "created_at": User.created_at, "last_login": User.last_login,
}
CONFLICT = ERROR_RESPONSES[422] | {"description": "Email already in use"}


@router.get(
    "",
    response_model=Page[UserOut],
    summary="List users",
    description="Company admins see their own company; a super admin sees every company (narrow with `?company_id=`). "
    "Super admin accounts are visible to super admins only. Managers see internal (non-client) users only.",
)
def list_users(
    ctx: Needs("view_users"),
    db: DbSession,
    pagination: Pagination,
    sorting: Sorting,
    search: Annotated[str | None, Query(description="Matches name, email, phone")] = None,
    role: RoleName | None = None,
    status_: Annotated[UserStatus | None, Query(alias="status")] = None,
):
    stmt = service.list_query(ctx, search=search, role=role, status=status_)
    stmt = apply_sort(stmt, sorting, SORT_FIELDS, "created_at")
    return paginate(db, stmt, pagination, UserOut.model_validate)


@router.post(
    "",
    response_model=Envelope[UserOut],
    status_code=status.HTTP_201_CREATED,
    summary="Create a user",
    description="The password is validated and hashed; the email is lowercased and must be unique (409). "
    "Role `client` requires `client_id` of a client in the same company. Employees and managers are normally created "
    "through the employees module (which also creates their HR record); creating them here yields a login without an employee profile. "
    "Only a super admin can create `super_admin` users, or create users in another company (`?company_id=`).",
    responses={403: ERROR_RESPONSES[403], 404: ERROR_RESPONSES[404], 409: CONFLICT, 422: ERROR_RESPONSES[422]},
)
def create_user(body: AdminUserCreate, ctx: Needs("create_users"), db: DbSession):
    return ok(service.create_user(db, ctx, body), "User created successfully")


@router.get("/{user_id}", response_model=Envelope[UserOut], summary="Get a user", responses={404: ERROR_RESPONSES[404]})
def get_user(user_id: int, ctx: Needs("view_users"), db: DbSession):
    return ok(service.get_user(db, ctx, user_id))


@router.put(
    "/{user_id}",
    response_model=Envelope[UserOut],
    summary="Update a user",
    description="Changing `role` is audited as `permission_change`. You cannot change your own role, nobody except a super admin can "
    "grant `super_admin`, and roles cannot be switched to or from `super_admin`/`client` (create a new user instead). "
    "The last active company admin of a company cannot be demoted.",
    responses={404: ERROR_RESPONSES[404], 409: CONFLICT, 422: ERROR_RESPONSES[422]},
)
def update_user(user_id: int, body: AdminUserUpdate, ctx: Needs("edit_users"), db: DbSession):
    return ok(service.update_user(db, ctx, user_id, body), "User updated successfully")


@router.patch(
    "/{user_id}/status",
    response_model=Envelope[UserOut],
    summary="Activate, deactivate or suspend a user",
    description="Deactivating or suspending revokes all of the user's refresh tokens. You cannot change your own status.",
    responses={404: ERROR_RESPONSES[404]},
)
def update_user_status(user_id: int, body: UserStatusUpdate, ctx: Needs("edit_users"), db: DbSession):
    return ok(service.update_status(db, ctx, user_id, body.status), "User status updated successfully")


@router.delete(
    "/{user_id}",
    response_model=Envelope[None],
    summary="Deactivate a user",
    description="Soft delete: the account is set to `inactive` and its sessions are revoked, because employees and "
    "business records reference users. You cannot delete yourself.",
    responses={404: ERROR_RESPONSES[404]},
)
def delete_user(user_id: int, ctx: Needs("delete_users"), db: DbSession):
    service.delete_user(db, ctx, user_id)
    return ok(None, "User deactivated successfully")
