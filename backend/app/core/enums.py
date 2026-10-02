"""Every enumerated value used by the API and stored as a MySQL ENUM column."""
from enum import Enum


class StrEnum(str, Enum):
    def __str__(self) -> str:  # pragma: no cover - trivial
        return self.value


class RoleName(StrEnum):
    SUPER_ADMIN = "super_admin"
    COMPANY_ADMIN = "company_admin"
    MANAGER = "manager"
    EMPLOYEE = "employee"
    CLIENT = "client"


class UserStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class CompanyStatus(StrEnum):
    ACTIVE = "active"
    SUSPENDED = "suspended"


class AuthTokenPurpose(StrEnum):
    PASSWORD_RESET = "password_reset"
    EMAIL_VERIFY = "email_verify"


class GenericStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class EmploymentStatus(StrEnum):
    ACTIVE = "active"
    ON_LEAVE = "on_leave"
    INACTIVE = "inactive"
    TERMINATED = "terminated"


class EmploymentType(StrEnum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACT = "contract"
    INTERN = "intern"


class ClientStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    PROSPECT = "prospect"
    ARCHIVED = "archived"


class LeadStatus(StrEnum):
    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    PROPOSAL = "proposal"
    NEGOTIATION = "negotiation"
    WON = "won"
    LOST = "lost"


class LeadSource(StrEnum):
    WEBSITE = "website"
    REFERRAL = "referral"
    SOCIAL_MEDIA = "social_media"
    ADVERTISEMENT = "advertisement"
    COLD_CALL = "cold_call"
    EMAIL = "email"
    OTHER = "other"


class Priority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class LeadActivityType(StrEnum):
    CALL = "call"
    EMAIL = "email"
    MEETING = "meeting"
    NOTE = "note"
    FOLLOW_UP = "follow_up"


class ProjectStatus(StrEnum):
    PLANNING = "planning"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class MilestoneStatus(StrEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DELAYED = "delayed"


class TaskStatus(StrEnum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    COMPLETED = "completed"


class MeetingType(StrEnum):
    CLIENT_MEETING = "client_meeting"
    INTERNAL = "internal"
    PROJECT_REVIEW = "project_review"
    SALES = "sales"
    SUPPORT = "support"
    OTHER = "other"


class MeetingStatus(StrEnum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ResponseStatus(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"


class DocumentCategory(StrEnum):
    CLIENT = "client"
    PROJECT = "project"
    EMPLOYEE = "employee"
    CONTRACT = "contract"
    INVOICE = "invoice"
    OTHER = "other"


class DocumentVisibility(StrEnum):
    PRIVATE = "private"  # uploader + admins
    COMPANY = "company"  # every internal user of the company
    CLIENT = "client"  # internal users + users of the document's client


class InvoiceStatus(StrEnum):
    DRAFT = "draft"
    SENT = "sent"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class QuotationStatus(StrEnum):
    DRAFT = "draft"
    SENT = "sent"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CONVERTED = "converted"
    EXPIRED = "expired"


class PaymentMethod(StrEnum):
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"
    UPI = "upi"
    CARD = "card"
    CHEQUE = "cheque"
    OTHER = "other"


class ExpenseCategory(StrEnum):
    SOFTWARE = "software"
    TRAVEL = "travel"
    OFFICE = "office"
    MARKETING = "marketing"
    SALARY = "salary"
    EQUIPMENT = "equipment"
    OTHER = "other"


class TicketStatus(StrEnum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    WAITING_FOR_CLIENT = "waiting_for_client"
    RESOLVED = "resolved"
    CLOSED = "closed"


class NotificationType(StrEnum):
    TASK = "task"
    PROJECT = "project"
    INVOICE = "invoice"
    PAYMENT = "payment"
    TICKET = "ticket"
    MEETING = "meeting"
    SYSTEM = "system"


class AttendanceStatus(StrEnum):
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    WFH = "wfh"
    HALF_DAY = "half_day"
    ON_LEAVE = "on_leave"


class LeaveType(StrEnum):
    CASUAL = "casual"
    SICK = "sick"
    EARNED = "earned"


class LeaveStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
