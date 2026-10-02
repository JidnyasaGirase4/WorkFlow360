import mimetypes
from datetime import date
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Query, UploadFile, status

from app.core.deps import DbSession, Needs
from app.core.enums import ExpenseCategory
from app.models.expense import Expense
from app.schemas.expense import ExpenseCreate, ExpenseOut, ExpenseSummary, ExpenseUpdate
from app.services import expenses as service
from app.utils.files import file_response, save_upload
from app.utils.pagination import Pagination, Sorting, apply_sort, paginate
from app.utils.responses import ERROR_RESPONSES, Envelope, Page, ok

router = APIRouter(prefix="/expenses", tags=["Expenses"], responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})

SORT_FIELDS = {
    "id": Expense.id,
    "expense_date": Expense.expense_date,
    "amount": Expense.amount,
    "category": Expense.category,
    "title": Expense.title,
    "created_at": Expense.created_at,
}


@router.get("", response_model=Page[ExpenseOut], summary="List expenses")
def list_expenses(
    ctx: Needs("view_expenses"),
    db: DbSession,
    pagination: Pagination,
    sorting: Sorting,
    category: ExpenseCategory | None = None,
    project_id: int | None = None,
    employee_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    search: Annotated[str | None, Query(description="Matches title and description")] = None,
):
    stmt = service.list_query(ctx, category=category, project_id=project_id, employee_id=employee_id, date_from=date_from, date_to=date_to, search=search)
    stmt = apply_sort(stmt, sorting, SORT_FIELDS, "expense_date")
    return paginate(db, stmt, pagination, ExpenseOut.model_validate)


@router.get(
    "/summary",
    response_model=Envelope[ExpenseSummary],
    summary="Expense totals by category and by month",
    description="Optionally limited to `date_from` / `date_to` (inclusive).",
    responses={422: ERROR_RESPONSES[422]},
)
def expense_summary(ctx: Needs("view_expenses"), db: DbSession, date_from: date | None = None, date_to: date | None = None):
    return ok(service.summary(db, ctx, date_from=date_from, date_to=date_to))


@router.post(
    "",
    response_model=Envelope[ExpenseOut],
    status_code=status.HTTP_201_CREATED,
    summary="Record an expense",
    description="`employee_id` and `project_id` must belong to the company. The expense date may be at most one day ahead.",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
def create_expense(body: ExpenseCreate, ctx: Needs("manage_expenses"), db: DbSession):
    return ok(service.create_expense(db, ctx, body), "Expense created successfully")


@router.get("/{expense_id}", response_model=Envelope[ExpenseOut], summary="Get an expense", responses={404: ERROR_RESPONSES[404]})
def get_expense(expense_id: int, ctx: Needs("view_expenses"), db: DbSession):
    return ok(service.get_expense(db, ctx, expense_id))


@router.put("/{expense_id}", response_model=Envelope[ExpenseOut], summary="Update an expense", responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]})
def update_expense(expense_id: int, body: ExpenseUpdate, ctx: Needs("manage_expenses"), db: DbSession):
    return ok(service.update_expense(db, ctx, expense_id, body), "Expense updated successfully")


@router.delete("/{expense_id}", response_model=Envelope[None], summary="Delete an expense (and its attachment)", responses={404: ERROR_RESPONSES[404]})
def delete_expense(expense_id: int, ctx: Needs("manage_expenses"), db: DbSession):
    service.delete_expense(db, ctx, expense_id)
    return ok(None, "Expense deleted successfully")


@router.post(
    "/{expense_id}/attachment",
    response_model=Envelope[ExpenseOut],
    summary="Upload (or replace) the receipt",
    description="Multipart field `file`. PDF, PNG or JPG only, validated by extension, MIME type and file signature.",
    responses={404: ERROR_RESPONSES[404], 422: ERROR_RESPONSES[422]},
)
async def upload_attachment(expense_id: int, ctx: Needs("manage_expenses"), db: DbSession, file: Annotated[UploadFile, File(description="Receipt (pdf/png/jpg)")]):
    expense = service.get_expense(db, ctx, expense_id)
    stored = await save_upload(file, f"{expense.company_id}/expenses", allowed_extensions=service.ATTACHMENT_TYPES)
    return ok(service.set_attachment(db, ctx, expense, stored), "Attachment uploaded successfully")


@router.get(
    "/{expense_id}/attachment",
    summary="Download the receipt",
    description="Returns the file itself (not the JSON envelope) after checking the caller may view expenses of this company.",
    responses={404: ERROR_RESPONSES[404]},
)
def download_attachment(expense_id: int, ctx: Needs("view_expenses"), db: DbSession):
    expense = service.get_expense(db, ctx, expense_id)
    path = service.require_attachment(expense)
    service.log_download(db, ctx, expense)
    ext = Path(path).suffix
    return file_response(path, f"expense-{expense.id}{ext}", mimetypes.guess_type(path)[0] or "application/octet-stream")
