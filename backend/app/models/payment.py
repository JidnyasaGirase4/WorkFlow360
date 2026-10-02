from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import PaymentMethod
from app.database.base import Base, enum_type, utcnow

if TYPE_CHECKING:
    from app.models.client import Client
    from app.models.invoice import Invoice


class Payment(Base):
    """Immutable ledger entry; recording one updates the invoice's paid/balance/status."""

    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    payment_method: Mapped[PaymentMethod] = mapped_column(enum_type(PaymentMethod), default=PaymentMethod.BANK_TRANSFER, nullable=False)
    reference_number: Mapped[str | None] = mapped_column(String(80))
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    invoice: Mapped["Invoice"] = relationship(viewonly=True)
    client: Mapped["Client"] = relationship(viewonly=True)

    @property
    def payment_number(self) -> str:
        return f"PAY-{self.id:05d}"

    @property
    def invoice_number(self) -> str:
        return self.invoice.invoice_number

    @property
    def client_name(self) -> str:
        return self.client.company_name

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_payments_amount_positive"),
        Index("ix_payments_invoice_id", "invoice_id"),
        Index("ix_payments_client_id", "client_id"),
        Index("ix_payments_company_date", "company_id", "payment_date"),
    )
