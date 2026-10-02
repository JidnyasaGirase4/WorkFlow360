"""Single source of truth for "which projects may this caller see" — used by projects, tasks,
documents, tickets, search and reports so row-level rules never drift apart."""
from sqlalchemy import ColumnElement, and_, exists, false, or_, select
from sqlalchemy.orm import Session

from app.core.deps import Ctx
from app.core.exceptions import NotFoundError
from app.models.project import Project, ProjectMember


def project_visibility(ctx: Ctx) -> ColumnElement[bool]:
    """WHERE-clause over `Project` limiting rows to what the caller may see (company scope included).

    admin: whole company · manager: projects they manage or belong to · employee: projects they belong to
    client: projects of their client record.
    """
    company = Project.company_id == ctx.company_id if ctx.company_id is not None else Project.id.is_not(None)
    if ctx.is_admin:
        return company
    if ctx.is_client:
        return and_(company, Project.client_id == ctx.client_id) if ctx.client_id else false()
    if ctx.employee_id is None:
        return false()
    member = exists().where(ProjectMember.project_id == Project.id, ProjectMember.employee_id == ctx.employee_id)
    if ctx.is_manager:
        return and_(company, or_(Project.manager_id == ctx.employee_id, member))
    return and_(company, member)


def visible_project_ids(ctx: Ctx):
    """Subquery of project ids the caller can see: `Model.project_id.in_(visible_project_ids(ctx))`."""
    return select(Project.id).where(project_visibility(ctx))


def get_visible_project(db: Session, ctx: Ctx, project_id: int) -> Project:
    """Load a project the caller may see; anything else answers 404 (never leaks existence)."""
    project = db.scalars(select(Project).where(Project.id == project_id, project_visibility(ctx))).first()
    if project is None:
        raise NotFoundError("Project not found")
    return project
