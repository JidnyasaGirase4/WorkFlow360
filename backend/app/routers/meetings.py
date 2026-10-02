from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.deps import DbSession, Needs
from app.core.enums import MeetingStatus, MeetingType
from app.models.meeting import Meeting
from app.schemas.meeting import MeetingCreate, MeetingOut, MeetingUpdate, ParticipantResponse, ParticipantsAdd
from app.services import meetings as service
from app.utils.pagination import Pagination, Sorting, apply_sort
from app.utils.responses import ERROR_RESPONSES, Envelope, Page, ok

router = APIRouter(prefix="/meetings", tags=["Meetings"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})

SORT_FIELDS = {
    "id": Meeting.id,
    "title": Meeting.title,
    "meeting_date": Meeting.meeting_date,
    "start_time": Meeting.start_time,
    "status": Meeting.status,
    "created_at": Meeting.created_at,
}


def _one(db, meeting: Meeting) -> MeetingOut:
    return service.serialize_meetings(db, [meeting])[0]


@router.get(
    "",
    response_model=Page[MeetingOut],
    summary="List meetings",
    description="Admins and managers see every meeting of the company; employees only meetings they created or attend; "
    "client users only meetings of their own client (or that they attend).",
    responses={422: ERROR_RESPONSES[422]},
)
def list_meetings(
    ctx: Needs("view_meetings"),
    db: DbSession,
    pagination: Pagination,
    sorting: Sorting,
    search: Annotated[str | None, Query(description="Matches the title")] = None,
    status_: Annotated[MeetingStatus | None, Query(alias="status")] = None,
    meeting_type: MeetingType | None = None,
    client_id: int | None = None,
    project_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    upcoming: Annotated[bool, Query(description="Scheduled meetings from today onwards")] = False,
    mine: Annotated[bool, Query(description="Only meetings I created or attend")] = False,
):
    stmt = service.list_query(
        ctx, search=search, status=status_, meeting_type=meeting_type, client_id=client_id, project_id=project_id,
        date_from=date_from, date_to=date_to, upcoming=upcoming, mine=mine,
    )
    stmt = apply_sort(stmt, sorting, SORT_FIELDS, "meeting_date")
    return service.paginate_meetings(db, stmt, pagination)


@router.post(
    "",
    response_model=Envelope[MeetingOut],
    status_code=status.HTTP_201_CREATED,
    summary="Schedule a meeting",
    description="The creator is added as an accepted participant; other participants are notified. "
    "`end_time` must be after `start_time`; the project must belong to the client when both are given.",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
def create_meeting(body: MeetingCreate, ctx: Needs("manage_meetings"), db: DbSession):
    return ok(_one(db, service.create_meeting(db, ctx, body)), "Meeting scheduled successfully")


@router.get("/{meeting_id}", response_model=Envelope[MeetingOut], summary="Get a meeting", responses={404: ERROR_RESPONSES[404]})
def get_meeting(meeting_id: int, ctx: Needs("view_meetings"), db: DbSession):
    return ok(_one(db, service.get_visible_meeting(db, ctx, meeting_id)))


@router.put(
    "/{meeting_id}",
    response_model=Envelope[MeetingOut],
    summary="Update, reschedule or cancel a meeting",
    description="Partial update. Rescheduling, cancelling (`status: cancelled`) and newly added participants notify the participants "
    "(except the caller). `participant_user_ids` replaces the participant list; the creator always stays.",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
def update_meeting(meeting_id: int, body: MeetingUpdate, ctx: Needs("manage_meetings"), db: DbSession):
    return ok(_one(db, service.update_meeting(db, ctx, meeting_id, body)), "Meeting updated successfully")


@router.delete("/{meeting_id}", response_model=Envelope[None], summary="Delete a meeting", responses={404: ERROR_RESPONSES[404]})
def delete_meeting(meeting_id: int, ctx: Needs("manage_meetings"), db: DbSession):
    service.delete_meeting(db, ctx, meeting_id)
    return ok(None, "Meeting deleted successfully")


@router.post(
    "/{meeting_id}/participants",
    response_model=Envelope[MeetingOut],
    summary="Add participants",
    description="Users already on the meeting are ignored. Client users can only be added to meetings of their own client (422).",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
def add_participants(meeting_id: int, body: ParticipantsAdd, ctx: Needs("manage_meetings"), db: DbSession):
    return ok(_one(db, service.add_participants(db, ctx, meeting_id, body.user_ids)), "Participants added successfully")


@router.patch(
    "/{meeting_id}/participants/{user_id}",
    response_model=Envelope[MeetingOut],
    summary="Accept or decline a meeting",
    description="A participant can change only their own response; users with `manage_meetings` can change anyone's.",
    responses={404: ERROR_RESPONSES[404]},
)
def respond(meeting_id: int, user_id: int, body: ParticipantResponse, ctx: Needs("view_meetings"), db: DbSession):
    meeting = service.respond(db, ctx, meeting_id, user_id, body.response_status)
    return ok(_one(db, meeting), "Response saved successfully")
