import hashlib
import json
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.books.models import Book, BookCopy, CopyStatusHistory
from src.books.service import contains_patron_identity
from src.core.exceptions import ConflictException, ForbiddenException
from src.loans.models import Loan, LoanCorrectionHistory, LoanRenewal, RequestRecord
from src.loans.schemas import (
    CheckoutRequest,
    CorrectLoanRequest,
    DbFlowEventResponse,
    LoanActionResponse,
    LoanItemResponse,
    RenewLoanRequest,
    ReturnLoanRequest,
)
from src.users.models import User

KST = timezone(timedelta(hours=9))
MAX_ACTIVE_LOANS = 5
DEFAULT_LOAN_DAYS = 14
RENEWAL_EXTEND_DAYS = 7
MAX_RENEWALS_PER_LOAN = 1


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _kst_date(dt: datetime | None = None) -> date:
    target = dt if dt is not None else _now_utc()
    return target.astimezone(KST).date()


def _is_active_loan(loan: Loan) -> bool:
    return not loan.is_cancelled and loan.returned_at is None


def _is_overdue(loan: Loan, today: date | None = None) -> bool:
    ref_date = today if today is not None else _kst_date()
    return _is_active_loan(loan) and loan.current_due_date < ref_date


def _overdue_days(loan: Loan, today: date | None = None) -> int:
    if loan.is_cancelled:
        return 0
    actual_date = _kst_date(loan.returned_at) if loan.returned_at is not None else (
        today if today is not None else _kst_date()
    )
    if actual_date <= loan.current_due_date:
        return 0
    return (actual_date - loan.current_due_date).days


def _recalculate_member_suspension(db: Session, member: User) -> datetime | None:
    """회원의 유효 연체 반납 이력을 기준으로 신규 대출 정지 종료 시각을 재계산합니다."""
    if member.role != "MEMBER" or member.account_status != "ACTIVE":
        member.borrowing_suspended_until = None
        return None

    returned_loans = list(
        db.scalars(
            select(Loan).where(
                Loan.member_user_id == member.user_id,
                Loan.is_cancelled.is_(False),
                Loan.returned_at.is_not(None),
            )
        ).all()
    )
    suspend_until_candidates: list[datetime] = []
    for loan in returned_loans:
        days = _overdue_days(loan)
        if days > 0 and loan.returned_at is not None:
            suspend_until_candidates.append(loan.returned_at + timedelta(days=days))

    member.borrowing_suspended_until = (
        max(suspend_until_candidates) if suspend_until_candidates else None
    )
    return member.borrowing_suspended_until


def _lock_loan(db: Session, loan_id: int) -> Loan | None:
    # Order matches checkout and withdrawal: member, then loan, then copy.
    member_id = db.scalar(select(Loan.member_user_id).where(Loan.loan_id == loan_id))
    if member_id is not None:
        db.scalar(
            select(User).where(User.user_id == member_id)
            .with_for_update().execution_options(populate_existing=True)
        )
    return db.scalar(
        select(Loan).where(Loan.loan_id == loan_id)
        .with_for_update().execution_options(populate_existing=True)
    )


def _loan_snapshot(loan: Loan | None) -> dict[str, Any]:
    if loan is None:
        return {}
    return {
        "returned_at": loan.returned_at.isoformat() if loan.returned_at else None,
        "returned_by_user_id": loan.returned_by_user_id,
        "current_due_date": loan.current_due_date.isoformat(),
        "is_cancelled": loan.is_cancelled,
        "cancelled_at": loan.cancelled_at.isoformat() if loan.cancelled_at else None,
    }


def _validate_and_hash_request(
    db: Session,
    operation: str,
    target_loan_id: int | None,
    actor_user_id: int,
    raw_request_id: str | None,
    payload_dict: dict[str, Any],
    expected_member_id: int | None = None,
) -> tuple[str, str, RequestRecord | None]:
    """요청 UUID 형식과 SHA-256 지문을 검증하고 기존 멱등성 기록을 조회합니다."""
    for val in payload_dict.values():
        if isinstance(val, str) and val.strip() and contains_patron_identity(db, val):
            raise ForbiddenException(
                code="PATRON_PII_FORBIDDEN",
                message="사유·증빙에는 회원 이름·ID·연락처를 넣을 수 없습니다. 비식별 업무 사실만 입력하세요.",
            )

    req_id = raw_request_id.strip() if raw_request_id else str(uuid.uuid4())
    try:
        parsed_uuid = uuid.UUID(req_id)
        req_id = str(parsed_uuid)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_REQUEST_ID", "message": "요청 ID는 UUID여야 합니다."},
        ) from exc

    canonical = json.dumps(
        {"operation": operation, "target": target_loan_id, **payload_dict},
        sort_keys=True,
        ensure_ascii=False,
        default=str,
    )
    fingerprint = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    lock_key = int.from_bytes(parsed_uuid.bytes[:8], byteorder="big", signed=True)
    db.execute(select(func.pg_advisory_xact_lock(lock_key)))
    prior = db.get(RequestRecord, req_id)
    if prior is not None:
        if prior.actor_user_id != actor_user_id or prior.request_fingerprint != fingerprint:
            raise ConflictException(
                code="REQUEST_ID_CONFLICT",
                message="요청 ID 충돌: 요청자 또는 내용이 다릅니다.",
            )
        if expected_member_id is not None and prior.target_loan_id is not None:
            prior_loan = db.get(Loan, prior.target_loan_id)
            if prior_loan is not None and prior_loan.member_user_id != expected_member_id:
                raise ConflictException(
                    code="REQUEST_ID_CONFLICT",
                    message="요청 ID 충돌: 대상 회원이 다릅니다.",
                )
        if prior.processing_status != "COMPLETED":
            raise ConflictException(
                code="INCOMPLETE_REQUEST",
                message="완료되지 않은 요청입니다. 다시 확인하세요.",
            )

    return req_id, fingerprint, prior


def _build_flow_events(
    operation: str,
    message: str,
    before_snap: dict[str, Any],
    after_snap: dict[str, Any],
) -> list[DbFlowEventResponse]:
    run_id = str(uuid.uuid4())
    now = _now_utc()
    raw_steps: list[dict[str, Any]] = [
        {
            "operation": "SELECT",
            "table_id": "loan",
            "column_ids": ["is_cancelled", "returned_at", "current_due_date"],
            "message": f"{operation}: 현재 유효 상태·권한 검사",
            "status": "success",
        },
        {
            "operation": "INSERT" if operation == "CHECKOUT" else "UPDATE",
            "table_id": "loan",
            "message": f"{operation}: {message}",
            "status": "success",
            "before": before_snap,
            "after": after_snap,
        },
    ]

    if operation in ("RENEW", "CORRECT"):
        raw_steps.append(
            {
                "operation": "INSERT",
                "table_id": "loan_renewal" if operation == "RENEW" else "loan_correction_history",
                "relation_id": (
                    "loan-loan_renewal"
                    if operation == "RENEW"
                    else "loan-loan_correction_history-loan_id"
                ),
                "message": f"{'연장' if operation == 'RENEW' else '정정'} 이력 저장",
                "status": "success",
            }
        )

    if operation == "RETURN":
        raw_steps.append(
            {
                "operation": "UPDATE",
                "table_id": "app_user",
                "column_ids": ["borrowing_suspended_until"],
                "message": "유효한 연체 반납 기준 정지 종료시각 재계산",
                "status": "success",
            }
        )

    raw_steps.append(
        {
            "operation": "INSERT",
            "table_id": "request_record",
            "message": "비식별 요청 결과 기록",
            "status": "success",
        }
    )
    raw_steps.append(
        {
            "operation": "COMMIT",
            "message": message,
            "status": "success",
        }
    )

    return [
        DbFlowEventResponse(
            id=f"{run_id}-{idx}",
            run_id=run_id,
            step=idx + 1,
            created_at=now,
            **step,
        )
        for idx, step in enumerate(raw_steps)
    ]


def checkout_book(
    db: Session,
    payload: CheckoutRequest,
    librarian_id: int,
) -> LoanActionResponse:
    req_id, fingerprint, prior = _validate_and_hash_request(
        db=db,
        operation="CHECKOUT",
        target_loan_id=None,
        actor_user_id=librarian_id,
        raw_request_id=payload.request_id,
        payload_dict={"copyId": payload.copy_id},
        expected_member_id=payload.member_user_id,
    )
    if prior is not None:
        return LoanActionResponse(
            ok=True,
            message="이미 완료된 동일 대출 요청입니다.",
            loan_id=prior.target_loan_id,
        )

    # 동시 대출 경합 방지를 위해 회원 및 소장본 행 잠금
    member = db.scalar(
        select(User).where(User.user_id == payload.member_user_id).with_for_update()
    )
    if member is None or member.role != "MEMBER" or member.account_status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_MEMBER", "message": "활성 회원을 선택하세요."},
        )

    active_member_loans = list(
        db.scalars(
            select(Loan).where(
                Loan.member_user_id == member.user_id,
                Loan.is_cancelled.is_(False),
                Loan.returned_at.is_(None),
            )
        ).all()
    )
    if len(active_member_loans) >= MAX_ACTIVE_LOANS:
        raise ConflictException(
            code="MAX_LOANS_EXCEEDED",
            message="회원당 최대 5권입니다. 6번째 대출은 불가합니다.",
        )

    today = _kst_date()
    if any(_is_overdue(loan, today) for loan in active_member_loans):
        raise ForbiddenException(
            code="OVERDUE_BLOCKED",
            message="현재 연체 중이므로 신규 대출이 불가합니다.",
        )

    now = _now_utc()
    suspended_until = _recalculate_member_suspension(db, member)
    if suspended_until is not None and suspended_until > now:
        raise ForbiddenException(
            code="SUSPENDED_MEMBER",
            message=f"신규 대출 정지 기간: {suspended_until.astimezone(KST).strftime('%Y-%m-%d %H:%M')}",
        )

    copy = db.scalar(
        select(BookCopy).where(BookCopy.copy_id == payload.copy_id).with_for_update()
    )
    copy_in_use = db.scalar(
        select(Loan).where(
            Loan.copy_id == payload.copy_id,
            Loan.is_cancelled.is_(False),
            Loan.returned_at.is_(None),
        )
    )
    if copy is None or copy.management_status != "ACTIVE" or copy_in_use is not None:
        raise ConflictException(
            code="COPY_UNAVAILABLE",
            message="정상 상태의 미대출 소장본만 대출 가능합니다.",
        )

    due_date = today + timedelta(days=DEFAULT_LOAN_DAYS)
    loan = Loan(
        member_user_id=member.user_id,
        copy_id=copy.copy_id,
        checked_out_by_user_id=librarian_id,
        borrowed_at=now,
        initial_due_date=due_date,
        current_due_date=due_date,
        returned_at=None,
        returned_by_user_id=None,
        is_cancelled=False,
        cancelled_at=None,
    )
    db.add(loan)
    db.flush()

    msg = f"대출 완료 · 반납예정일 {due_date.isoformat()}"
    db.add(
        RequestRecord(
            request_id=req_id,
            operation_type="CHECKOUT",
            request_fingerprint=fingerprint,
            processing_status="COMPLETED",
            result_code="OK",
            response_snapshot={"ok": True, "loanId": loan.loan_id},
            actor_user_id=librarian_id,
            target_loan_id=loan.loan_id,
            requested_at=now,
            completed_at=now,
        )
    )
    after_snap = _loan_snapshot(loan)
    db.commit()

    return LoanActionResponse(
        ok=True,
        message=msg,
        loan_id=loan.loan_id,
        db_flow_events=_build_flow_events("CHECKOUT", msg, {}, after_snap),
    )


def return_loan(
    db: Session,
    loan_id: int,
    payload: ReturnLoanRequest,
    librarian_id: int,
) -> LoanActionResponse:
    req_id, fingerprint, prior = _validate_and_hash_request(
        db=db,
        operation="RETURN",
        target_loan_id=loan_id,
        actor_user_id=librarian_id,
        raw_request_id=payload.request_id,
        payload_dict={"damaged": payload.damaged, "reason": payload.reason},
    )
    if prior is not None:
        return LoanActionResponse(
            ok=True,
            message="이미 완료된 동일 반납 요청입니다.",
            loan_id=loan_id,
        )

    loan = _lock_loan(db, loan_id)
    if loan is None or not _is_active_loan(loan):
        raise ConflictException(
            code="INVALID_ACTIVE_LOAN",
            message="유효한 미반납 대출이 아닙니다. 중복 반납 불가.",
        )

    if payload.damaged and not payload.reason.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "DAMAGE_REASON_REQUIRED", "message": "파손 사유가 필요합니다."},
        )

    before_snap = _loan_snapshot(loan)
    now = _now_utc()
    loan.returned_at = now
    loan.returned_by_user_id = librarian_id

    # [교체 1] 이미 DAMAGED 상태가 아닐 때만 상태 변경 및 이력 기록
    if payload.damaged:
        copy = db.scalar(
            select(BookCopy).where(BookCopy.copy_id == loan.copy_id).with_for_update()
        )
        if copy is not None and copy.management_status != "DAMAGED":
            db.add(
                CopyStatusHistory(
                    copy_id=copy.copy_id,
                    previous_status=copy.management_status,
                    new_status="DAMAGED",
                    reason=payload.reason.strip(),
                    changed_by_user_id=librarian_id,
                    related_loan_id=loan.loan_id,
                    changed_at=now,
                )
            )
            copy.management_status = "DAMAGED"

    db.flush()
    if loan.member_user_id is not None:
        member = db.get(User, loan.member_user_id)
        if member is not None:
            _recalculate_member_suspension(db, member)

    # [교체 2] 일반 반납과 파손 반납 완료 메시지 구분
    msg = (
        "파손 반납 완료 · 소장본 상태를 DAMAGED로 변경했습니다."
        if payload.damaged
        else "반납 완료 · 신규 대출 정지를 재계산했습니다."
    )
    db.add(
        RequestRecord(
            request_id=req_id,
            operation_type="RETURN",
            request_fingerprint=fingerprint,
            processing_status="COMPLETED",
            result_code="OK",
            response_snapshot={"ok": True, "loanId": loan.loan_id},
            actor_user_id=librarian_id,
            target_loan_id=loan.loan_id,
            requested_at=now,
            completed_at=now,
        )
    )
    after_snap = _loan_snapshot(loan)
    db.commit()

    return LoanActionResponse(
        ok=True,
        message=msg,
        loan_id=loan.loan_id,
        db_flow_events=_build_flow_events("RETURN", msg, before_snap, after_snap),
    )


def renew_loan(
    db: Session,
    loan_id: int,
    payload: RenewLoanRequest,
    member_id: int,
) -> LoanActionResponse:
    req_id, fingerprint, prior = _validate_and_hash_request(
        db=db,
        operation="RENEW",
        target_loan_id=loan_id,
        actor_user_id=member_id,
        raw_request_id=payload.request_id,
        payload_dict={},
    )
    if prior is not None:
        return LoanActionResponse(
            ok=True,
            message="이미 완료된 동일 연장 요청입니다.",
            loan_id=loan_id,
        )

    loan = _lock_loan(db, loan_id)
    today = _kst_date()

    if loan is None or loan.member_user_id != member_id or not _is_active_loan(loan):
        raise ConflictException(
            code="RENEWAL_NOT_ALLOWED",
            message="본인 대출·미반납·전체 비연체·연장 0회 조건을 확인하세요.",
        )

    renewal_count = (
        db.scalar(
            select(func.count()).select_from(LoanRenewal).where(LoanRenewal.loan_id == loan_id)
        )
        or 0
    )
    if renewal_count >= MAX_RENEWALS_PER_LOAN or _is_overdue(loan, today):
        raise ConflictException(
            code="RENEWAL_NOT_ALLOWED",
            message="본인 대출·미반납·전체 비연체·연장 0회 조건을 확인하세요.",
        )

    member_active_loans = list(
        db.scalars(
            select(Loan).where(
                Loan.member_user_id == member_id,
                Loan.is_cancelled.is_(False),
                Loan.returned_at.is_(None),
            )
        ).all()
    )
    if any(_is_overdue(item, today) for item in member_active_loans):
        raise ForbiddenException(
            code="OVERDUE_RENEWAL_BLOCKED",
            message="본인 대출·미반납·전체 비연체·연장 0회 조건을 확인하세요.",
        )

    before_snap = _loan_snapshot(loan)
    now = _now_utc()
    previous_due = loan.current_due_date
    new_due = previous_due + timedelta(days=RENEWAL_EXTEND_DAYS)
    loan.current_due_date = new_due

    db.add(
        LoanRenewal(
            loan_id=loan.loan_id,
            renewed_at=now,
            previous_due_date=previous_due,
            new_due_date=new_due,
        )
    )

    msg = f"7일 연장 완료 · {new_due.isoformat()}"
    db.add(
        RequestRecord(
            request_id=req_id,
            operation_type="RENEW",
            request_fingerprint=fingerprint,
            processing_status="COMPLETED",
            result_code="OK",
            response_snapshot={"ok": True, "loanId": loan.loan_id},
            actor_user_id=member_id,
            target_loan_id=loan.loan_id,
            requested_at=now,
            completed_at=now,
        )
    )
    after_snap = _loan_snapshot(loan)
    db.commit()

    return LoanActionResponse(
        ok=True,
        message=msg,
        loan_id=loan.loan_id,
        db_flow_events=_build_flow_events("RENEW", msg, before_snap, after_snap),
    )


def correct_loan(
    db: Session,
    loan_id: int,
    payload: CorrectLoanRequest,
    librarian_id: int,
) -> LoanActionResponse:
    req_id, fingerprint, prior = _validate_and_hash_request(
        db=db,
        operation="CORRECT",
        target_loan_id=loan_id,
        actor_user_id=librarian_id,
        raw_request_id=payload.request_id,
        payload_dict={
            "type": payload.type,
            "reason": payload.reason,
            "evidence": payload.evidence or "",
            "value": payload.value or "",
            "physicalConfirmed": payload.physical_confirmed,
        },
    )
    if prior is not None:
        return LoanActionResponse(
            ok=True,
            message="이미 완료된 동일 정정 요청입니다.",
            loan_id=loan_id,
        )

    loan = _lock_loan(db, loan_id)
    if loan is None or loan.is_cancelled or not payload.reason.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_CORRECTION", "message": "유효한 대출과 정정 사유가 필요합니다."},
        )

    before_snap = _loan_snapshot(loan)
    now = _now_utc()

    if payload.type == "CANCEL_LOAN":
        if not payload.physical_confirmed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "PHYSICAL_CONFIRM_REQUIRED",
                    "message": "실물 회수·미반출 확인 후 취소하세요.",
                },
            )
        loan.is_cancelled = True
        loan.cancelled_at = now
    elif payload.type == "UNDO_RETURN":
        if loan.returned_at is None or loan.member_user_id is None:
            raise ConflictException(
                code="UNDO_RETURN_NOT_ALLOWED",
                message="탈퇴 회원 또는 미반납 건은 반납 취소할 수 없습니다.",
            )
        member = db.get(User, loan.member_user_id)
        if member is None or member.role != "MEMBER" or member.account_status != "ACTIVE":
            raise ConflictException(
                code="UNDO_RETURN_NOT_ALLOWED",
                message="탈퇴 회원 또는 미반납 건은 반납 취소할 수 없습니다.",
            )

        copy = db.scalar(select(BookCopy).where(BookCopy.copy_id == loan.copy_id).with_for_update())
        if copy is not None and copy.management_status == "RETIRED":
            raise ConflictException(
                code="RETIRED_COPY",
                message="제적된 소장본의 반납 기록은 복원할 수 없습니다.",
            )

        subsequent_loan = db.scalar(
            select(Loan).where(
                Loan.loan_id != loan.loan_id,
                Loan.copy_id == loan.copy_id,
                Loan.is_cancelled.is_(False),
                Loan.borrowed_at >= loan.returned_at,
            )
        )
        if subsequent_loan is not None:
            raise ConflictException(
                code="SUBSEQUENT_LOAN_EXISTS",
                message="반납 이후 유효한 재대출 이력이 있어 복원할 수 없습니다.",
            )

        member_active_count = (
            db.scalar(
                select(func.count())
                .select_from(Loan)
                .where(
                    Loan.member_user_id == loan.member_user_id,
                    Loan.is_cancelled.is_(False),
                    Loan.returned_at.is_(None),
                )
            )
            or 0
        )
        copy_active = db.scalar(
            select(Loan).where(
                Loan.copy_id == loan.copy_id,
                Loan.is_cancelled.is_(False),
                Loan.returned_at.is_(None),
            )
        )
        if member_active_count >= MAX_ACTIVE_LOANS or copy_active is not None:
            raise ConflictException(
                code="UNDO_CONFLICT",
                message="복원 시 5권 한도 또는 소장본 점유가 충돌합니다.",
            )

        loan.returned_at = None
        loan.returned_by_user_id = None
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "UNSUPPORTED_CORRECTION_TYPE",
                "message": "날짜 정정은 Wiki 세부 운영·증빙 정책 확정 전까지 제한합니다. 원본을 유지합니다.",
            },
        )

    db.flush()
    if loan.member_user_id is not None:
        member = db.get(User, loan.member_user_id)
        if member is not None:
            _recalculate_member_suspension(db, member)

    after_snap = _loan_snapshot(loan)
    db.add(
        LoanCorrectionHistory(
            loan_id=loan.loan_id,
            correction_type=payload.type,
            before_values=before_snap,
            after_values=after_snap,
            reason=payload.reason.strip(),
            evidence_reference=payload.evidence.strip() if payload.evidence and payload.evidence.strip() else None,
            corrected_by_user_id=librarian_id,
            corrected_at=now,
        )
    )

    msg = "정정 완료 · 변경 전후 이력을 보존했습니다."
    db.add(
        RequestRecord(
            request_id=req_id,
            operation_type="CORRECT",
            request_fingerprint=fingerprint,
            processing_status="COMPLETED",
            result_code="OK",
            response_snapshot={"ok": True, "loanId": loan.loan_id},
            actor_user_id=librarian_id,
            target_loan_id=loan.loan_id,
            requested_at=now,
            completed_at=now,
        )
    )
    db.commit()

    return LoanActionResponse(
        ok=True,
        message=msg,
        loan_id=loan.loan_id,
        db_flow_events=_build_flow_events("CORRECT", msg, before_snap, after_snap),
    )


def list_loans(
    db: Session,
    member_user_id: int | None = None,
    active_only: bool = False,
    overdue_only: bool = False,
) -> list[LoanItemResponse]:
    stmt = (
        select(Loan, BookCopy, Book)
        .join(BookCopy, BookCopy.copy_id == Loan.copy_id)
        .join(Book, Book.book_id == BookCopy.book_id)
        .order_by(Loan.loan_id.desc())
    )
    if member_user_id is not None:
        stmt = stmt.where(Loan.member_user_id == member_user_id)
    if active_only or overdue_only:
        stmt = stmt.where(Loan.is_cancelled.is_(False), Loan.returned_at.is_(None))

    rows = db.execute(stmt).all()
    today = _kst_date()

    renewal_counts = dict(
        db.execute(
            select(LoanRenewal.loan_id, func.count(LoanRenewal.renewal_id)).group_by(
                LoanRenewal.loan_id
            )
        ).all()
    )

    items: list[LoanItemResponse] = []
    for loan, copy, book in rows:
        overdue = _is_overdue(loan, today)
        if overdue_only and not overdue:
            continue
        items.append(
            LoanItemResponse(
                loan_id=loan.loan_id,
                member_user_id=loan.member_user_id,
                copy_id=loan.copy_id,
                copy_code=copy.copy_code,
                book_id=book.book_id,
                book_title=book.title,
                checked_out_by_user_id=loan.checked_out_by_user_id,
                borrowed_at=loan.borrowed_at,
                initial_due_date=loan.initial_due_date,
                current_due_date=loan.current_due_date,
                returned_at=loan.returned_at,
                returned_by_user_id=loan.returned_by_user_id,
                is_cancelled=loan.is_cancelled,
                cancelled_at=loan.cancelled_at,
                renewal_count=renewal_counts.get(loan.loan_id, 0),
                is_overdue=overdue,
                overdue_days=_overdue_days(loan, today),
            )
        )
    return items