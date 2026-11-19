from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.books.service import contains_patron_identity
from src.core.exceptions import ConflictException, ForbiddenException, UnauthorizedException
from src.core.security import hash_password, verify_password
from src.loans.models import Loan, RequestRecord
from src.users.models import StaffAccountHistory, User
from src.users.schemas import (
    LibraryUserResponse,
    LoginRequest,
    ProfileUpdateRequest,
    SignupRequest,
    StaffCreateRequest,
    StaffStatusUpdateRequest,
    UserActionResponse,
)


def _check_contact_uniqueness(
    db: Session,
    role: str,
    contact: str,
    exclude_user_id: int | None = None,
) -> None:
    if role != "MEMBER":
        return
    stmt = select(User).where(
        User.role == "MEMBER",
        User.account_status == "ACTIVE",
        User.contact == contact,
    )
    if exclude_user_id is not None:
        stmt = stmt.where(User.user_id != exclude_user_id)
    if db.scalar(stmt) is not None:
        raise ConflictException(
            code="DUPLICATE_CONTACT",
            message="활성 회원이 사용 중인 연락처입니다.",
        )


def signup_member(db: Session, payload: SignupRequest) -> User:
    existing_login = db.scalar(select(User).where(User.login_id == payload.login_id))
    if existing_login is not None:
        raise ConflictException(
            code="DUPLICATE_LOGIN_ID",
            message="이미 사용 중인 로그인 ID입니다.",
        )

    _check_contact_uniqueness(db, role="MEMBER", contact=payload.contact)

    user = User(
        login_id=payload.login_id,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        contact=payload.contact,
        role="MEMBER",
        account_status="ACTIVE",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, payload: LoginRequest) -> User:
    user = db.scalar(select(User).where(User.login_id == payload.login_id))
    if user is None or not user.password_hash:
        raise UnauthorizedException(
            code="INVALID_CREDENTIALS",
            message="아이디 또는 비밀번호가 올바르지 않습니다.",
        )

    if not verify_password(payload.password, user.password_hash):
        raise UnauthorizedException(
            code="INVALID_CREDENTIALS",
            message="아이디 또는 비밀번호가 올바르지 않습니다.",
        )

    if user.account_status != "ACTIVE":
        raise ForbiddenException(
            code="INACTIVE_ACCOUNT",
            message="비활성화되었거나 탈퇴한 계정입니다.",
        )

    return user


def update_own_profile(
    db: Session,
    current_user: User,
    payload: ProfileUpdateRequest,
) -> UserActionResponse:
    _check_contact_uniqueness(
        db,
        role=current_user.role,
        contact=payload.contact,
        exclude_user_id=current_user.user_id,
    )
    current_user.full_name = payload.full_name
    current_user.contact = payload.contact
    db.commit()
    db.refresh(current_user)

    return UserActionResponse(
        ok=True,
        message="본인 정보를 수정했습니다. 이전 개인정보는 저장하지 않습니다.",
        user=LibraryUserResponse.model_validate(current_user),
    )


def withdraw_member_account(db: Session, current_user: User) -> UserActionResponse:
    if current_user.role != "MEMBER" or current_user.account_status != "ACTIVE":
        raise ForbiddenException(
            code="MEMBER_ONLY_ACTION",
            message="활성 회원 본인만 탈퇴할 수 있습니다.",
        )

    active_loan = db.scalar(
        select(Loan).where(
            Loan.member_user_id == current_user.user_id,
            Loan.is_cancelled.is_(False),
            Loan.returned_at.is_(None),
        )
    )
    if active_loan is not None:
        raise ConflictException(
            code="ACTIVE_LOANS_EXIST",
            message="미반납 도서를 모두 반납한 후 탈퇴하세요.",
        )

    # 이력 테이블(loan_correction_history, copy_status_history, staff_account_history)은
    # 고치지 않는다: DB 가 library_app 의 UPDATE 를 막아 둔 append-only 테이블이고,
    # 사유·증빙에 회원 개인정보가 들어가는 것은 입력 시 contains_patron_identity 로 막는다.
    # 탈퇴 시에는 대출·요청 기록의 회원 연결만 끊고 app_user 개인정보를 지운다.
    for loan in db.scalars(
        select(Loan).where(Loan.member_user_id == current_user.user_id)
    ).all():
        loan.member_user_id = None

    for req in db.scalars(
        select(RequestRecord).where(RequestRecord.actor_user_id == current_user.user_id)
    ).all():
        req.actor_user_id = None
        req.response_snapshot = {"ok": True}

    current_user.login_id = None
    current_user.password_hash = None
    current_user.full_name = None
    current_user.contact = None
    current_user.borrowing_suspended_until = None
    current_user.account_status = "WITHDRAWN"

    db.commit()
    return UserActionResponse(
        ok=True,
        message="탈퇴 완료 · 개인정보와 과거 대출의 회원 연결을 제거했습니다.",
        user=None,
    )


def list_all_users(db: Session) -> list[User]:
    return list(db.scalars(select(User).order_by(User.user_id.asc())).all())


def create_staff_account(
    db: Session,
    payload: StaffCreateRequest,
    admin_user_id: int,
) -> UserActionResponse:
    existing_login = db.scalar(select(User).where(User.login_id == payload.login_id))
    if existing_login is not None:
        raise ConflictException(
            code="DUPLICATE_LOGIN_ID",
            message="이미 사용 중인 로그인 ID입니다.",
        )

    staff = User(
        login_id=payload.login_id,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        contact=payload.contact,
        role=payload.role,
        account_status="ACTIVE",
        borrowing_suspended_until=None,
    )
    db.add(staff)
    db.flush()

    db.add(
        StaffAccountHistory(
            target_staff_user_id=staff.user_id,
            action_type="CREATE",
            previous_status=None,
            new_status="ACTIVE",
            role_at_creation=payload.role,
            reason=None,
            processed_by_admin_user_id=admin_user_id,
        )
    )
    db.commit()
    db.refresh(staff)

    return UserActionResponse(
        ok=True,
        message="직원 계정을 생성하고 이력을 저장했습니다.",
        user=LibraryUserResponse.model_validate(staff),
    )


def toggle_staff_account_status(
    db: Session,
    target_user_id: int,
    payload: StaffStatusUpdateRequest,
    admin_user_id: int,
) -> UserActionResponse:
    target = db.scalar(select(User).where(User.user_id == target_user_id).with_for_update())
    if target is None or target.role == "MEMBER" or target.account_status == "WITHDRAWN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_STAFF_TARGET", "message": "직원 계정만 상태 변경할 수 있습니다."},
        )

    reason = payload.reason.strip()
    if not reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "REASON_REQUIRED", "message": "상태 변경 사유를 입력하세요."},
        )

    if contains_patron_identity(db, reason):
        raise ForbiddenException(
            code="PATRON_PII_FORBIDDEN",
            message="변경 사유에 회원 개인정보를 입력할 수 없습니다.",
        )

    if target.role == "ADMIN" and target.account_status == "ACTIVE":
        active_admin_count = (
            db.scalar(
                select(func.count())
                .select_from(User)
                .where(User.role == "ADMIN", User.account_status == "ACTIVE")
            )
            or 0
        )
        if active_admin_count <= 1:
            raise ConflictException(
                code="LAST_ACTIVE_ADMIN",
                message="마지막 활성 관리자는 비활성화할 수 없습니다.",
            )

    previous_status = target.account_status
    new_status = "INACTIVE" if previous_status == "ACTIVE" else "ACTIVE"
    target.account_status = new_status

    db.add(
        StaffAccountHistory(
            target_staff_user_id=target.user_id,
            action_type="REACTIVATE" if new_status == "ACTIVE" else "DEACTIVATE",
            previous_status=previous_status,
            new_status=new_status,
            role_at_creation=None,
            reason=reason,
            processed_by_admin_user_id=admin_user_id,
        )
    )
    db.commit()
    db.refresh(target)

    return UserActionResponse(
        ok=True,
        message="직원 상태와 변경 이력을 저장했습니다.",
        user=LibraryUserResponse.model_validate(target),
    )


def list_staff_histories(db: Session) -> list[StaffAccountHistory]:
    return list(
        db.scalars(
            select(StaffAccountHistory).order_by(StaffAccountHistory.staff_history_id.desc())
        ).all()
    )