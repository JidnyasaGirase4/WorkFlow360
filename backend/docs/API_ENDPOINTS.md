# WorkFlow360 API endpoint reference

Base URL: `http://localhost:8000/api/v1` — **189 endpoints**. Interactive docs: `/docs` (Swagger) and `/redoc`.

Send `Authorization: Bearer <access_token>` on every endpoint except those marked *public*. "Permission" is the permission code the caller's role must hold (in addition to company/row-level checks described in the endpoint's Swagger description). Endpoints with no permission code only require a valid login and apply their own row-level rules.

## Attendance

| Method | Path | Summary | Access |
|---|---|---|---|
| GET | `/api/v1/attendance` | List attendance records | any signed-in user |
| POST | `/api/v1/attendance` | Create an attendance record manually | `manage_attendance` |
| POST | `/api/v1/attendance/check-in` | Check in for today | `mark_attendance` |
| POST | `/api/v1/attendance/check-out` | Check out for today | `mark_attendance` |
| GET | `/api/v1/attendance/me/summary` | My monthly attendance counts | `mark_attendance` |
| GET | `/api/v1/attendance/today` | Today's attendance summary | `view_attendance` |
| DELETE | `/api/v1/attendance/{record_id}` | Delete an attendance record | `manage_attendance` |
| PUT | `/api/v1/attendance/{record_id}` | Update an attendance record | `manage_attendance` |
| GET | `/api/v1/holidays` | List holidays of a year | any signed-in user |
| POST | `/api/v1/holidays` | Add a holiday | `manage_settings` |
| DELETE | `/api/v1/holidays/{holiday_id}` | Remove a holiday | `manage_settings` |

## Audit Logs

| Method | Path | Summary | Access |
|---|---|---|---|
| GET | `/api/v1/audit-logs` | List audit log entries | `view_audit_logs` |
| GET | `/api/v1/audit-logs/{log_id}` | Get one audit log entry | `view_audit_logs` |

## Auth

| Method | Path | Summary | Access |
|---|---|---|---|
| POST | `/api/v1/auth/change-password` | Change the signed-in user's password | any signed-in user |
| POST | `/api/v1/auth/forgot-password` | Request a password reset link | public |
| POST | `/api/v1/auth/login` | Sign in with email and password | public |
| POST | `/api/v1/auth/logout` | Sign out (revokes the refresh token) | public |
| GET | `/api/v1/auth/me` | Current user, company and permissions | any signed-in user |
| POST | `/api/v1/auth/refresh` | Exchange a refresh token for a new token pair | public |
| POST | `/api/v1/auth/register` | Register a new company workspace | public |
| POST | `/api/v1/auth/resend-verification` | Send a new email verification token | any signed-in user |
| POST | `/api/v1/auth/reset-password` | Set a new password using a reset token | public |
| POST | `/api/v1/auth/verify-email` | Confirm an email address with the emailed token | public |

## Clients

| Method | Path | Summary | Access |
|---|---|---|---|
| GET | `/api/v1/clients` | List clients | `view_clients` |
| POST | `/api/v1/clients` | Create a client | `create_clients` |
| DELETE | `/api/v1/clients/{client_id}` | Delete (or archive) a client | `delete_clients` |
| GET | `/api/v1/clients/{client_id}` | Get a client with contacts and billing stats | any signed-in user |
| PUT | `/api/v1/clients/{client_id}` | Update a client | `edit_clients` |
| GET | `/api/v1/clients/{client_id}/contacts` | List a client's contacts | `view_clients` |
| POST | `/api/v1/clients/{client_id}/contacts` | Add a contact to a client | `edit_clients` |
| DELETE | `/api/v1/clients/{client_id}/contacts/{contact_id}` | Remove a client contact | `edit_clients` |
| PUT | `/api/v1/clients/{client_id}/contacts/{contact_id}` | Update a client contact | `edit_clients` |
| GET | `/api/v1/clients/{client_id}/invoices` | List a client's invoices | `view_invoices` |
| GET | `/api/v1/clients/{client_id}/payments` | List a client's payments | `view_payments` |
| GET | `/api/v1/clients/{client_id}/projects` | List a client's projects | `view_projects` |

## Companies

| Method | Path | Summary | Access |
|---|---|---|---|
| GET | `/api/v1/companies` | List companies (super admin) | `manage_companies` |
| POST | `/api/v1/companies` | Create a company with its first admin (super admin) | `manage_companies` |
| GET | `/api/v1/companies/me` | Get the caller's company settings | `manage_settings` |
| PUT | `/api/v1/companies/me` | Update the caller's company settings | `manage_settings` |
| GET | `/api/v1/companies/{company_id}` | Get a company (super admin) | `manage_companies` |
| PUT | `/api/v1/companies/{company_id}` | Update a company (super admin) | `manage_companies` |
| PATCH | `/api/v1/companies/{company_id}/status` | Activate or suspend a company (super admin) | `manage_companies` |

## Dashboard

| Method | Path | Summary | Access |
|---|---|---|---|
| GET | `/api/v1/dashboard/activities` | Latest audit-trail entries | `view_dashboard` |
| GET | `/api/v1/dashboard/clients` | Client counts by status, top clients by revenue and new clients per month (admin only) | `view_dashboard` |
| GET | `/api/v1/dashboard/overview` | Role-aware KPI overview | `view_dashboard` |
| GET | `/api/v1/dashboard/projects` | Project counts by status and the top open projects by progress | `view_dashboard` |
| GET | `/api/v1/dashboard/revenue` | Monthly revenue, invoiced and outstanding (admin only) | `view_dashboard` |
| GET | `/api/v1/dashboard/tasks` | Task counts by status/priority, overdue count and tasks due this week | `view_dashboard` |
| GET | `/api/v1/dashboard/tickets` | Ticket counts, monthly opened-vs-resolved trend and average resolution time | `view_dashboard` |

## Departments

| Method | Path | Summary | Access |
|---|---|---|---|
| GET | `/api/v1/departments` | List departments | `view_departments` |
| POST | `/api/v1/departments` | Create a department | `manage_departments` |
| DELETE | `/api/v1/departments/{department_id}` | Delete a department | `manage_departments` |
| GET | `/api/v1/departments/{department_id}` | Get a department | `view_departments` |
| PUT | `/api/v1/departments/{department_id}` | Update a department | `manage_departments` |

## Documents

| Method | Path | Summary | Access |
|---|---|---|---|
| GET | `/api/v1/clients/{client_id}/documents` | List a client's documents | `view_documents` |
| GET | `/api/v1/documents` | List documents | `view_documents` |
| POST | `/api/v1/documents/upload` | Upload a document | `upload_documents` |
| DELETE | `/api/v1/documents/{document_id}` | Delete a document and its stored file | `delete_documents` |
| GET | `/api/v1/documents/{document_id}` | Get a document's details | `view_documents` |
| PATCH | `/api/v1/documents/{document_id}` | Rename a document or change its category / visibility | `upload_documents` |
| GET | `/api/v1/documents/{document_id}/download` | Download (or preview) a document | `view_documents` |
| GET | `/api/v1/projects/{project_id}/documents` | List a project's documents | `view_documents` |

## Employees

| Method | Path | Summary | Access |
|---|---|---|---|
| GET | `/api/v1/employees` | List employees | `view_employees` |
| POST | `/api/v1/employees` | Create an employee (and their login) | `create_employees` |
| GET | `/api/v1/employees/me` | The caller's own employee profile | any signed-in user |
| DELETE | `/api/v1/employees/{employee_id}` | Deactivate an employee | `delete_employees` |
| GET | `/api/v1/employees/{employee_id}` | Get an employee profile | `view_employees` |
| PUT | `/api/v1/employees/{employee_id}` | Update an employee | `edit_employees` |
| GET | `/api/v1/employees/{employee_id}/activity` | Audit trail of an employee's actions | any signed-in user |
| GET | `/api/v1/employees/{employee_id}/projects` | List projects an employee manages or belongs to | `view_projects` |
| GET | `/api/v1/employees/{employee_id}/tasks` | List tasks assigned to an employee | `view_tasks` |

## Expenses

| Method | Path | Summary | Access |
|---|---|---|---|
| GET | `/api/v1/expenses` | List expenses | `view_expenses` |
| POST | `/api/v1/expenses` | Record an expense | `manage_expenses` |
| GET | `/api/v1/expenses/summary` | Expense totals by category and by month | `view_expenses` |
| DELETE | `/api/v1/expenses/{expense_id}` | Delete an expense (and its attachment) | `manage_expenses` |
| GET | `/api/v1/expenses/{expense_id}` | Get an expense | `view_expenses` |
| PUT | `/api/v1/expenses/{expense_id}` | Update an expense | `manage_expenses` |
| GET | `/api/v1/expenses/{expense_id}/attachment` | Download the receipt | `view_expenses` |
| POST | `/api/v1/expenses/{expense_id}/attachment` | Upload (or replace) the receipt | `manage_expenses` |

## Invoices

| Method | Path | Summary | Access |
|---|---|---|---|
| GET | `/api/v1/invoices` | List invoices | `view_invoices` |
| POST | `/api/v1/invoices` | Create an invoice | `create_invoices` |
| DELETE | `/api/v1/invoices/{invoice_id}` | Delete a draft invoice | `delete_invoices` |
| GET | `/api/v1/invoices/{invoice_id}` | Get an invoice with items, payments and activity | `view_invoices` |
| PUT | `/api/v1/invoices/{invoice_id}` | Edit an invoice | `edit_invoices` |
| POST | `/api/v1/invoices/{invoice_id}/cancel` | Cancel an invoice | `edit_invoices` |
| GET | `/api/v1/invoices/{invoice_id}/items` | List an invoice's line items | `view_invoices` |
| GET | `/api/v1/invoices/{invoice_id}/payments` | List payments recorded against an invoice | `view_invoices`, `view_payments` |
| POST | `/api/v1/invoices/{invoice_id}/send` | Send a draft invoice to the client | `edit_invoices` |

## Leads

| Method | Path | Summary | Access |
|---|---|---|---|
| GET | `/api/v1/leads` | List leads | `view_leads` |
| POST | `/api/v1/leads` | Create a lead | `create_leads` |
| GET | `/api/v1/leads/pipeline` | Pipeline summary for the Kanban header | `view_leads` |
| DELETE | `/api/v1/leads/{lead_id}` | Delete a lead | `delete_leads` |
| GET | `/api/v1/leads/{lead_id}` | Get a lead | `view_leads` |
| PUT | `/api/v1/leads/{lead_id}` | Update a lead | `edit_leads` |
| GET | `/api/v1/leads/{lead_id}/activities` | List a lead's activities (newest first) | `view_leads` |
| POST | `/api/v1/leads/{lead_id}/activities` | Log an activity on a lead | `edit_leads` |
| POST | `/api/v1/leads/{lead_id}/convert` | Convert a lead into a client | `edit_leads` |

## Leave

| Method | Path | Summary | Access |
|---|---|---|---|
| GET | `/api/v1/leave` | List leave requests | any signed-in user |
| POST | `/api/v1/leave` | Apply for leave | `apply_leave` |
| GET | `/api/v1/leave/balance` | Leave balance | any signed-in user |
| PATCH | `/api/v1/leave/{leave_id}/approve` | Approve a leave request | `approve_leave` |
| PATCH | `/api/v1/leave/{leave_id}/cancel` | Cancel own pending leave request | `apply_leave` |
| PATCH | `/api/v1/leave/{leave_id}/reject` | Reject a leave request | `approve_leave` |

## Meetings

| Method | Path | Summary | Access |
|---|---|---|---|
| GET | `/api/v1/meetings` | List meetings | `view_meetings` |
| POST | `/api/v1/meetings` | Schedule a meeting | `manage_meetings` |
| DELETE | `/api/v1/meetings/{meeting_id}` | Delete a meeting | `manage_meetings` |
| GET | `/api/v1/meetings/{meeting_id}` | Get a meeting | `view_meetings` |
| PUT | `/api/v1/meetings/{meeting_id}` | Update, reschedule or cancel a meeting | `manage_meetings` |
| POST | `/api/v1/meetings/{meeting_id}/participants` | Add participants | `manage_meetings` |
| PATCH | `/api/v1/meetings/{meeting_id}/participants/{user_id}` | Accept or decline a meeting | `view_meetings` |

## Milestones

| Method | Path | Summary | Access |
|---|---|---|---|
| DELETE | `/api/v1/milestones/{milestone_id}` | Delete a milestone | `edit_projects` |
| GET | `/api/v1/milestones/{milestone_id}` | Get a milestone | `view_projects` |
| PUT | `/api/v1/milestones/{milestone_id}` | Update a milestone | `edit_projects` |

## Notifications

| Method | Path | Summary | Access |
|---|---|---|---|
| GET | `/api/v1/notifications` | List my notifications | any signed-in user |
| PATCH | `/api/v1/notifications/read-all` | Mark all my notifications as read | any signed-in user |
| GET | `/api/v1/notifications/unread-count` | Number of my unread notifications | any signed-in user |
| DELETE | `/api/v1/notifications/{notification_id}` | Delete one of my notifications | any signed-in user |
| PATCH | `/api/v1/notifications/{notification_id}/read` | Mark one notification as read | any signed-in user |

## Payments

| Method | Path | Summary | Access |
|---|---|---|---|
| GET | `/api/v1/payments` | List payments | `view_payments` |
| POST | `/api/v1/payments` | Record a payment against an invoice | `create_payments` |
| GET | `/api/v1/payments/{payment_id}` | Get a payment | `view_payments` |

## Projects

| Method | Path | Summary | Access |
|---|---|---|---|
| GET | `/api/v1/projects` | List projects | `view_projects` |
| POST | `/api/v1/projects` | Create a project | `create_projects` |
| DELETE | `/api/v1/projects/{project_id}` | Delete a project | `delete_projects` |
| GET | `/api/v1/projects/{project_id}` | Get a project | `view_projects` |
| PUT | `/api/v1/projects/{project_id}` | Update a project | `edit_projects` |
| GET | `/api/v1/projects/{project_id}/activity` | Project activity feed | `view_projects` |
| GET | `/api/v1/projects/{project_id}/members` | List project members | `view_projects` |
| POST | `/api/v1/projects/{project_id}/members` | Add a project member | `manage_project_members` |
| DELETE | `/api/v1/projects/{project_id}/members/{employee_id}` | Remove a project member | `manage_project_members` |
| GET | `/api/v1/projects/{project_id}/milestones` | List a project's milestones | `view_projects` |
| POST | `/api/v1/projects/{project_id}/milestones` | Add a milestone to a project | `edit_projects` |
| GET | `/api/v1/projects/{project_id}/tasks` | List a project's tasks | `view_tasks` |

## Quotations

| Method | Path | Summary | Access |
|---|---|---|---|
| GET | `/api/v1/quotations` | List quotations | `view_quotations` |
| POST | `/api/v1/quotations` | Create a quotation | `manage_quotations` |
| DELETE | `/api/v1/quotations/{quotation_id}` | Delete a draft quotation | `manage_quotations` |
| GET | `/api/v1/quotations/{quotation_id}` | Get a quotation with its items | `view_quotations` |
| PUT | `/api/v1/quotations/{quotation_id}` | Edit a quotation | `manage_quotations` |
| POST | `/api/v1/quotations/{quotation_id}/accept` | Record that the client accepted (sent -> accepted) | `manage_quotations` |
| POST | `/api/v1/quotations/{quotation_id}/convert` | Convert a quotation into a draft invoice | `manage_quotations` |
| POST | `/api/v1/quotations/{quotation_id}/reject` | Record that the client rejected (sent -> rejected) | `manage_quotations` |
| POST | `/api/v1/quotations/{quotation_id}/send` | Mark a draft quotation as sent | `manage_quotations` |

## Reports

| Method | Path | Summary | Access |
|---|---|---|---|
| GET | `/api/v1/reports/clients` | Client billing report (admin only) | `view_reports` |
| GET | `/api/v1/reports/employees` | Employee performance report (admin; manager: members of visible projects) | `view_reports` |
| GET | `/api/v1/reports/invoices` | Invoice report with aging (admin only) | `view_reports` |
| GET | `/api/v1/reports/payments` | Payment report (admin only) | `view_reports` |
| GET | `/api/v1/reports/projects` | Project completion report (admin; manager: visible projects) | `view_reports` |
| GET | `/api/v1/reports/revenue` | Revenue report (admin only) | `view_reports` |
| GET | `/api/v1/reports/tasks` | Task report (admin; manager: visible projects) | `view_reports` |
| GET | `/api/v1/reports/tickets` | Support ticket report (admin; manager: visible projects) | `view_reports` |

## Roles & Permissions

| Method | Path | Summary | Access |
|---|---|---|---|
| GET | `/api/v1/permissions` | List all permissions grouped by module | `view_roles` |
| GET | `/api/v1/roles` | List roles | `view_roles` |
| GET | `/api/v1/roles/{role_id}` | Get a role with its permission codes | `view_roles` |
| PUT | `/api/v1/roles/{role_id}/permissions` | Replace the permissions of a role (super admin only) | `manage_roles` |

## Search

| Method | Path | Summary | Access |
|---|---|---|---|
| GET | `/api/v1/search` | Global search across modules | any signed-in user |

## Tasks

| Method | Path | Summary | Access |
|---|---|---|---|
| GET | `/api/v1/tasks` | List tasks | `view_tasks` |
| POST | `/api/v1/tasks` | Create a task | `create_tasks` |
| DELETE | `/api/v1/tasks/{task_id}` | Delete a task (admin / manager) | `delete_tasks` |
| GET | `/api/v1/tasks/{task_id}` | Get a task | `view_tasks` |
| PUT | `/api/v1/tasks/{task_id}` | Update a task (admin / manager) | `edit_tasks` |
| PATCH | `/api/v1/tasks/{task_id}/assign` | Assign or unassign a task (admin / manager) | `edit_tasks` |
| GET | `/api/v1/tasks/{task_id}/attachments` | List a task's attachments | `view_tasks` |
| POST | `/api/v1/tasks/{task_id}/attachments` | Attach a file to a task | `edit_tasks` |
| DELETE | `/api/v1/tasks/{task_id}/attachments/{attachment_id}` | Delete a task attachment | `edit_tasks` |
| GET | `/api/v1/tasks/{task_id}/attachments/{attachment_id}/download` | Download a task attachment | `view_tasks` |
| PATCH | `/api/v1/tasks/{task_id}/checklist` | Replace a task's checklist | `edit_tasks` |
| GET | `/api/v1/tasks/{task_id}/comments` | List a task's comments | `view_tasks` |
| POST | `/api/v1/tasks/{task_id}/comments` | Comment on a task | `edit_tasks` |
| PATCH | `/api/v1/tasks/{task_id}/status` | Change a task's status | `edit_tasks` |

## Tickets

| Method | Path | Summary | Access |
|---|---|---|---|
| GET | `/api/v1/clients/{client_id}/tickets` | List a client's tickets | `view_tickets` |
| GET | `/api/v1/tickets` | List tickets | `view_tickets` |
| POST | `/api/v1/tickets` | Raise a ticket | `create_tickets` |
| DELETE | `/api/v1/tickets/{ticket_id}` | Delete a ticket | `manage_tickets` |
| GET | `/api/v1/tickets/{ticket_id}` | Get a ticket with comments and attachments | `view_tickets` |
| PUT | `/api/v1/tickets/{ticket_id}` | Edit a ticket | `view_tickets` |
| PATCH | `/api/v1/tickets/{ticket_id}/assign` | Assign a ticket to an internal user | `manage_tickets` |
| GET | `/api/v1/tickets/{ticket_id}/attachments` | List a ticket's attachments | `view_tickets` |
| POST | `/api/v1/tickets/{ticket_id}/attachments` | Attach a file to a ticket (or to one of its comments) | `view_tickets` |
| DELETE | `/api/v1/tickets/{ticket_id}/attachments/{attachment_id}` | Remove a ticket attachment | `view_tickets` |
| GET | `/api/v1/tickets/{ticket_id}/attachments/{attachment_id}/download` | Download a ticket attachment | `view_tickets` |
| GET | `/api/v1/tickets/{ticket_id}/comments` | List a ticket's comments | `view_tickets` |
| POST | `/api/v1/tickets/{ticket_id}/comments` | Comment on a ticket | `view_tickets` |
| PATCH | `/api/v1/tickets/{ticket_id}/status` | Change a ticket's status | `view_tickets` |

## Users

| Method | Path | Summary | Access |
|---|---|---|---|
| GET | `/api/v1/users` | List users | `view_users` |
| POST | `/api/v1/users` | Create a user | `create_users` |
| DELETE | `/api/v1/users/{user_id}` | Deactivate a user | `delete_users` |
| GET | `/api/v1/users/{user_id}` | Get a user | `view_users` |
| PUT | `/api/v1/users/{user_id}` | Update a user | `edit_users` |
| PATCH | `/api/v1/users/{user_id}/status` | Activate, deactivate or suspend a user | `edit_users` |
