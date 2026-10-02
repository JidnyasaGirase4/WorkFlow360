from fastapi import APIRouter

from app.core.deps import DbSession, Needs
from app.schemas.milestone import MilestoneOut, MilestoneUpdate
from app.services import milestones as service
from app.utils.responses import ERROR_RESPONSES, Envelope, ok

# Listing / creating milestones lives under /projects/{id}/milestones (routers/projects.py).
router = APIRouter(prefix="/milestones", tags=["Milestones"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})


@router.get("/{milestone_id}", response_model=Envelope[MilestoneOut], summary="Get a milestone", responses={404: ERROR_RESPONSES[404]})
def get_milestone(milestone_id: int, ctx: Needs("view_projects"), db: DbSession):
    return ok(service.serialize(db, [service.get_milestone(db, ctx, milestone_id)])[0])


@router.put(
    "/{milestone_id}",
    response_model=Envelope[MilestoneOut],
    summary="Update a milestone",
    description="Once a milestone has tasks its progress is derived from them and a manual `progress` is ignored.",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
def update_milestone(milestone_id: int, body: MilestoneUpdate, ctx: Needs("edit_projects"), db: DbSession):
    milestone = service.update_milestone(db, ctx, milestone_id, body)
    return ok(service.serialize(db, [milestone])[0], "Milestone updated successfully")


@router.delete(
    "/{milestone_id}",
    response_model=Envelope[None],
    summary="Delete a milestone",
    description="Its tasks are kept and simply lose the milestone.",
    responses={404: ERROR_RESPONSES[404]},
)
def delete_milestone(milestone_id: int, ctx: Needs("edit_projects"), db: DbSession):
    service.delete_milestone(db, ctx, milestone_id)
    return ok(None, "Milestone deleted successfully")
