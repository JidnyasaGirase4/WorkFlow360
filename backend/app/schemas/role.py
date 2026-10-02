from pydantic import field_validator

from app.schemas.common import ORMModel, RequestModel


class RoleOut(ORMModel):
    id: int
    name: str
    display_name: str
    description: str | None
    permission_count: int
    user_count: int  # users holding this role in the caller's company (all companies for a super admin)


class RoleDetail(RoleOut):
    permissions: list[str]


class PermissionOut(ORMModel):
    id: int
    code: str
    module: str
    description: str | None


class PermissionGroup(ORMModel):
    module: str
    permissions: list[PermissionOut]


class RolePermissionsUpdate(RequestModel):
    permissions: list[str]

    @field_validator("permissions")
    @classmethod
    def _dedupe(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys(code.strip() for code in value))
