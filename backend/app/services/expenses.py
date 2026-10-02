"""Company expenses (internal finance data: never visible to clients or employees)."""
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, joinedload

from app.core.deps import Ctx
from app.core.enums import ExpenseCategory
from app.core.exceptions import NotFoundError, UnprocessableError
from app.models.employee import Employee
from app.models.expense import Expense
from app.models.project import Project
from app.schemas.expense import CategoryTotal, ExpenseCreate, ExpenseSummary, ExpenseUpdate, MonthTotal
from app.services.activity import log_activity
from app.services.common import get_scoped_or_404
from app.utils.files import StoredFile, delete_stored_file
from app.utils.pagination import like_any

ATTACHMENT_TYPES = {".pdf", ".png", ".jpg", ".jpeg"}


def _filtered(
    ctx: Ctx,
    stmt: Select,
    *,
    category: ExpenseCategory | None = None,
    project_id: int | None = None,
    employee_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    search: str | None = None,
) -> Select:
    stmt = ctx.scope(stmt, Expense)
    if category:
        stmt = stmt.where(Expense.category == category)
    if project_id:
        stmt = stmt.where(Expense.project_id == project_id)
    if employee_id:
        stmt = stmt.where(Expense.employee_id == employee_id)
    if date_from:
        stmt = stmt.where(Expense.expense_date >= date_from)
    if date_to:
        stmt = stmt.where(Expense.expense_date <= date_to)
    if search:
        stmt = stmt.where(like_any(search, Expense.title, Expense.description))
    return stmt


def list_query(ctx: Ctx, **filters) -> Select:
    return _filtered(ctx, select(Expense).options(joinedload(Expense.project), joinedload(Expense.employee)), **filters)


def get_expense(db: Session, ctx: Ctx, expense_id: int) -> Expense:
    return get_scoped_or_404(db, ctx, Expense, expense_id, "Expense")


def _check_date(value: date) -> None:
    if value > date.today() + timedelta(days=1):  # one day of slack for timezone differences
        raise UnprocessableError("Expense date cannot be in the future", {"expense_date": "Cannot be in the future"})


def _check_refs(db: Session, ctx: Ctx, employee_id: int | None, project_id: int | None) -> None:
    if employee_id is not None:
        get_scoped_or_404(db, ctx, Employee, employee_id, "Employee")
    if project_id is not None:
        get_scoped_or_404(db, ctx, Project, project_id, "Project")


def create_expense(db: Session, ctx: Ctx, data: ExpenseCreate) -> Expense:
    company_id = ctx.require_company()
    _check_date(data.expense_date)
    _check_refs(db, ctx, data.employee_id, data.project_id)
    expense = Expense(company_id=company_id, created_by=ctx.user.id, **data.model_dump())
    db.add(expense)
    db.flush()
    log_activity(db, ctx, "created", "expense", expense.id, f"Recorded expense '{expense.title}' of {expense.amount}")
    db.commit()
    db.refresh(expense)
    return expense


def update_expense(db: Session, ctx: Ctx, expense_id: int, data: ExpenseUpdate) -> Expense:
    expense = get_expense(db, ctx, expense_id)
    changes = data.model_dump(exclude_unset=True)
    if "expense_date" in changes:
        _check_date(changes["expense_date"])
    _check_refs(db, ctx, changes.get("employee_id"), changes.get("project_id"))
    for field, value in changes.items():
        setattr(expense, field, value)
    log_activity(db, ctx, "updated", "expense", expense.id, f"Updated expense '{expense.title}'")
    db.commit()
    db.refresh(expense)
    return expense


def delete_expense(db: Session, ctx: Ctx, expense_id: int) -> None:
    expense = get_expense(db, ctx, expense_id)
    attachment, title = expense.attachment, expense.title
    db.delete(expense)
    log_activity(db, ctx, "deleted", "expense", expense_id, f"Deleted expense '{title}'")
    db.commit()
    delete_stored_file(attachment)


def set_attachment(db: Session, ctx: Ctx, expense: Expense, stored: StoredFile) -> Expense:
    previous = expense.attachment
    expense.attachment = stored.relative_path
    log_activity(db, ctx, "uploaded", "expense", expense.id, f"Attached {stored.original_name} to expense '{expense.title}'")
    try:
        db.commit()
    except Exception:
        delete_stored_file(stored.relative_path)
        raise
    delete_stored_file(previous)
    db.refresh(expense)
    return expense


def log_download(db: Session, ctx: Ctx, expense: Expense) -> None:
    log_activity(db, ctx, "downloaded", "expense", expense.id, f"Downloaded the attachment of expense '{expense.title}'")
    db.commit()


def summary(db: Session, ctx: Ctx, *, date_from: date | None, date_to: date | None) -> ExpenseSummary:
    if date_from and date_to and date_to < date_from:
        raise UnprocessableError("date_to cannot be before date_from", {"date_to": "Cannot be before date_from"})
    month = func.date_format(Expense.expense_date, "%Y-%m")

    def grouped(key):
        stmt = _filtered(ctx, select(key, func.coalesce(func.sum(Expense.amount), 0), func.count(Expense.id)), date_from=date_from, date_to=date_to)
        return db.execute(stmt.group_by(key).order_by(key)).all()

    by_category = [CategoryTotal(category=c, total=Decimal(t), count=n) for c, t, n in grouped(Expense.category)]
    by_month = [MonthTotal(month=m, total=Decimal(t), count=n) for m, t, n in grouped(month)]
    return ExpenseSummary(
        date_from=date_from,
        date_to=date_to,
        total_amount=sum((c.total for c in by_category), Decimal("0.00")),
        count=sum(c.count for c in by_category),
        by_category=by_category,
        by_month=by_month,
    )


def require_attachment(expense: Expense) -> str:
    if not expense.attachment:
        raise NotFoundError("This expense has no attachment")
    return expense.attachment
