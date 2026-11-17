from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class Book(Base):
    __tablename__ = "books"

    book_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    isbn: Mapped[str | None] = mapped_column(String(13), unique=True, nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    publisher: Mapped[str | None] = mapped_column(String(150), nullable=True)
    publication_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    category_code: Mapped[str] = mapped_column(String(50), nullable=False)


class Author(Base):
    __tablename__ = "authors"

    author_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    author_name: Mapped[str] = mapped_column(String(150), nullable=False)


class BookAuthor(Base):
    __tablename__ = "book_authors"

    book_id: Mapped[int] = mapped_column(
        ForeignKey("books.book_id", ondelete="CASCADE"),
        primary_key=True,
    )
    author_id: Mapped[int] = mapped_column(
        ForeignKey("authors.author_id", ondelete="CASCADE"),
        primary_key=True,
    )


class BookCopy(Base):
    __tablename__ = "book_copies"

    copy_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.book_id"), nullable=False)
    copy_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    management_status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")


class BookChangeHistory(Base):
    __tablename__ = "book_change_histories"

    book_change_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.book_id"), nullable=False)
    changed_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id"), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    before_values: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    after_values: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)


class CopyStatusHistory(Base):
    __tablename__ = "copy_status_histories"

    copy_status_history_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    copy_id: Mapped[int] = mapped_column(ForeignKey("book_copies.copy_id"), nullable=False)
    previous_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    new_status: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    changed_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id"), nullable=False)
    related_loan_id: Mapped[int | None] = mapped_column(ForeignKey("loans.loan_id"), nullable=True)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )