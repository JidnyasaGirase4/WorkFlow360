# WorkFlow360 — Backend API

FastAPI + MySQL (XAMPP) REST API for the WorkFlow360 React frontend: CRM, clients, projects, tasks, employees,
attendance, leave, billing, documents, support tickets, meetings, notifications, dashboards and reports, with
role-based access control and per-company data isolation.

```
XAMPP MySQL  →  workflow360_db  →  FastAPI  →  REST /api/v1  →  React
```

| | |
|---|---|
| Language / framework | Python 3.13, FastAPI, Pydantic v2 |
| Database | MySQL / MariaDB (XAMPP), SQLAlchemy 2 + PyMySQL |
| Auth | JWT access + refresh tokens (rotating, revocable), bcrypt password hashes |
| Docs | Swagger `/docs`, ReDoc `/redoc`, [docs/API_ENDPOINTS.md](docs/API_ENDPOINTS.md), Postman collection |

---

## 1. Setup (Windows + XAMPP)

1. **Install XAMPP** and open the XAMPP Control Panel.
2. **Start MySQL** (Apache is only needed for phpMyAdmin).
3. Open **phpMyAdmin** (`http://localhost/phpmyadmin`) → *New* → create database **`workflow360_db`**, collation `utf8mb4_unicode_ci`.
4. **Python environment** (from this `backend/` folder):
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```
5. **Configure** — copy `.env.example` to `.env` and set at least `JWT_SECRET_KEY`
   (`python -c "import secrets; print(secrets.token_urlsafe(48))"`). XAMPP's default MySQL login is user `root` with an empty password; change `DB_PASSWORD` if you set one.
6. **Create the tables and demo data** (pick one):
   ```powershell
   python -m app.database.seed --reset      # tables + roles/permissions + demo data (recommended)
   # or, schema only:
   python -m app.database.init_db
   # or, by hand: phpMyAdmin → select workflow360_db → Import → sql/schema.sql, then run init_db to add roles/permissions
   ```
7. **Run the API**:
   ```powershell
   uvicorn app.main:app --reload --port 8000
   ```
8. Open **Swagger**: <http://localhost:8000/docs> (ReDoc: `/redoc`, health check: `/health`).

In Swagger: run `POST /api/v1/auth/login`, copy `data.access_token`, click **Authorize**, paste it.

### Demo accounts (local development only — never use in production)

Every account uses the password **`Password@123`**.

| Role | Email |
|---|---|
| Super Admin | `admin@workflow360.local` |
| Company Admin | `company@workflow360.local` |
| Manager | `manager@workflow360.local` |
| Employee | `employee@workflow360.local` |
| Client | `client@workflow360.local` |

Seed data: 2 companies (TechNova Solutions with everything, plus a tiny Northwind Digital to demonstrate isolation), 7 clients, 8 projects,
32 tasks, 12 invoices with payments, 3 quotations, 12 tickets, 12 expenses, 10 leads, 8 meetings, 8 documents (real PDFs in `uploads/`),
attendance, leave, notifications and audit entries. Dates are relative to the day you seed. `--reset` **drops every table** in the configured database — development only.

---

## 2. Project layout

```
app/
  main.py              app factory: CORS, security headers, error handlers, auto-mounts every router in routers/
  core/                config (env), security (bcrypt/JWT), permissions (catalogue + role matrix), deps (auth context), exceptions, enums
  database/            engine/session, base + mixins, init_db, seed
  models/              SQLAlchemy models (36 tables)
  schemas/             Pydantic request/response models
  routers/             thin HTTP layer, one file per module
  services/            business rules, queries, transactions, audit logs, notifications
  utils/               response envelope, pagination/sorting/search, safe file upload
  middleware/          security headers
scripts/               export_schema.py (sql/schema.sql), export_docs.py (docs + Postman)
sql/schema.sql         generated MySQL DDL          docs/API_ENDPOINTS.md   generated endpoint reference
postman/               generated Postman collection tests/                  pytest suite
CONVENTIONS.md         how to add a module the same way the others are built
```

Business logic lives in `services/`; routers only parse input and shape output. Money is `Decimal` end-to-end; totals are never taken from the client.

---

## 3. API conventions

* Base path `/api/v1`; JSON field names are snake_case and match DB columns; ids are integers.
* Success `{"success": true, "message": "...", "data": ...}`. Lists add `page, limit, total, total_pages`
  (`?page=1&limit=20`, max 100), plus `?search=`, `?sort_by=&sort_order=asc|desc` (sort fields are whitelisted; unknown → 422) and module filters (`?status=active`).
* Errors `{"success": false, "message": "...", "errors": {field: message}}` with 400/401/403/404/409/422/500. Internal errors never leak stack traces.
* `Authorization: Bearer <access_token>`. Access tokens last 30 minutes; refresh with `POST /auth/refresh` (refresh tokens rotate: each use revokes the old one; logout and password change revoke them).
* **Money** fields are decimal strings (`"236000.00"`, lossless) on CRUD endpoints and numbers on dashboard/report endpoints (ready for charts).
* Super admins act across companies; pass `?company_id=` to scope a list/report or to create company data.

Full endpoint table (method, path, summary, required permission): [docs/API_ENDPOINTS.md](docs/API_ENDPOINTS.md).
Regenerate after changing routes: `python scripts/export_docs.py`.

---

## 4. Access control

Every protected endpoint checks, in order: valid token → active user in an active company → role **permission** → **row-level** rule.
A record from another company answers **404** (it looks the same as a missing row).

| | Super admin | Company admin | Manager | Employee | Client |
|---|---|---|---|---|---|
| Scope | all companies | own company | own company | own company | own client record |
| Users / roles | manage | manage users, view roles | view users | — | — |
| Employees | all | all incl. salary | directory, no salary | directory, no salary (own salary on own profile) | — |
| CRM (leads, clients) | all | all | view/create/edit (no delete) | — | own client record only |
| Projects / tasks | all | all | ones they manage or belong to | ones they belong to; update own tasks | own projects (budget hidden), no tasks |
| Billing | all | all | read-only | — | own issued invoices & payments |
| Expenses / quotations | all | all | read-only | — | — |
| Documents | by visibility | by visibility (all in company) | by visibility | by visibility | `client`-visibility docs of own client |
| Tickets | all | all | all in company | assigned/created | own client's; internal comments never shown |
| Reports | all | all | projects/tasks/tickets/employees on their projects | — | — |
| Audit log | all | own company | — | — | — |

The default permission matrix is in `app/core/permissions.py`. Roles are global rows, so **only a super admin can edit role permissions**
(`PUT /roles/{id}/permissions`). Users can't edit their own role/status, and a company's last active admin can't be demoted or deactivated.

Documents: never served from a static folder. `GET /documents/{id}/download` authenticates, applies the visibility rules (private / company / client; employee-category files are admin + the employee only), then streams the file.
Uploads validate extension, MIME type, file signature and size (`MAX_UPLOAD_MB`, default 10); stored names are random UUIDs.

---

## 5. Testing

The suite runs against a **real MySQL database** and refuses to run unless the database name contains `test`.

```powershell
# one-time: create the test database in phpMyAdmin (or SQL): CREATE DATABASE workflow360_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
python -m pytest                                    # everything
python -m pytest tests/test_invoices.py tests/test_payments.py
$env:TEST_DB_NAME='workflow360_test_2'; python -m pytest   # use another test database
```

The tests drop and recreate every table in the test database, so never point `TEST_DB_NAME` at your development data.
Coverage: authentication (register, login, invalid password, refresh rotation, expiry, logout, reset/change password, email verification), permission
matrices for all five roles, company isolation on every module, CRM (create/update/convert leads, duplicate prevention, atomic conversion), projects
(members, milestones, tasks, comments, attachments, derived progress), billing (server-side totals, payments, balances, overdue, atomic payment,
concurrent payments), documents (upload validation, access matrix), tickets (assignment, comments, internal notes, status rules), HR (attendance, leave
balances/approval, salary visibility), notifications, dashboards, reports, search.

Postman: import `postman/WorkFlow360.postman_collection.json`, run **POST /auth/login** first (it stores the token in a collection variable).

---

## 6. React integration

The frontend keeps working on its mock data by default. To talk to this API:

1. Start the backend (`uvicorn app.main:app --reload --port 8000`).
2. In the React project create `.env.local`: `VITE_API_URL=http://localhost:8000/api/v1`, then `npm run dev` (origin `http://localhost:5173` is already allowed by CORS; change `FRONTEND_URL` in `.env` for other origins — comma-separated).
3. `src/services/apiClient.js` is the single HTTP client: base URL, `Authorization` header, one silent refresh + retry on a 401, `ApiError` with field errors, `api.get/post/put/patch/delete/upload`. If a refresh fails it dispatches `wf360:auth-expired`, which `AuthContext` turns into the "session expired" redirect.
4. `src/services/authService.js` already calls the real API when `VITE_API_URL` is set (login, register, forgot/reset password, change password, verify email, logout).

**Status:** authentication is wired. The other frontend services (`projectService`, `invoiceService`, …) still use the in-memory mocks — replace each service body with `api.*` calls the same way `authService` does. Differences to handle in those adapters:

| Frontend (mock) | API |
|---|---|
| camelCase (`dueDate`, `clientId`) | snake_case (`due_date`, `client_id`) |
| ids like `'prj-1'`, names as strings (`client: 'BrightPixel'`) | integer ids + joined names (`client_id`, `client_name`) |
| task status `done` | `completed` |
| meeting status `upcoming`; types `Video Call/Phone Call/In Person` | `scheduled`; `client_meeting/internal/project_review/sales/support/other` + `meeting_link`/`location` |
| document visibility `everyone/team/admins` | `company/client/private` |
| lead source `Website`, `Referral` | `website`, `referral` … (lower-case snake) |
| invoice `amount/paid/balance/taxPercent` | `total_amount/paid_amount/balance_amount` + per-item `tax_rate` |
| token in `AuthContext` | `access_token` (30 min) + `refresh_token` handled by `apiClient` |

Registration creates a **company workspace with a company admin**. Employees and clients are created by an admin (`POST /employees`, `POST /users` with role `client` and `client_id`), so the "Employee/Client" account types on the public register page don't self-register in API mode.

---

## 7. Security checklist

Verified by the automated tests unless marked *manual*:

- [x] Passwords bcrypt-hashed; strength and confirm-password rules enforced server-side
- [x] JWT signature/expiry/type validated; refresh tokens rotate and are revocable; suspending a user or company blocks existing tokens
- [x] Permissions and row-level rules on every module; company isolation (cross-company → 404), including foreign ids in request bodies
- [x] Client users never see internal ticket comments, salaries, other clients' data or budgets
- [x] Input validation (Pydantic, unknown fields rejected); sort fields whitelisted; search wildcards escaped; SQLAlchemy parameterised queries
- [x] Uploads: extension + MIME + magic bytes + size; random stored names; authorised downloads only
- [x] Multi-step writes in one transaction (invoice+items, payment+invoice+audit+notification, lead conversion); payments lock the invoice row
- [x] Centralised error handling; no stack traces in responses
- [x] Secrets only in `.env` (git-ignored); `.env.example` provided
- [ ] *manual* CORS is restricted to `FRONTEND_URL` — set it to your real origin(s) in production and use HTTPS
- [ ] *manual* Change every demo password, set a strong `JWT_SECRET_KEY`, `APP_ENV=production`, and use a non-root MySQL user

## 8. Known limitations (v1)

* No SMTP: password-reset and verification tokens are written to the server log (and echoed as `dev_token` outside production).
* Users created through `POST /users` with role employee/manager have no employee profile — use `POST /employees` for staff.
* Payments are an append-only ledger (no refund/reversal); quotation expiry is not enforced; no leave-allowance model (yearly entitlements are constants: casual 12, sick 10, earned 18).
* Leave days are calendar days; holidays are not excluded from balances.
* Deleting a task/milestone removes its older audit rows from that project's activity feed (the feed joins on current ids).
* Payment gateways, WebSockets, background jobs/cron (overdue invoices are computed on read) and cloud storage are deliberately out of scope.

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| `JWT_SECRET_KEY is not set` | Copy `.env.example` → `.env` and set it |
| `Can't connect to MySQL server` | Start MySQL in the XAMPP Control Panel; check `DB_HOST/PORT` (default `localhost:3306`) |
| `Unknown database 'workflow360_db'` | Create it in phpMyAdmin (step 1.3) |
| XAMPP MySQL won't start, error log says *"Aria recovery failed … run aria_chk -r … delete aria_log files"* | The MySQL system tables crashed. **Back up `C:\xampp\mysql\data` first**, delete `aria_log.*` and `aria_log_control`, run `aria_chk -r` on the `.MAI` files in `C:\xampp\mysql\data\mysql`, then start MySQL. This affects every database on that XAMPP instance |
| Tests refuse to run | `TEST_DB_NAME` must contain "test" (default `workflow360_test`) |
| CORS error in the browser | Add the React origin to `FRONTEND_URL` and restart |
