from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.books import service
from src.books.schemas import (
    AuthorCreateRequest,
    AuthorResponse,
    BookCopyResponse,
    BookDetailResponse,
    BookSaveRequest,
    CopyStatusUpdateRequest,
)
from src.core.database import get_db
from src.users.dependencies import LibrarianUser

router = APIRouter()


@router.get("/authors", response_model=list[AuthorResponse])
def get_authors(db: Annotated[Session, Depends(get_db)]) -> list[AuthorResponse]:
    authors = service.list_authors(db)
    return [AuthorResponse.model_validate(a) for a in authors]


@router.post("/authors", response_model=AuthorResponse, status_code=status.HTTP_201_CREATED)
def create_author(
    payload: AuthorCreateRequest,
    _: LibrarianUser,
    db: Annotated[Session, Depends(get_db)],
) -> AuthorResponse:
    author = service.create_author(db, payload)
    return AuthorResponse.model_validate(author)


@router.patch("/authors/{author_id}", response_model=AuthorResponse)
def update_author(
    author_id: int,
    payload: AuthorCreateRequest,
    librarian: LibrarianUser,
    db: Annotated[Session, Depends(get_db)],
) -> AuthorResponse:
    author = service.rename_author(db, author_id, payload, librarian.user_id)
    return AuthorResponse.model_validate(author)


@router.get("", response_model=list[BookDetailResponse])
def list_books(
    db: Annotated[Session, Depends(get_db)],
    author: str = "",
    publisher: str = "",
    isbn: str = "",
    category: str = "",
    yearFrom: int | None = None,
    yearTo: int | None = None,
    availability: str = "",
) -> list[BookDetailResponse]:
    return service.search_books(
        db=db,
        author=author,
        publisher=publisher,
        isbn=isbn,
        category=category,
        year_from=yearFrom,
        year_to=yearTo,
        availability=availability,
    )


@router.post("", response_model=BookDetailResponse, status_code=status.HTTP_201_CREATED)
def create_book(
    payload: BookSaveRequest,
    librarian: LibrarianUser,
    db: Annotated[Session, Depends(get_db)],
) -> BookDetailResponse:
    return service.save_book(db, payload, librarian.user_id)


@router.get("/{book_id}", response_model=BookDetailResponse)
def get_book(
    book_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> BookDetailResponse:
    return service.get_book_detail(db, book_id)


@router.put("/{book_id}", response_model=BookDetailResponse)
def update_book(
    book_id: int,
    payload: BookSaveRequest,
    librarian: LibrarianUser,
    db: Annotated[Session, Depends(get_db)],
) -> BookDetailResponse:
    return service.save_book(db, payload, librarian.user_id, book_id=book_id)


@router.post(
    "/{book_id}/copies",
    response_model=BookCopyResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_copy(
    book_id: int,
    _: LibrarianUser,
    db: Annotated[Session, Depends(get_db)],
) -> BookCopyResponse:
    copy = service.add_copy(db, book_id)
    return BookCopyResponse.model_validate(copy)


@router.patch("/copies/{copy_id}/status", response_model=BookCopyResponse)
def patch_copy_status(
    copy_id: int,
    payload: CopyStatusUpdateRequest,
    librarian: LibrarianUser,
    db: Annotated[Session, Depends(get_db)],
) -> BookCopyResponse:
    copy = service.change_copy_status(db, copy_id, payload, librarian.user_id)
    return BookCopyResponse.model_validate(copy)