from enum import Enum
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.core.exceptions import ForbiddenException, UnauthorizedException
from src.core.security import decode_token
from src.users.models import User


class UserRole(str, Enum):
    """도서관 시스템 사용자 권한 구분"""

    MEMBER = "MEMBER"        # 일반 회원 (도서 검색, 본인 대출 이력 조회, 연장 신청 등)
    LIBRARIAN = "LIBRARIAN"  # 사서 (도서·소장본 등록 및 수정, 대출·반납 승인 처리 등)
    ADMIN = "ADMIN"          # 시스템 관리자


bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """Authorization 헤더의 Bearer JWT를 검증하고 현재 로그인한 사용자 객체를 반환합니다."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise UnauthorizedException(
            code="MISSING_TOKEN",
            message="인증 토큰이 필요합니다.",
        )

    payload = decode_token(credentials.credentials)
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

    user = db.get(User, int(user_id))
    if user is None:
        raise UnauthorizedException(
            code="USER_NOT_FOUND",
            message="존재하지 않는 사용자입니다.",
        )

    if not getattr(user, "is_active", True):
        raise ForbiddenException(
            code="INACTIVE_USER",
            message="비활성화되거나 정지된 계정입니다.",
        )

    return user


def require_librarian(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """사서(LIBRARIAN) 또는 관리자(ADMIN) 권한을 가진 사용자만 통과시킵니다."""
    if current_user.role not in (UserRole.LIBRARIAN, UserRole.ADMIN):
        raise ForbiddenException(
            code="LIBRARIAN_REQUIRED",
            message="사서 권한이 필요한 작업입니다.",
        )
    return current_user


# 도메인 라우터에서 간결하게 사용할 수 있도록 타입 별칭(Type Alias) 제공
CurrentUser = Annotated[User, Depends(get_current_user)]
LibrarianUser = Annotated[User, Depends(require_librarian)]