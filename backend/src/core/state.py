from datetime import date, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.books.models import (
    Author,
    Book,
    BookAuthor,
    BookChangeHistory,
    BookCopy,
    CopyStatusHistory,
)
from src.books.schemas import (
    AuthorResponse,
    BookCopyResponse,
    CopyStatusHistoryResponse,
)
from src.core.database import get_db
from src.core.schemas import CamelModel
from src.core.security import decode_token
from src.loans.models import Loan, LoanCorrectionHistory, LoanRenewal, RequestRecord
from src.users.dependencies import ACCESS_COOKIE_NAME, bearer_scheme
from src.users.models import StaffAccountHistory, User
from src.users.schemas import LibraryUserResponse, StaffAccountHistoryResponse

router = APIRouter()


class BookStateItem(CamelModel):
    book_id: int
    isbn: str | None
    title: str
    publisher: str | None
    publication_year: int | None
    category_code: str


class BookAuthorStateItem(CamelModel):
    book_id: int
    author_id: int


class LoanStateItem(CamelModel):
    loan_id: int
    member_user_id: int | None
    copy_id: int
    checked_out_by_user_id: int
    borrowed_at: datetime
    initial_due_date: date
    current_due_date: date
    returned_at: datetime | None
    returned_by_user_id: int | None
    is_cancelled: bool
    cancelled_at: datetime | None


class LoanRenewalStateItem(CamelModel):
    renewal_id: int
    loan_id: int
    renewed_at: datetime
    previous_due_date: date
    new_due_date: date


class BookChangeHistoryStateItem(CamelModel):
    book_change_id: int
    book_id: int
    changed_by_user_id: int
    changed_at: datetime
    before_values: dict[str, Any]
    after_values: dict[str, Any]


class LoanCorrectionHistoryStateItem(CamelModel):
    correction_id: int
    loan_id: int
    correction_type: str
    before_values: dict[str, Any]
    after_values: dict[str, Any]
    reason: str
    evidence_reference: str | None
    corrected_by_user_id: int
    corrected_at: datetime


class RequestRecordStateItem(CamelModel):
    request_id: str
    operation_type: str
    request_fingerprint: str
    processing_status: str
    result_code: str | None
    response_snapshot: dict[str, Any] | None
    actor_user_id: int | None
    target_loan_id: int | None
    requested_at: datetime
    completed_at: datetime | None


class LibraryDataResponse(CamelModel):
    """domain.ts의 LibraryData 인터페이스(12개 테이블)와 1:1 매핑"""

    users: list[LibraryUserResponse]
    books: list[BookStateItem]
    authors: list[AuthorResponse]
    book_authors: list[BookAuthorStateItem]
    copies: list[BookCopyResponse]
    loans: list[LoanStateItem]
    renewals: list[LoanRenewalStateItem]
    staff_history: list[StaffAccountHistoryResponse]
    book_history: list[BookChangeHistoryStateItem]
    copy_history: list[CopyStatusHistoryResponse]
    corrections: list[LoanCorrectionHistoryStateItem]
    requests: list[RequestRecordStateItem]


def _resolve_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
    db: Session,
) -> User | None:
    token = (
        credentials.credentials
        if credentials is not None and credentials.scheme.lower() == "bearer"
        else request.cookies.get(ACCESS_COOKIE_NAME)
    )
    if not token:
        return None
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access" or payload.get("sub") is None:
        return None
    user = db.get(User, int(payload["sub"]))
    if user is None or not user.is_active:
        return None
    return user


@router.get("/state", response_model=LibraryDataResponse)
def get_library_state(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> LibraryDataResponse:
    viewer = _resolve_optional_user(request, credentials, db)
    is_staff = viewer is not None and viewer.role in ("LIBRARIAN", "ADMIN")

    raw_users = list(db.scalars(select(User).order_by(User.user_id.asc())).all())
    users_out: list[LibraryUserResponse] = []
    for u in raw_users:
        item = LibraryUserResponse.model_validate(u)
        if not is_staff and (viewer is None or viewer.user_id != u.user_id):
            item.login_id = None
            item.full_name = None
            item.contact = None
        users_out.append(item)

    raw_loans = list(db.scalars(select(Loan).order_by(Loan.loan_id.desc())).all())
    if not is_staff:
        visible_loans = (
            [l for l in raw_loans if l.member_user_id == viewer.user_id]
            if viewer is not None
            else []
        )
    else:
        visible_loans = raw_loans

    visible_loan_ids = {l.loan_id for l in visible_loans}
    raw_renewals = list(
        db.scalars(select(LoanRenewal).order_by(LoanRenewal.renewal_id.asc())).all()
    )
    visible_renewals = (
        raw_renewals
        if is_staff
        else [r for r in raw_renewals if r.loan_id in visible_loan_ids]
    )

    return LibraryDataResponse(
        users=users_out,
        books=[
            BookStateItem.model_validate(b)
            for b in db.scalars(select(Book).order_by(Book.book_id.asc())).all()
        ],
        authors=[
            AuthorResponse.model_validate(a)
            for a in db.scalars(select(Author).order_by(Author.author_id.asc())).all()
        ],
        book_authors=[
            BookAuthorStateItem.model_validate(ba)
            for ba in db.scalars(select(BookAuthor)).all()
        ],
        copies=[
            BookCopyResponse.model_validate(c)
            for c in db.scalars(select(BookCopy).order_by(BookCopy.copy_id.asc())).all()
        ],
        loans=[LoanStateItem.model_validate(l) for l in visible_loans],
        renewals=[LoanRenewalStateItem.model_validate(r) for r in visible_renewals],
        staff_history=(
            [
                StaffAccountHistoryResponse.model_validate(sh)
                for sh in db.scalars(
                    select(StaffAccountHistory).order_by(
                        StaffAccountHistory.staff_history_id.asc()
                    )
                ).all()
            ]
            if viewer is not None and viewer.role == "ADMIN"
            else []
        ),
        book_history=(
            [
                BookChangeHistoryStateItem.model_validate(bh)
                for bh in db.scalars(
                    select(BookChangeHistory).order_by(
                        BookChangeHistory.book_change_id.asc()
                    )
                ).all()
            ]
            if is_staff
            else []
        ),
        copy_history=(
            [
                CopyStatusHistoryResponse.model_validate(ch)
                for ch in db.scalars(
                    select(CopyStatusHistory).order_by(
                        CopyStatusHistory.copy_status_history_id.asc()
                    )
                ).all()
            ]
            if is_staff
            else []
        ),
        corrections=(
            [
                LoanCorrectionHistoryStateItem.model_validate(lc)
                for lc in db.scalars(
                    select(LoanCorrectionHistory).order_by(
                        LoanCorrectionHistory.correction_id.asc()
                    )
                ).all()
            ]
            if is_staff
            else []
        ),
        requests=(
            [
                RequestRecordStateItem.model_validate(rr)
                for rr in db.scalars(
                    select(RequestRecord).order_by(RequestRecord.requested_at.asc())
                ).all()
            ]
            if is_staff
            else []
        ),
    )