"""Permission catalogue and the default role -> permission matrix (used by the seeder).

At runtime permissions are read from the `role_permissions` table, so an admin can
change them; this module only defines the defaults and the lookup cache.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import RoleName

# code -> (module, description)
PERMISSIONS: dict[str, tuple[str, str]] = {
    "view_users": ("users", "View user accounts"),
    "create_users": ("users", "Create user accounts"),
    "edit_users": ("users", "Edit user accounts and change their status"),
    "delete_users": ("users", "Delete user accounts"),
    "view_roles": ("roles", "View roles and permissions"),
    "manage_roles": ("roles", "Change which permissions a role carries"),
    "manage_companies": ("platform", "Manage companies / workspaces (super admin)"),
    "view_audit_logs": ("platform", "Review the audit log"),
    "manage_settings": ("settings", "Edit company settings"),
    "view_employees": ("employees", "View the employee directory"),
    "create_employees": ("employees", "Create employees"),
    "edit_employees": ("employees", "Edit employees"),
    "delete_employees": ("employees", "Deactivate employees"),
    "view_salary": ("employees", "See employee salary information"),
    "view_departments": ("employees", "View departments"),
    "manage_departments": ("employees", "Create, edit and delete departments"),
    "mark_attendance": ("attendance", "Check in / out for yourself"),
    "view_attendance": ("attendance", "View everyone's attendance"),
    "manage_attendance": ("attendance", "Edit attendance records"),
    "apply_leave": ("leave", "Apply for leave"),
    "view_leave": ("leave", "View everyone's leave requests"),
    "approve_leave": ("leave", "Approve or reject leave requests"),
    "view_clients": ("clients", "View clients"),
    "create_clients": ("clients", "Create clients"),
    "edit_clients": ("clients", "Edit clients"),
    "delete_clients": ("clients", "Delete / archive clients"),
    "view_leads": ("leads", "View leads"),
    "create_leads": ("leads", "Create leads"),
    "edit_leads": ("leads", "Edit leads and convert them"),
    "delete_leads": ("leads", "Delete leads"),
    "view_projects": ("projects", "View projects"),
    "create_projects": ("projects", "Create projects"),
    "edit_projects": ("projects", "Edit projects and milestones"),
    "delete_projects": ("projects", "Delete projects"),
    "manage_project_members": ("projects", "Add / remove project members"),
    "view_tasks": ("tasks", "View tasks"),
    "create_tasks": ("tasks", "Create tasks"),
    "edit_tasks": ("tasks", "Edit / update tasks"),
    "delete_tasks": ("tasks", "Delete tasks"),
    "view_meetings": ("meetings", "View meetings"),
    "manage_meetings": ("meetings", "Create, edit and delete meetings"),
    "view_documents": ("documents", "View / download documents"),
    "upload_documents": ("documents", "Upload documents"),
    "delete_documents": ("documents", "Delete documents"),
    "view_invoices": ("finance", "View invoices"),
    "create_invoices": ("finance", "Create invoices"),
    "edit_invoices": ("finance", "Edit and send invoices"),
    "delete_invoices": ("finance", "Delete invoices"),
    "view_quotations": ("finance", "View quotations"),
    "manage_quotations": ("finance", "Create, edit and convert quotations"),
    "view_payments": ("finance", "View payments"),
    "create_payments": ("finance", "Record payments"),
    "view_expenses": ("finance", "View expenses"),
    "manage_expenses": ("finance", "Create, edit and delete expenses"),
    "view_tickets": ("support", "View support tickets"),
    "create_tickets": ("support", "Raise support tickets"),
    "manage_tickets": ("support", "Assign, update and delete tickets"),
    "view_reports": ("reports", "View reports"),
    "view_dashboard": ("reports", "View dashboards"),
}

ALL = set(PERMISSIONS)

_MANAGER = {
    "view_users", "view_roles", "view_employees", "view_departments",
    "mark_attendance", "view_attendance", "apply_leave", "view_leave", "approve_leave",
    "view_clients", "create_clients", "edit_clients",
    "view_leads", "create_leads", "edit_leads",
    "view_projects", "create_projects", "edit_projects", "manage_project_members",
    "view_tasks", "create_tasks", "edit_tasks", "delete_tasks",
    "view_meetings", "manage_meetings",
    "view_documents", "upload_documents", "delete_documents",
    "view_invoices", "view_quotations", "view_payments", "view_expenses",
    "view_tickets", "create_tickets", "manage_tickets",
    "view_reports", "view_dashboard",
}

_EMPLOYEE = {
    "view_employees", "view_departments",
    "mark_attendance", "apply_leave",
    "view_projects", "view_tasks", "edit_tasks",
    "view_meetings",
    "view_documents", "upload_documents",
    "view_tickets", "create_tickets", "manage_tickets",
    "view_dashboard",
}

_CLIENT = {
    "view_projects", "view_meetings", "view_documents",
    "view_invoices", "view_payments",
    "view_tickets", "create_tickets",
    "view_dashboard",
}

ROLE_PERMISSIONS: dict[str, set[str]] = {
    RoleName.SUPER_ADMIN.value: ALL,
    RoleName.COMPANY_ADMIN.value: ALL - {"manage_companies"},
    RoleName.MANAGER.value: _MANAGER,
    RoleName.EMPLOYEE.value: _EMPLOYEE,
    RoleName.CLIENT.value: _CLIENT,
}

ROLE_DISPLAY = {
    RoleName.SUPER_ADMIN.value: ("Super Admin", "Platform owner with access to every company"),
    RoleName.COMPANY_ADMIN.value: ("Company Admin", "Manages everything inside one company"),
    RoleName.MANAGER.value: ("Manager", "Runs projects, teams and client work"),
    RoleName.EMPLOYEE.value: ("Employee", "Works on assigned projects and tasks"),
    RoleName.CLIENT.value: ("Client", "External customer with a self-service portal"),
}

_cache: dict[int, frozenset[str]] = {}


def get_role_permissions(db: Session, role_id: int) -> frozenset[str]:
    if role_id not in _cache:
        from app.models.role import Permission, role_permissions

        rows = db.scalars(
            select(Permission.code).join(role_permissions, role_permissions.c.permission_id == Permission.id).where(role_permissions.c.role_id == role_id)
        ).all()
        _cache[role_id] = frozenset(rows)
    return _cache[role_id]


def clear_permission_cache() -> None:
    _cache.clear()
