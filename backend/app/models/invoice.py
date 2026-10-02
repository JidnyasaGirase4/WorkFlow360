from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, Index, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import InvoiceStatus, QuotationStatus
from app.database.base import Base, TimestampMixin, enum_type

if TYPE_CHECKING:
    from app.models.client import Client
    from app.models.payment import Payment
    from app.models.project import Project


class Invoice(Base, TimestampMixin):
    """All money columns are recalculated server-side from `items`; clients never set them."""

    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False)
    invoice_number: Mapped[str] = mapped_column(String(40), nullable=False)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"))
    quotation_id: Mapped[int | None] = mapped_column(ForeignKey("quotations.id", ondelete="SET NULL", use_alter=True, name="fk_invoices_quotation_id"))
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    additional_discount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, nullable=False)  # invoice-level input
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, nullable=False)  # line discounts + additional
    total_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    balance_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    status: Mapped[InvoiceStatus] = mapped_column(enum_type(InvoiceStatus), default=InvoiceStatus.DRAFT, nullable=False)
    payment_terms: Mapped[str | None] = mapped_column(String(60))
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    items: Mapped[list["InvoiceItem"]] = relationship(back_populates="invoice", cascade="all, delete-orphan", order_by="InvoiceItem.id")
    client: Mapped["Client"] = relationship()
    project: Mapped["Project | None"] = relationship()
    # Read-only view of the payment ledger; payments are only ever written through the payments service.
    payments: Mapped[list["Payment"]] = relationship(viewonly=True, order_by="Payment.payment_date, Payment.id")

    @property
    def client_name(self) -> str:
        return self.client.company_name

    @property
    def project_name(self) -> str | None:
        return self.project.name if self.project else None

    @property
    def payments_count(self) -> int:
        return len(self.payments)

    __table_args__ = (
        UniqueConstraint("company_id", "invoice_number", name="uq_invoices_company_number"),
        Index("ix_invoices_client_id", "client_id"),
        Index("ix_invoices_status", "status"),
        Index("ix_invoices_company_status", "company_id", "status"),
        Index("ix_invoices_due_date", "due_date"),
        Index("ix_invoices_project_id", "project_id"),
    )


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0, nullable=False)  # percent
    discount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, nullable=False)  # absolute amount off this line
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)  # (qty*price - discount) + tax

    invoice: Mapped[Invoice] = relationship(back_populates="items")

    __table_args__ = (Index("ix_invoice_items_invoice_id", "invoice_id"),)


class Quotation(Base, TimestampMixin):
    __tablename__ = "quotations"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False)
    quotation_number: Mapped[str] = mapped_column(String(40), nullable=False)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"))
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    valid_until: Mapped[date | None] = mapped_column(Date)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    additional_discount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    status: Mapped[QuotationStatus] = mapped_column(enum_type(QuotationStatus), default=QuotationStatus.DRAFT, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    items: Mapped[list["QuotationItem"]] = relationship(back_populates="quotation", cascade="all, delete-orphan", order_by="QuotationItem.id")
    client: Mapped["Client"] = relationship()
    project: Mapped["Project | None"] = relationship()

    @property
    def client_name(self) -> str:
        return self.client.company_name

    @property
    def project_name(self) -> str | None:
        return self.project.name if self.project else None

    __table_args__ = (
        UniqueConstraint("company_id", "quotation_number", name="uq_quotations_company_number"),
        Index("ix_quotations_client_id", "client_id"),
        Index("ix_quotations_company_status", "company_id", "status"),
    )


class QuotationItem(Base):
    __tablename__ = "quotation_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    quotation_id: Mapped[int] = mapped_column(ForeignKey("quotations.id", ondelete="CASCADE"), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    discount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)

    quotation: Mapped[Quotation] = relationship(back_populates="items")

    __table_args__ = (Index("ix_quotation_items_quotation_id", "quotation_id"),)
