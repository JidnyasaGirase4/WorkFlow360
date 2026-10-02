# Backend conventions (read before adding a module)

Reference implementation: **clients** — `app/schemas/client.py`, `app/services/clients.py`,
`app/routers/clients.py`, `tests/test_clients.py`. Auth: `app/services/auth.py`, `app/routers/auth.py`.
Copy that shape.

## Layout & layering
* `routers/<x>.py` — thin: parse request, call service, return `ok(...)` / `paginate(...)`. No SQL, no business rules.
* `services/<x>.py` — business rules, queries, transactions, audit logs, notifications. Takes `(db, ctx, ...)`.
* `schemas/<x>.py` — Pydantic. Requests extend `RequestModel` (rejects unknown fields). Responses extend `ORMModel`.
* Routers are auto-mounted under `/api/v1` — a module in `app/routers/` only needs `router = APIRouter(prefix="/x", tags=["X"])`.
  To add sub-resources under **another module's prefix** (e.g. `GET /clients/{id}/invoices` lives in the billing module),
  define another `APIRouter(prefix="/clients", tags=["Clients"])` and list it in `extra_routers = [...]` at module level.
* JSON field names are snake_case and identical to DB columns. IDs are integers.
* Never edit files you don't own. Allowed shared touches: add an *additive* column/relationship to a model **you need**;
  add an enum member. Anything else (core/, deps, conftest, permissions, main) — ask the lead instead.

## Response envelope (every endpoint)
* Single object / action: `response_model=Envelope[Schema]`, `return ok(obj, "Message")`. Actions with no payload: `Envelope[None]`, `ok(None, "...")`.
* Lists: `response_model=Page[Schema]`, `return paginate(db, stmt, pagination, Schema.model_validate)` using the `Pagination` and `Sorting` dependencies and `apply_sort(stmt, sorting, SORT_FIELDS, "created_at")`. First entry of `SORT_FIELDS` must be the `id` column. Only whitelisted sort fields. Search with `like_any(term, col, ...)`.
* Create = `status_code=201`. Every route gets `summary`, `description` (when non-obvious), and `responses={...}` using `ERROR_RESPONSES`.
* Raise `NotFoundError / ConflictError / ForbiddenError / BadRequestError / UnprocessableError` (`app.core.exceptions`). Never `HTTPException`, never return error dicts by hand.

## Auth, permissions, company isolation (non-negotiable)
* Every endpoint declares `ctx: Needs("permission_code")` (see `app/core/permissions.py` for codes and default role matrix) or `CurrentCtx` + explicit checks when access depends on the record.
* Every query on company-owned tables goes through `ctx.scope(select(Model), Model)`; single rows through `get_scoped_or_404(db, ctx, Model, id, "Label")`. Another company's row must answer **404**, not 403.
* Every foreign id in a request body (client_id, project_id, employee_id, ...) is validated with `get_scoped_or_404` / `get_referenced` so a caller cannot attach a record to another company's data.
* Creating rows: `company_id = ctx.require_company()` (super admin passes `?company_id=`).
* Row-level rules on top of permissions (a permission is necessary, not sufficient):
  * `ctx.is_client` → only rows tied to `ctx.client_id`; never internal data (salaries, internal ticket comments, expenses, other clients).
  * `ctx.is_employee` → only rows they are assigned to / are a member of; never salaries or company-wide finance.
  * `ctx.is_manager` → projects they manage or are a member of (plus their tasks/documents); company-wide where the permission is company-wide.
  * `ctx.is_admin` → whole company. Super admin without `company_id` sees all companies.
* `ctx.employee_id` is the caller's `employees.id` (None for clients/super admin); `ctx.client_id` is set for client users.

## Data integrity
* Multi-step writes happen in ONE transaction: do all changes, `log_activity(...)`, `notify(...)`, then a single `db.commit()`. On exception nothing is committed (the session is rolled back).
* Deleting business records: prefer archive/cancel over hard delete when history exists (see `delete_client`). Respect FK RESTRICT.
* Money uses `Decimal` end to end, quantized to 2 places with ROUND_HALF_UP. Never trust totals from the request.
* Audit: `log_activity(db, ctx, action, entity_type, entity_id, "Human sentence")` for every create/update/delete/status change/assignment.
  `entity_type` is the singular snake_case noun (`project`, `task`, `invoice`, `payment`, `ticket`, `document`, `lead`, `employee`, ...).
  `action` ∈ created | updated | deleted | status_changed | assigned | converted | archived | uploaded | downloaded | sent | approved | rejected | ...
* Notifications: `notify(db, user_ids, title, message, NotificationType.X, "task", task.id, exclude_user_id=ctx.user.id)`.

## Files
Use `app.utils.files.save_upload / file_response / delete_stored_file`. Store only the returned relative path. Serve files only from an endpoint that first authorises the caller. Build the folder from trusted ids: `f"{company_id}/<kind>"`.

## Tests (`tests/test_<module>.py`)
* Real MySQL (XAMPP). Run with your own database so parallel workers do not collide: `set TEST_DB_NAME=<your db>` (given in your brief) then `.venv\Scripts\python.exe -m pytest tests/test_x.py`.
* Use fixtures from `tests/conftest.py`: `client`, `db`, `factory`, `world` (companies `a`/`b`, each with admin, manager, employee, client user + `client_record`; plus `super_admin`), `auth(user)`.
* Cover: happy path CRUD, validation (422), permission matrix (each role), company isolation (b cannot see/modify a's rows → 404), client/employee row-level restrictions, each business rule, and transactional side effects (audit log row, notification row).
* Assert on real behaviour (status code AND body/DB state). A feature is "done" only when its tests pass.

## Style
Type hints, small functions, comments only where the *why* is non-obvious, no duplicated logic, no unused imports. Match `clients` in tone and density.
