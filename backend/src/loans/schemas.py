from datetime import date, datetime
from typing import Any, Literal

from pydantic import Field

from src.core.schemas import CamelModel


class DbFlowEventResponse(CamelModel):
    id: str
    run_id: str
    step: int
    created_at: datetime
    operation: Literal["SELECT", "INSERT", "UPDATE", "COMMIT", "ROLLBACK"]
    table_id: str | None = None
    column_ids: list[str] | None = None
    relation_id: str | None = None
    message: str
    status: Literal["pending", "active", "success", "failed"]
    before: Any = None
    after: Any = None


class LoanActionResponse(CamelModel):
    ok: bool
    message: str
    loan_id: int | None = None
    db_flow_events: list[DbFlowEventResponse] = Field(default_factory=list)


class CheckoutRequest(CamelModel):
    member_user_id: int
    copy_id: int
    request_id: str | None = None


class ReturnLoanRequest(CamelModel):
    damaged: bool = False
    reason: str = ""
    request_id: str | None = None


class RenewLoanRequest(CamelModel):
    request_id: str | None = None


class CorrectLoanRequest(CamelModel):
    type: Literal[
        "CANCEL_LOAN",
        "UNDO_RETURN",
        "CORRECT_DUE_DATE",
        "CORRECT_RETURNED_AT",
    ]
    reason: str = Field(min_length=1)
    evidence: str | None = None
    value: str | None = None
    physical_confirmed: bool = False
    request_id: str | None = None


class LoanItemResponse(CamelModel):
    loan_id: int
    member_user_id: int | None
    copy_id: int
    copy_code: str
    book_id: int
    book_title: str
    checked_out_by_user_id: int
    borrowed_at: datetime
    initial_due_date: date
    current_due_date: date
    returned_at: datetime | None
    returned_by_user_id: int | None
    is_cancelled: bool
    cancelled_at: datetime | None
    renewal_count: int
    is_overdue: bool
    overdue_days: int