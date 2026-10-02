from datetime import date, datetime, time
from typing import Annotated

from pydantic import Field, HttpUrl, field_validator, model_validator

from app.core.enums import MeetingStatus, MeetingType, ResponseStatus
from app.schemas.common import LongText, ORMModel, RequestModel

Title = Annotated[str, Field(min_length=1, max_length=200)]


def _check_link(value: str | None) -> str | None:
    if value:
        HttpUrl(value if "://" in value else f"https://{value}")  # raises on garbage
    return value


class MeetingCreate(RequestModel):
    title: Title
    description: LongText | None = None
    client_id: int | None = None
    project_id: int | None = None
    meeting_date: date
    start_time: time
    end_time: time | None = None
    meeting_type: MeetingType = MeetingType.OTHER
    meeting_link: Annotated[str, Field(max_length=500)] | None = None
    location: Annotated[str, Field(max_length=255)] | None = None
    participant_user_ids: list[int] = []

    _link = field_validator("meeting_link")(_check_link)

    @model_validator(mode="after")
    def _times(self):
        if self.end_time is not None and self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class MeetingUpdate(RequestModel):
    title: Title | None = None
    description: LongText | None = None
    client_id: int | None = None
    project_id: int | None = None
    meeting_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    meeting_type: MeetingType | None = None
    meeting_link: Annotated[str, Field(max_length=500)] | None = None
    location: Annotated[str, Field(max_length=255)] | None = None
    status: MeetingStatus | None = None
    participant_user_ids: list[int] | None = Field(None, description="Replaces the participant list (the creator always stays)")

    _link = field_validator("meeting_link")(_check_link)

    @model_validator(mode="after")
    def _no_null_for_required(self):
        for name in ("title", "meeting_date", "start_time", "meeting_type", "status", "participant_user_ids"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class ParticipantsAdd(RequestModel):
    user_ids: list[int] = Field(min_length=1)


class ParticipantResponse(RequestModel):
    response_status: ResponseStatus


class ParticipantOut(ORMModel):
    user_id: int
    name: str
    role: str
    response_status: ResponseStatus


class MeetingOut(ORMModel):
    id: int
    company_id: int
    title: str
    description: str | None
    client_id: int | None
    client_name: str | None = None
    project_id: int | None
    project_name: str | None = None
    created_by: int | None
    created_by_name: str | None = None
    meeting_date: date
    start_time: time
    end_time: time | None
    meeting_type: MeetingType
    meeting_link: str | None
    location: str | None
    status: MeetingStatus
    participants: list[ParticipantOut] = []
    created_at: datetime
    updated_at: datetime
