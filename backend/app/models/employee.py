from datetime import date
from decimal import Decimal

from sqlalchemy import JSON, Date, ForeignKey, Index, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import AttendanceStatus, EmploymentStatus, EmploymentType, LeaveStatus, LeaveType
from app.database.base import Base, TimestampMixin, enum_type
from app.models.department import Department
from app.models.user import User


class Employee(Base, TimestampMixin):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), unique=True, nullable=False)
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id", ondelete="SET NULL"))
    manager_id: Mapped[int | None] = mapped_column(ForeignKey("employees.id", ondelete="SET NULL"))
    designation: Mapped[str | None] = mapped_column(String(100))
    employee_code: Mapped[str] = mapped_column(String(30), nullable=False)
    joining_date: Mapped[date | None] = mapped_column(Date)
    salary: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))  # sensitive: gated by `view_salary`
    employment_status: Mapped[EmploymentStatus] = mapped_column(enum_type(EmploymentStatus), default=EmploymentStatus.ACTIVE, nullable=False)
    employment_type: Mapped[EmploymentType] = mapped_column(enum_type(EmploymentType), default=EmploymentType.FULL_TIME, nullable=False)
    address: Mapped[str | None] = mapped_column(Text)
    emergency_contact_name: Mapped[str | None] = mapped_column(String(120))
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(30))
    emergency_contact_relation: Mapped[str | None] = mapped_column(String(50))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(20))
    location: Mapped[str | None] = mapped_column(String(120))
    skills: Mapped[list | None] = mapped_column(JSON)

    user: Mapped[User] = relationship(lazy="joined", foreign_keys=[user_id])
    department: Mapped[Department | None] = relationship(lazy="joined")

    __table_args__ = (
        UniqueConstraint("company_id", "employee_code", name="uq_employees_company_code"),
        Index("ix_employees_department_id", "department_id"),
        Index("ix_employees_company_status", "company_id", "employment_status"),
    )


class AttendanceRecord(Base, TimestampMixin):
    __tablename__ = "attendance_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False)
    check_in: Mapped[str | None] = mapped_column(String(5))  # "HH:MM"
    check_out: Mapped[str | None] = mapped_column(String(5))
    status: Mapped[AttendanceStatus] = mapped_column(enum_type(AttendanceStatus), default=AttendanceStatus.PRESENT, nullable=False)
    notes: Mapped[str | None] = mapped_column(String(255))

    employee: Mapped[Employee] = relationship(lazy="joined")

    __table_args__ = (
        UniqueConstraint("employee_id", "attendance_date", name="uq_attendance_employee_date"),
        Index("ix_attendance_company_date", "company_id", "attendance_date"),
    )


class LeaveRequest(Base, TimestampMixin):
    __tablename__ = "leave_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    leave_type: Mapped[LeaveType] = mapped_column(enum_type(LeaveType), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    days: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[LeaveStatus] = mapped_column(enum_type(LeaveStatus), default=LeaveStatus.PENDING, nullable=False)
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    decided_at: Mapped[date | None] = mapped_column(Date)
    rejection_reason: Mapped[str | None] = mapped_column(String(500))

    employee: Mapped[Employee] = relationship(lazy="joined")

    __table_args__ = (
        Index("ix_leave_company_status", "company_id", "status"),
        Index("ix_leave_employee_id", "employee_id"),
    )


class Holiday(Base):
    __tablename__ = "holidays"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    holiday_date: Mapped[date] = mapped_column(Date, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)

    __table_args__ = (UniqueConstraint("company_id", "holiday_date", name="uq_holidays_company_date"),)
