from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import Priority, TicketStatus
from app.database.base import Base, TimestampMixin, enum_type, utcnow


class Ticket(Base, TimestampMixin):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False)
    ticket_number: Mapped[str] = mapped_column(String(30), nullable=False)  # TCK-0001
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"))
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str | None] = mapped_column(String(60))
    priority: Mapped[Priority] = mapped_column(enum_type(Priority), default=Priority.MEDIUM, nullable=False)
    status: Mapped[TicketStatus] = mapped_column(enum_type(TicketStatus), default=TicketStatus.OPEN, nullable=False)
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime)

    # read-only joins so output can carry display names without N+1 queries
    client: Mapped["Client"] = relationship("Client", foreign_keys=[client_id], lazy="joined", viewonly=True)
    project: Mapped["Project | None"] = relationship("Project", foreign_keys=[project_id], lazy="joined", viewonly=True)
    assignee: Mapped["User | None"] = relationship("User", foreign_keys=[assigned_to], lazy="joined", viewonly=True)
    creator: Mapped["User | None"] = relationship("User", foreign_keys=[created_by], lazy="joined", viewonly=True)

    __table_args__ = (
        UniqueConstraint("company_id", "ticket_number", name="uq_tickets_company_number"),
        Index("ix_tickets_client_id", "client_id"),
        Index("ix_tickets_status", "status"),
        Index("ix_tickets_company_status", "company_id", "status"),
        Index("ix_tickets_assigned_to", "assigned_to"),
        Index("ix_tickets_project_id", "project_id"),
    )


class TicketComment(Base):
    __tablename__ = "ticket_comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # never shown to clients
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    user: Mapped["User | None"] = relationship("User", foreign_keys=[user_id], lazy="joined", viewonly=True)

    __table_args__ = (Index("ix_ticket_comments_ticket_id", "ticket_id"),)


class TicketAttachment(Base):
    __tablename__ = "ticket_attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    comment_id: Mapped[int | None] = mapped_column(ForeignKey("ticket_comments.id", ondelete="SET NULL"))
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(120), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    uploader: Mapped["User | None"] = relationship("User", foreign_keys=[uploaded_by], lazy="joined", viewonly=True)

    __table_args__ = (Index("ix_ticket_attachments_ticket_id", "ticket_id"),)
