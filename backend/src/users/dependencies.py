from hmac import compare_digest
from enum import Enum
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.core.exceptions import ForbiddenException, UnauthorizedException
from src.core.security import decode_token, password_session_tag
from src.users.models import User

ACCESS_COOKIE_NAME = "access_token"


class UserRole(str, Enum):
    """도서관 시스템 사용자 권한 구분"""

    MEMBER = "MEMBER"
    LIBRARIAN = "LIBRARIAN"
    ADMIN = "ADMIN"


bearer_scheme = HTTPBearer(auto_error=False)


def _extract_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
) -> str | None:
    if credentials is not None and credentials.scheme.lower() == "bearer":
        return credentials.credentials
    return request.cookies.get(ACCESS_COOKIE_NAME)


def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """Bearer 헤더 또는 HttpOnly 쿠키의 JWT를 검증하고 현재 로그인한 사용자를 반환합니다."""
    token = _extract_token(request, credentials)
    if not token:
        raise UnauthorizedException(
            code="MISSING_TOKEN",
            message="인증 토큰이 필요합니다.",
        )

    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise UnauthorizedException(
            code="INVALID_TOKEN",
            message="유효하지 않거나 만료된 액세스 토큰입니다.",
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise UnauthorizedException(
            code="INVALID_TOKEN_PAYLOAD",
            message="토큰에 사용자 식별 정보가 없습니다.",
        )

    try:
        parsed_id = int(user_id)
    except (TypeError, ValueError):
        raise UnauthorizedException(code="INVALID_TOKEN_PAYLOAD", message="유효하지 않은 세션입니다.") from None
    user = db.get(User, parsed_id)
    if user is None:
        raise UnauthorizedException(
            code="USER_NOT_FOUND",
            message="존재하지 않는 사용자입니다.",
        )

    if not user.is_active:
        raise ForbiddenException(
            code="INACTIVE_USER",
            message="비활성화되었거나 탈퇴한 계정입니다.",
        )

    credential = payload.get("credential")
    if (
        not user.password_hash
        or not isinstance(credential, str)
        or not credential.isascii()
        or not compare_digest(credential, password_session_tag(user.password_hash))
    ):
        raise UnauthorizedException(
            code="SESSION_INVALIDATED",
            message="세션이 종료되었습니다. 다시 로그인해 주세요.",
        )

    return user


def require_librarian(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """활성 사서만 사서 업무를 수행할 수 있습니다."""
    if current_user.role != UserRole.LIBRARIAN:
        raise ForbiddenException(
            code="LIBRARIAN_REQUIRED",
            message="사서 권한이 필요한 작업입니다.",
        )
    return current_user


def require_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """관리자(ADMIN) 권한을 가진 사용자만 통과시킵니다."""
    if current_user.role != UserRole.ADMIN:
        raise ForbiddenException(
            code="ADMIN_REQUIRED",
            message="관리자 권한이 필요한 작업입니다.",
        )
    return current_user


def require_member(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    if current_user.role != UserRole.MEMBER:
        raise ForbiddenException(code="MEMBER_REQUIRED", message="회원만 수행할 수 있습니다.")
    return current_user


CurrentUser = Annotated[User, Depends(get_current_user)]
MemberUser = Annotated[User, Depends(require_member)]
LibrarianUser = Annotated[User, Depends(require_librarian)]
AdminUser = Annotated[User, Depends(require_admin)]