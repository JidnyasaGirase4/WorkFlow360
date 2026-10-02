from datetime import datetime
from typing import Annotated

from pydantic import StringConstraints, model_validator

from app.core.enums import GenericStatus
from app.schemas.common import LongText, ORMModel, RequestModel

DepartmentName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]


class DepartmentCreate(RequestModel):
    name: DepartmentName
    description: LongText | None = None
    status: GenericStatus = GenericStatus.ACTIVE


class DepartmentUpdate(RequestModel):
    name: DepartmentName | None = None
    description: LongText | None = None
    status: GenericStatus | None = None

    @model_validator(mode="after")
    def _not_null(self):
        for field in ("name", "status"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class DepartmentOut(ORMModel):
    id: int
    company_id: int
    name: str
    description: str | None
    status: GenericStatus
    employee_count: int = 0
    created_at: datetime
    updated_at: datetime
