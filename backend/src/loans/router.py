from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.loans import service
from src.loans.schemas import (
    CheckoutRequest,
    CorrectLoanRequest,
    LoanActionResponse,
    LoanItemResponse,
    RenewLoanRequest,
    ReturnLoanRequest,
)
from src.users.dependencies import CurrentUser, LibrarianUser

router = APIRouter()


@router.get("/me", response_model=list[LoanItemResponse])
def get_my_loans(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    activeOnly: bool = False,
) -> list[LoanItemResponse]:
    return service.list_loans(
        db=db,
        member_user_id=current_user.user_id,
        active_only=activeOnly,
    )


@router.get("", response_model=list[LoanItemResponse])
def get_all_loans(
    _: LibrarianUser,
    db: Annotated[Session, Depends(get_db)],
    memberUserId: int | None = None,
    activeOnly: bool = False,
    overdueOnly: bool = False,
) -> list[LoanItemResponse]:
    return service.list_loans(
        db=db,
        member_user_id=memberUserId,
        active_only=activeOnly,
        overdue_only=overdueOnly,
    )


@router.post("/checkout", response_model=LoanActionResponse, status_code=status.HTTP_201_CREATED)
def checkout(
    payload: CheckoutRequest,
    librarian: LibrarianUser,
    db: Annotated[Session, Depends(get_db)],
) -> LoanActionResponse:
    return service.checkout_book(db, payload, librarian.user_id)


@router.post("/{loan_id}/return", response_model=LoanActionResponse)
def return_book(
    loan_id: int,
    payload: ReturnLoanRequest,
    librarian: LibrarianUser,
    db: Annotated[Session, Depends(get_db)],
) -> LoanActionResponse:
    return service.return_loan(db, loan_id, payload, librarian.user_id)


@router.post("/{loan_id}/renew", response_model=LoanActionResponse)
def renew_book(
    loan_id: int,
    payload: RenewLoanRequest,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> LoanActionResponse:
    return service.renew_loan(db, loan_id, payload, current_user.user_id)


@router.post("/{loan_id}/correct", response_model=LoanActionResponse)
def correct_book_loan(
    loan_id: int,
    payload: CorrectLoanRequest,
    librarian: LibrarianUser,
    db: Annotated[Session, Depends(get_db)],
) -> LoanActionResponse:
    return service.correct_loan(db, loan_id, payload, librarian.user_id)