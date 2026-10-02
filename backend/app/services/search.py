"""Global search. A category is searched only when the caller holds its *_view permission, and each category applies
the same row-level rules as its own module (projects via `access`, tasks/tickets/invoices via the dashboard scopes)."""
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.core.deps import Ctx
from app.core.exceptions import UnprocessableError
from app.models.client import Client
from app.models.employee import Employee
from app.models.invoice import Invoice
from app.models.lead import Lead
from app.models.project import Project
from app.models.task import Task
from app.models.ticket import Ticket
from app.models.user import User
from app.services.access import project_visibility
from app.services.dashboard import invoice_filter, task_filter, ticket_filter
from app.utils.pagination import like_any

MIN_QUERY_LENGTH = 2


def _hits(db: Session, stmt: Select, limit: int) -> list[dict]:
    """`stmt` selects (id, title, subtitle, status) in that order."""
    return [
        {"id": r[0], "title": r[1], "subtitle": r[2] or "", "status": getattr(r[3], "value", r[3]) or ""}
        for r in db.execute(stmt.limit(limit))
    ]


def _clients(db: Session, ctx: Ctx, term: str, limit: int) -> list[dict]:
    stmt = ctx.scope(select(Client.id, Client.company_name, Client.contact_name, Client.status), Client)
    if ctx.is_client:  # a client user can only ever find their own record
        stmt = stmt.where(Client.id == ctx.client_id)
    stmt = stmt.where(like_any(term, Client.company_name, Client.contact_name, Client.email, Client.city)).order_by(Client.company_name, Client.id)
    return _hits(db, stmt, limit)


def _leads(db: Session, ctx: Ctx, term: str, limit: int) -> list[dict]:
    if ctx.is_client:
        return []
    stmt = ctx.scope(select(Lead.id, Lead.company_name, Lead.contact_name, Lead.status), Lead)
    stmt = stmt.where(like_any(term, Lead.company_name, Lead.contact_name, Lead.email)).order_by(Lead.company_name, Lead.id)
    return _hits(db, stmt, limit)


def _projects(db: Session, ctx: Ctx, term: str, limit: int) -> list[dict]:
    stmt = select(Project.id, Project.name, Project.project_code, Project.status).where(project_visibility(ctx), like_any(term, Project.name, Project.project_code))
    return _hits(db, stmt.order_by(Project.name, Project.id), limit)


def _employees(db: Session, ctx: Ctx, term: str, limit: int) -> list[dict]:
    """Directory entries only: name, designation/code and status. Salary and contact details are never selected."""
    if ctx.is_client:
        return []
    stmt = (
        ctx.scope(select(Employee.id, User.name, Employee.designation, Employee.employment_status).join(User, User.id == Employee.user_id), Employee)
        .where(like_any(term, User.name, User.email, Employee.employee_code, Employee.designation))
        .order_by(User.name, Employee.id)
    )
    return _hits(db, stmt, limit)


def _tasks(db: Session, ctx: Ctx, term: str, limit: int) -> list[dict]:
    stmt = (
        select(Task.id, Task.title, Project.name, Task.status).join(Project, Project.id == Task.project_id)
        .where(task_filter(ctx), like_any(term, Task.title)).order_by(Task.title, Task.id)
    )
    return _hits(db, stmt, limit)


def _invoices(db: Session, ctx: Ctx, term: str, limit: int) -> list[dict]:
    stmt = (
        select(Invoice.id, Invoice.invoice_number, Client.company_name, Invoice.status).join(Client, Client.id == Invoice.client_id)
        .where(invoice_filter(ctx), like_any(term, Invoice.invoice_number, Client.company_name)).order_by(Invoice.id.desc())
    )
    return _hits(db, stmt, limit)


def _tickets(db: Session, ctx: Ctx, term: str, limit: int) -> list[dict]:
    stmt = (
        select(Ticket.id, Ticket.subject, Ticket.ticket_number, Ticket.status)
        .where(ticket_filter(ctx), like_any(term, Ticket.subject, Ticket.ticket_number)).order_by(Ticket.id.desc())
    )
    return _hits(db, stmt, limit)


# category -> (permission required, searcher)
CATEGORIES = {
    "clients": ("view_clients", _clients),
    "leads": ("view_leads", _leads),
    "projects": ("view_projects", _projects),
    "employees": ("view_employees", _employees),
    "tasks": ("view_tasks", _tasks),
    "invoices": ("view_invoices", _invoices),
    "tickets": ("view_tickets", _tickets),
}


def search(db: Session, ctx: Ctx, query: str, limit: int) -> dict:
    term = query.strip()
    if len(term) < MIN_QUERY_LENGTH:
        raise UnprocessableError("Validation failed", {"q": f"Enter at least {MIN_QUERY_LENGTH} characters"})
    results = {name: searcher(db, ctx, term, limit) for name, (permission, searcher) in CATEGORIES.items() if ctx.can(permission)}
    return {"query": term, "total_results": sum(len(hits) for hits in results.values()), **results}
