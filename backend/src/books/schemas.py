from datetime import datetime
from typing import Literal

from pydantic import Field, field_validator

from src.core.schemas import CamelModel


class AuthorCreateRequest(CamelModel):
    author_name: str = Field(min_length=1, max_length=150)

    @field_validator("author_name")
    @classmethod
    def trim_name(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed or len(trimmed) > 150:
            raise ValueError("저자명은 1~150자입니다.")
        return trimmed


class AuthorResponse(CamelModel):
    author_id: int
    author_name: str


class BookSaveRequest(CamelModel):
    isbn: str = ""
    title: str = Field(min_length=1, max_length=255)
    publisher: str = Field(default="", max_length=150)
    publication_year: int | str | None = None
    author_names: str = ""
    category_code: str = "DEMO_GENERAL"
    author_ids: list[int] | None = None
    confirm_similar: bool = False


class BookCopyResponse(CamelModel):
    copy_id: int
    book_id: int
    copy_code: str
    management_status: Literal["ACTIVE", "DAMAGED", "RETIRED"]


class CopyStatusUpdateRequest(CamelModel):
    status: Literal["ACTIVE", "DAMAGED", "RETIRED"]
    reason: str = Field(min_length=1)


class BookAvailabilityResponse(CamelModel):
    total: int
    available: int
    borrowed: int
    retired: int
    damaged: int


class BookDetailResponse(CamelModel):
    book_id: int
    isbn: str | None
    title: str
    publisher: str | None
    publication_year: int | None
    category_code: str
    authors: list[AuthorResponse]
    copies: list[BookCopyResponse]
    availability: BookAvailabilityResponse


class CopyStatusHistoryResponse(CamelModel):
    copy_status_history_id: int
    copy_id: int
    previous_status: str | None
    new_status: str
    reason: str
    changed_by_user_id: int
    related_loan_id: int | None
    changed_at: datetime