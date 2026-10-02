"""Milestone rules. Access always flows through the visibility of the parent project."""
from datetime import date

from sqlalchemy import Select, case, func, select
from sqlalchemy.orm import Session

from app.core.deps import Ctx
from app.core.enums import MilestoneStatus, TaskStatus
from app.core.exceptions import NotFoundError
from app.models.milestone import Milestone
from app.models.project import Project
from app.models.task import Task
from app.schemas.milestone import MilestoneBase, MilestoneCreate, MilestoneOut, MilestoneUpdate
from app.services.access import get_visible_project, project_visibility
from app.services.activity import log_activity


def list_query(db: Session, ctx: Ctx, project_id: int) -> Select:
    project = get_visible_project(db, ctx, project_id)  # 404 for a project the caller cannot see
    return select(Milestone).where(Milestone.project_id == project.id)


def get_milestone(db: Session, ctx: Ctx, milestone_id: int) -> Milestone:
    stmt = select(Milestone).join(Project, Project.id == Milestone.project_id).where(Milestone.id == milestone_id, project_visibility(ctx))
    milestone = db.scalars(stmt).first()
    if milestone is None:
        raise NotFoundError("Milestone not found")
    return milestone


def serialize(db: Session, milestones: list[Milestone]) -> list[MilestoneOut]:
    ids = [m.id for m in milestones]
    counts: dict[int, tuple[int, int]] = {}
    if ids:
        rows = db.execute(
            select(Task.milestone_id, func.count(), func.coalesce(func.sum(case((Task.status == TaskStatus.COMPLETED, 1), else_=0)), 0))
            .where(Task.milestone_id.in_(ids))
            .group_by(Task.milestone_id)
        ).all()
        counts = {mid: (int(total), int(done)) for mid, total, done in rows}
    today = date.today()
    result = []
    for m in milestones:
        total, done = counts.get(m.id, (0, 0))
        result.append(
            MilestoneOut(
                **MilestoneBase.model_validate(m).model_dump(),
                task_count=total,
                completed_task_count=done,
                is_overdue=bool(m.due_date and m.due_date < today and m.status != MilestoneStatus.COMPLETED),
            )
        )
    return result


def recompute_progress(db: Session, milestone_id: int | None) -> None:
    """Milestone progress = % of its tasks completed (only when it has tasks). Caller commits."""
    if milestone_id is None:
        return
    db.flush()
    total, done = db.execute(
        select(func.count(), func.coalesce(func.sum(case((Task.status == TaskStatus.COMPLETED, 1), else_=0)), 0)).where(Task.milestone_id == milestone_id)
    ).one()
    milestone = db.get(Milestone, milestone_id)
    if milestone is not None and total:
        milestone.progress = (int(done) * 200 + int(total)) // (2 * int(total))  # round half up


def create_milestone(db: Session, ctx: Ctx, project_id: int, data: MilestoneCreate) -> Milestone:
    project = get_visible_project(db, ctx, project_id)
    milestone = Milestone(project_id=project.id, **data.model_dump())
    db.add(milestone)
    db.flush()
    log_activity(db, ctx, "created", "milestone", milestone.id, f"Added milestone '{milestone.name}' to {project.name}")
    db.commit()
    return milestone


def update_milestone(db: Session, ctx: Ctx, milestone_id: int, data: MilestoneUpdate) -> Milestone:
    milestone = get_milestone(db, ctx, milestone_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(milestone, field, value)
    recompute_progress(db, milestone.id)  # a derived value wins over a manual one
    log_activity(db, ctx, "updated", "milestone", milestone.id, f"Updated milestone '{milestone.name}'")
    db.commit()
    return milestone


def delete_milestone(db: Session, ctx: Ctx, milestone_id: int) -> None:
    """Tasks of the milestone are kept (the FK sets their milestone_id to NULL)."""
    milestone = get_milestone(db, ctx, milestone_id)
    name = milestone.name
    db.delete(milestone)
    log_activity(db, ctx, "deleted", "milestone", milestone_id, f"Deleted milestone '{name}'")
    db.commit()
