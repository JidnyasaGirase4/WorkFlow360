from sqlalchemy import BigInteger, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import DocumentCategory, DocumentVisibility
from app.database.base import Base, TimestampMixin, enum_type


class Document(Base, TimestampMixin):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)  # display name
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)  # original upload name
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)  # safe path relative to UPLOAD_DIR
    file_type: Mapped[str] = mapped_column(String(120), nullable=False)  # MIME type
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    category: Mapped[DocumentCategory] = mapped_column(enum_type(DocumentCategory), default=DocumentCategory.OTHER, nullable=False)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id", ondelete="SET NULL"))
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"))
    employee_id: Mapped[int | None] = mapped_column(ForeignKey("employees.id", ondelete="SET NULL"))
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    visibility: Mapped[DocumentVisibility] = mapped_column(enum_type(DocumentVisibility), default=DocumentVisibility.PRIVATE, nullable=False)

    # read-only joins so list/detail output can carry display names without N+1 queries
    uploader: Mapped["User | None"] = relationship("User", foreign_keys=[uploaded_by], lazy="joined", viewonly=True)
    client: Mapped["Client | None"] = relationship("Client", foreign_keys=[client_id], lazy="joined", viewonly=True)
    project: Mapped["Project | None"] = relationship("Project", foreign_keys=[project_id], lazy="joined", viewonly=True)

    __table_args__ = (
        Index("ix_documents_company_category", "company_id", "category"),
        Index("ix_documents_client_id", "client_id"),
        Index("ix_documents_project_id", "project_id"),
        Index("ix_documents_employee_id", "employee_id"),
    )
