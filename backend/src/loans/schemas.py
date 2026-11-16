import math
from typing import Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationParams:
    """목록 조회 API에서 공통으로 사용하는 페이지네이션 쿼리 파라미터 의존성"""

    def __init__(
        self,
        page: int = Query(1, ge=1, description="조회할 페이지 번호 (1부터 시작)"),
        size: int = Query(20, ge=1, le=100, description="페이지당 항목 수 (최대 100)"),
    ) -> None:
        self.page = page
        self.size = size

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size

    @property
    def limit(self) -> int:
        return self.size


class PaginatedResponse(BaseModel, Generic[T]):
    """모든 다건 목록 조회 API의 표준 응답 래퍼"""

    items: list[T] = Field(description="현재 페이지의 데이터 목록")
    total: int = Field(description="전체 데이터 개수")
    page: int = Field(description="현재 페이지 번호")
    size: int = Field(description="페이지당 항목 수")
    total_pages: int = Field(description="전체 페이지 수")

    @classmethod
    def create(
        cls,
        items: list[T],
        total: int,
        params: PaginationParams,
    ) -> "PaginatedResponse[T]":
        total_pages = math.ceil(total / params.size) if total > 0 else 0
        return cls(
            items=items,
            total=total,
            page=params.page,
            size=params.size,
            total_pages=total_pages,
        )