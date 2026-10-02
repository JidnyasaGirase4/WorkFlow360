"""Importing this package registers every table on Base.metadata."""
from app.models.activity import ActivityLog
from app.models.client import Client, ClientContact
from app.models.company import Company
from app.models.department import Department
from app.models.document import Document
from app.models.employee import AttendanceRecord, Employee, Holiday, LeaveRequest
from app.models.expense import Expense
from app.models.invoice import Invoice, InvoiceItem, Quotation, QuotationItem
from app.models.lead import Lead, LeadActivity
from app.models.meeting import Meeting, MeetingParticipant
from app.models.milestone import Milestone
from app.models.notification import Notification
from app.models.payment import Payment
from app.models.project import Project, ProjectMember
from app.models.role import Permission, Role, role_permissions
from app.models.task import Task, TaskAttachment, TaskComment
from app.models.ticket import Ticket, TicketAttachment, TicketComment
from app.models.user import AuthToken, RefreshToken, User

__all__ = [
    "ActivityLog", "AttendanceRecord", "AuthToken", "Client", "ClientContact", "Company", "Department",
    "Document", "Employee", "Expense", "Holiday", "Invoice", "InvoiceItem", "Lead", "LeadActivity",
    "LeaveRequest", "Meeting", "MeetingParticipant", "Milestone", "Notification", "Payment", "Permission",
    "Project", "ProjectMember", "Quotation", "QuotationItem", "RefreshToken", "Role", "Task",
    "TaskAttachment", "TaskComment", "Ticket", "TicketAttachment", "TicketComment", "User", "role_permissions",
]
