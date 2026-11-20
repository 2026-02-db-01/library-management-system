from datetime import date, datetime
from typing import Any

from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class Loan(Base):
    __tablename__ = "loan"

    loan_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("app_user.user_id", ondelete="RESTRICT"),
        nullable=True,
    )
    copy_id: Mapped[int] = mapped_column(ForeignKey("book_copy.copy_id", ondelete="RESTRICT"), nullable=False)
    checked_out_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("app_user.user_id", ondelete="RESTRICT"),
        nullable=False,
    )
    borrowed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    initial_due_date: Mapped[date] = mapped_column(Date, nullable=False)
    current_due_date: Mapped[date] = mapped_column(Date, nullable=False)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    returned_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("app_user.user_id", ondelete="RESTRICT"),
        nullable=True,
    )
    is_cancelled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class LoanRenewal(Base):
    __tablename__ = "loan_renewal"

    renewal_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    loan_id: Mapped[int] = mapped_column(ForeignKey("loan.loan_id", ondelete="RESTRICT"), unique=True, nullable=False)
    renewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    previous_due_date: Mapped[date] = mapped_column(Date, nullable=False)
    new_due_date: Mapped[date] = mapped_column(Date, nullable=False)


class LoanCorrectionHistory(Base):
    __tablename__ = "loan_correction_history"

    correction_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    loan_id: Mapped[int] = mapped_column(ForeignKey("loan.loan_id", ondelete="RESTRICT"), nullable=False)
    correction_type: Mapped[str] = mapped_column(String(32), nullable=False)
    before_values: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    after_values: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_reference: Mapped[str | None] = mapped_column(Text, nullable=True)
    corrected_by_user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="RESTRICT"), nullable=False)
    corrected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class RequestRecord(Base):
    __tablename__ = "request_record"

    request_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True)
    operation_type: Mapped[str] = mapped_column(String(16), nullable=False)
    request_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    processing_status: Mapped[str] = mapped_column(String(16), nullable=False, default="PENDING")
    result_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    response_snapshot: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    actor_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("app_user.user_id", ondelete="RESTRICT"),
        nullable=True,
    )
    target_loan_id: Mapped[int | None] = mapped_column(
        ForeignKey("loan.loan_id", ondelete="RESTRICT"),
        nullable=True,
    )
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)