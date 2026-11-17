import re

from fastapi import HTTPException, status
from sqlalchemy import func, select
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
    AuthorCreateRequest,
    AuthorResponse,
    BookAvailabilityResponse,
    BookCopyResponse,
    BookDetailResponse,
    BookSaveRequest,
    CopyStatusUpdateRequest,
)
from src.core.exceptions import ConflictException, ForbiddenException
from src.loans.models import Loan
from src.users.models import User


def normalize_isbn(raw: str | None) -> str | None:
    if not raw:
        return None
    value = re.sub(r"[\s-]", "", raw).upper()
    if not value:
        return None

    if re.fullmatch(r"\d{9}[\dX]", value):
        total = sum(
            (10 if ch == "X" else int(ch)) * (10 - i)
            for i, ch in enumerate(value)
        )
        if total % 11 != 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_ISBN", "message": "ISBN-10 체크디지트를 확인하세요."},
            )
        prefix = f"978{value[:9]}"
        check_sum = sum(int(ch) * (3 if i % 2 else 1) for i, ch in enumerate(prefix))
        return prefix + str((10 - (check_sum % 10)) % 10)

    if (
        not re.fullmatch(r"\d{13}", value)
        or sum(int(ch) * (3 if i % 2 else 1) for i, ch in enumerate(value)) % 10 != 0
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_ISBN",
                "message": "ISBN-10/13 형식과 체크디지트를 확인하세요.",
            },
        )
    return value


def contains_patron_identity(db: Session, text: str) -> bool:
    if re.search(r"0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}", text):
        return True
    members = db.scalars(select(User).where(User.role == "MEMBER")).all()
    for m in members:
        candidates = [m.full_name, m.login_id, m.contact, str(m.user_id)]
        if any(val is not None and len(val) > 2 and val in text for val in candidates):
            return True
    return False


def create_author(db: Session, payload: AuthorCreateRequest) -> Author:
    author = Author(author_name=payload.author_name)
    db.add(author)
    db.commit()
    db.refresh(author)
    return author


def list_authors(db: Session) -> list[Author]:
    return list(db.scalars(select(Author).order_by(Author.author_id.asc())).all())


def rename_author(
    db: Session,
    author_id: int,
    payload: AuthorCreateRequest,
    librarian_id: int,
) -> Author:
    author = db.get(Author, author_id)
    if author is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "AUTHOR_NOT_FOUND", "message": "저자를 찾을 수 없습니다."},
        )

    old_name = author.author_name
    linked_book_ids = db.scalars(
        select(BookAuthor.book_id).where(BookAuthor.author_id == author_id)
    ).all()

    for book_id in linked_book_ids:
        db.add(
            BookChangeHistory(
                book_id=book_id,
                changed_by_user_id=librarian_id,
                before_values={"author_id": author_id, "author_name": old_name},
                after_values={"author_id": author_id, "author_name": payload.author_name},
            )
        )

    author.author_name = payload.author_name
    db.commit()
    db.refresh(author)
    return author


def _resolve_author_ids(db: Session, payload: BookSaveRequest) -> list[int]:
    if payload.author_ids:
        unique_ids = list(dict.fromkeys(payload.author_ids))
        existing_count = db.scalar(
            select(func.count()).select_from(Author).where(Author.author_id.in_(unique_ids))
        )
        if existing_count != len(unique_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_AUTHOR", "message": "유효한 저자를 최소 1명 연결하세요."},
            )
        return unique_ids

    raw_names = [
        name.strip()
        for name in re.split(r"[;,、]", payload.author_names)
        if name.strip()
    ]
    unique_names = list(dict.fromkeys(raw_names))
    if not unique_names:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_AUTHOR", "message": "유효한 저자를 최소 1명 연결하세요."},
        )

    resolved_ids: list[int] = []
    for name in unique_names:
        if len(name) > 150:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_AUTHOR_NAME", "message": "저자명은 150자 이하입니다."},
            )
        matches = list(db.scalars(select(Author).where(Author.author_name == name)).all())
        if len(matches) > 1:
            raise ConflictException(
                code="AMBIGUOUS_AUTHOR",
                message="동명이인 저자는 ID로 선택하세요.",
            )
        if len(matches) == 1:
            resolved_ids.append(matches[0].author_id)
        else:
            new_author = Author(author_name=name)
            db.add(new_author)
            db.flush()
            resolved_ids.append(new_author.author_id)

    return resolved_ids


def save_book(
    db: Session,
    payload: BookSaveRequest,
    librarian_id: int,
    book_id: int | None = None,
) -> BookDetailResponse:
    isbn = normalize_isbn(payload.isbn)
    title = payload.title.strip()
    publisher = payload.publisher.strip() or None
    category_code = payload.category_code.strip()

    if not title or len(title) > 255 or (publisher and len(publisher) > 150):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_BOOK_META", "message": "도서명(1~255자)과 출판사(150자)를 확인하세요."},
        )

    if category_code != "DEMO_GENERAL":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "UNSUPPORTED_CATEGORY",
                "message": "분류 목록은 미확정입니다. 합성 데모 분류 DEMO_GENERAL만 사용합니다.",
            },
        )

    year: int | None = None
    if payload.publication_year is not None and str(payload.publication_year).strip() != "":
        try:
            year = int(payload.publication_year)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_YEAR", "message": "발행연도는 1~9999 정수입니다."},
            ) from exc
        if year < 1 or year > 9999:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_YEAR", "message": "발행연도는 1~9999 정수입니다."},
            )

    if isbn:
        dup_stmt = select(Book).where(Book.isbn == isbn)
        if book_id is not None:
            dup_stmt = dup_stmt.where(Book.book_id != book_id)
        if db.scalar(dup_stmt) is not None:
            raise ConflictException(
                code="DUPLICATE_ISBN",
                message="이미 등록된 ISBN입니다.",
            )
    elif not payload.confirm_similar:
        sim_stmt = select(Book).where(func.lower(Book.title) == title.lower())
        if book_id is not None:
            sim_stmt = sim_stmt.where(Book.book_id != book_id)
        if db.scalar(sim_stmt) is not None:
            raise ConflictException(
                code="SIMILAR_BOOK_EXISTS",
                message="유사 도서가 있습니다. 기존 서지를 검토하고 신규 등록 확인을 선택하세요.",
            )

    author_ids = _resolve_author_ids(db, payload)

    if book_id is not None:
        book = db.get(Book, book_id)
        if book is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "BOOK_NOT_FOUND", "message": "도서를 찾을 수 없습니다."},
            )
        old_author_ids = list(
            db.scalars(select(BookAuthor.author_id).where(BookAuthor.book_id == book_id)).all()
        )
        before_values = {
            "bookId": book.book_id,
            "isbn": book.isbn,
            "title": book.title,
            "publisher": book.publisher,
            "publicationYear": book.publication_year,
            "categoryCode": book.category_code,
            "author_ids": old_author_ids,
        }
        book.isbn = isbn
        book.title = title
        book.publisher = publisher
        book.publication_year = year
        book.category_code = category_code

        db.query(BookAuthor).filter(BookAuthor.book_id == book_id).delete()
        for aid in author_ids:
            db.add(BookAuthor(book_id=book_id, author_id=aid))

        after_values = {
            "bookId": book.book_id,
            "isbn": book.isbn,
            "title": book.title,
            "publisher": book.publisher,
            "publicationYear": book.publication_year,
            "categoryCode": book.category_code,
            "author_ids": author_ids,
        }
        db.add(
            BookChangeHistory(
                book_id=book.book_id,
                changed_by_user_id=librarian_id,
                before_values=before_values,
                after_values=after_values,
            )
        )
    else:
        book = Book(
            isbn=isbn,
            title=title,
            publisher=publisher,
            publication_year=year,
            category_code=category_code,
        )
        db.add(book)
        db.flush()
        for aid in author_ids:
            db.add(BookAuthor(book_id=book.book_id, author_id=aid))

    db.commit()
    return get_book_detail(db, book.book_id)


def get_book_detail(db: Session, book_id: int) -> BookDetailResponse:
    book = db.get(Book, book_id)
    if book is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "BOOK_NOT_FOUND", "message": "도서를 찾을 수 없습니다."},
        )

    authors = list(
        db.scalars(
            select(Author)
            .join(BookAuthor, BookAuthor.author_id == Author.author_id)
            .where(BookAuthor.book_id == book_id)
        ).all()
    )
    copies = list(
        db.scalars(
            select(BookCopy)
            .where(BookCopy.book_id == book_id)
            .order_by(BookCopy.copy_id.asc())
        ).all()
    )
    copy_ids = [c.copy_id for c in copies]
    active_loan_copy_ids: set[int] = set()
    if copy_ids:
        active_loan_copy_ids = set(
            db.scalars(
                select(Loan.copy_id).where(
                    Loan.copy_id.in_(copy_ids),
                    Loan.is_cancelled.is_(False),
                    Loan.returned_at.is_(None),
                )
            ).all()
        )

    active_copies = [c for c in copies if c.management_status == "ACTIVE"]
    available_count = sum(1 for c in active_copies if c.copy_id not in active_loan_copy_ids)
    borrowed_count = sum(1 for c in copies if c.copy_id in active_loan_copy_ids)
    retired_count = sum(1 for c in copies if c.management_status == "RETIRED")
    damaged_count = sum(1 for c in copies if c.management_status == "DAMAGED")

    return BookDetailResponse(
        book_id=book.book_id,
        isbn=book.isbn,
        title=book.title,
        publisher=book.publisher,
        publication_year=book.publication_year,
        category_code=book.category_code,
        authors=[AuthorResponse.model_validate(a) for a in authors],
        copies=[BookCopyResponse.model_validate(c) for c in copies],
        availability=BookAvailabilityResponse(
            total=len(copies),
            available=available_count,
            borrowed=borrowed_count,
            retired=retired_count,
            damaged=damaged_count,
        ),
    )


def search_books(
    db: Session,
    author: str = "",
    publisher: str = "",
    isbn: str = "",
    category: str = "",
    year_from: int | None = None,
    year_to: int | None = None,
    availability: str = "",
) -> list[BookDetailResponse]:
    stmt = select(Book).order_by(Book.book_id.asc())
    if isbn.strip():
        try:
            norm_isbn = normalize_isbn(isbn)
        except HTTPException:
            return []
        stmt = stmt.where(Book.isbn == norm_isbn)
    if publisher.strip():
        stmt = stmt.where(func.lower(Book.publisher).contains(publisher.strip().lower()))
    if category.strip():
        stmt = stmt.where(Book.category_code == category.strip())
    if year_from is not None:
        stmt = stmt.where(Book.publication_year >= year_from)
    if year_to is not None:
        stmt = stmt.where(Book.publication_year <= year_to)

    books = list(db.scalars(stmt).all())
    results: list[BookDetailResponse] = []
    author_q = author.strip().lower()

    for b in books:
        detail = get_book_detail(db, b.book_id)
        if author_q:
            joined_authors = " ".join(a.author_name for a in detail.authors).lower()
            if author_q not in joined_authors:
                continue
        if availability == "available" and detail.availability.available <= 0:
            continue
        if availability == "unavailable" and detail.availability.available > 0:
            continue
        results.append(detail)

    return results


def add_copy(db: Session, book_id: int) -> BookCopy:
    book = db.get(Book, book_id)
    if book is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "BOOK_NOT_FOUND", "message": "도서를 찾을 수 없습니다."},
        )

    max_id = db.scalar(select(func.coalesce(func.max(BookCopy.copy_id), 0))) or 0
    serial = max_id + 1
    while db.scalar(select(BookCopy).where(BookCopy.copy_code == f"CD-{serial}")) is not None:
        serial += 1

    copy = BookCopy(
        book_id=book_id,
        copy_code=f"CD-{serial}",
        management_status="ACTIVE",
    )
    db.add(copy)
    db.commit()
    db.refresh(copy)
    return copy


def change_copy_status(
    db: Session,
    copy_id: int,
    payload: CopyStatusUpdateRequest,
    librarian_id: int,
) -> BookCopy:
    copy = db.get(BookCopy, copy_id)
    if copy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "COPY_NOT_FOUND", "message": "소장본을 찾을 수 없습니다."},
        )

    if copy.management_status == "RETIRED" or copy.management_status == payload.status:
        raise ConflictException(
            code="INVALID_COPY_TRANSITION",
            message="제적 복원 또는 같은 상태 변경은 불가합니다.",
        )

    reason = payload.reason.strip()
    if not reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "REASON_REQUIRED", "message": "상태 변경 사유가 필요합니다."},
        )

    if contains_patron_identity(db, reason):
        raise ForbiddenException(
            code="PATRON_PII_FORBIDDEN",
            message="변경 사유에 회원 개인정보를 입력할 수 없습니다.",
        )

    if payload.status != "DAMAGED":
        active_loan = db.scalar(
            select(Loan).where(
                Loan.copy_id == copy_id,
                Loan.is_cancelled.is_(False),
                Loan.returned_at.is_(None),
            )
        )
        if active_loan is not None:
            raise ConflictException(
                code="COPY_CURRENTLY_BORROWED",
                message="미반납 소장본은 수리 완료·제적할 수 없습니다.",
            )

    db.add(
        CopyStatusHistory(
            copy_id=copy.copy_id,
            previous_status=copy.management_status,
            new_status=payload.status,
            reason=reason,
            changed_by_user_id=librarian_id,
            related_loan_id=None,
        )
    )
    copy.management_status = payload.status
    db.commit()
    db.refresh(copy)
    return copy