import re
from datetime import datetime
from typing import Literal

from pydantic import Field, field_validator

from src.core.schemas import CamelModel


def _validate_and_normalize_contact(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if not re.fullmatch(r"\d{10,11}", digits):
        raise ValueError("휴대전화번호를 숫자 10~11자리로 입력하세요.")
    return digits


class SignupRequest(CamelModel):
    login_id: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)
    full_name: str = Field(min_length=1, max_length=100)
    contact: str = Field(min_length=10, max_length=20)

    @field_validator("login_id")
    @classmethod
    def validate_login_id(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed or len(trimmed) > 50:
            raise ValueError("로그인 ID를 1~50자로 입력하세요.")
        return trimmed

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed or len(trimmed) > 100:
            raise ValueError("이름을 1~100자로 입력하세요.")
        return trimmed

    @field_validator("contact")
    @classmethod
    def normalize_contact(cls, value: str) -> str:
        return _validate_and_normalize_contact(value)


class LoginRequest(CamelModel):
    login_id: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("login_id")
    @classmethod
    def trim_login_id(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("로그인 ID를 입력하세요.")
        return trimmed


class ChangePasswordRequest(CamelModel):
    current_password: str = Field(min_length=1, max_length=128, repr=False)
    new_password: str = Field(min_length=12, max_length=128, repr=False)


class AuthenticatedUserResponse(CamelModel):
    user_id: int
    role: str
    account_status: str
    login_id: str
    full_name: str
    contact: str


class LibraryUserResponse(CamelModel):
    """domain.ts의 LibraryUser 인터페이스와 1:1 매핑 (탈퇴 회원의 null 필드 포함)"""

    user_id: int
    login_id: str | None
    full_name: str | None
    contact: str | None
    role: Literal["MEMBER", "LIBRARIAN", "ADMIN"]
    account_status: Literal["ACTIVE", "INACTIVE", "WITHDRAWN"]
    created_at: datetime
    borrowing_suspended_until: datetime | None


class ProfileUpdateRequest(CamelModel):
    full_name: str = Field(min_length=1, max_length=100)
    contact: str = Field(min_length=10, max_length=20)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed or len(trimmed) > 100:
            raise ValueError("이름을 1~100자로 입력하세요.")
        return trimmed

    @field_validator("contact")
    @classmethod
    def normalize_contact(cls, value: str) -> str:
        return _validate_and_normalize_contact(value)


class StaffCreateRequest(CamelModel):
    login_id: str = Field(min_length=1, max_length=50)
    full_name: str = Field(min_length=1, max_length=100)
    contact: str = Field(min_length=10, max_length=20)
    role: Literal["LIBRARIAN", "ADMIN"]
    password: str = Field(min_length=12, max_length=128)

    @field_validator("login_id")
    @classmethod
    def validate_login_id(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed or len(trimmed) > 50:
            raise ValueError("로그인 ID를 1~50자로 입력하세요.")
        return trimmed

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed or len(trimmed) > 100:
            raise ValueError("이름을 1~100자로 입력하세요.")
        return trimmed

    @field_validator("contact")
    @classmethod
    def normalize_contact(cls, value: str) -> str:
        return _validate_and_normalize_contact(value)


class StaffStatusUpdateRequest(CamelModel):
    reason: str = Field(min_length=1)


class StaffAccountHistoryResponse(CamelModel):
    staff_history_id: int
    target_staff_user_id: int
    action_type: Literal["CREATE", "DEACTIVATE", "REACTIVATE"]
    previous_status: Literal["ACTIVE", "INACTIVE"] | None
    new_status: Literal["ACTIVE", "INACTIVE"]
    role_at_creation: Literal["LIBRARIAN", "ADMIN"] | None
    reason: str | None
    processed_by_admin_user_id: int | None
    processed_at: datetime


class UserActionResponse(CamelModel):
    ok: bool
    message: str
    user: LibraryUserResponse | None = None