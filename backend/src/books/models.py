from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, DateTime, ForeignKey, SmallInteger, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class Book(Base):
    __tablename__ = "book"

    book_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    isbn: Mapped[str | None] = mapped_column(String(13), unique=True, nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    publisher: Mapped[str | None] = mapped_column(String(150), nullable=True)
    publication_year: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    category_code: Mapped[str] = mapped_column(String(32), nullable=False)


class Author(Base):
    __tablename__ = "author"

    author_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    author_name: Mapped[str] = mapped_column(String(150), nullable=False)


class BookAuthor(Base):
    __tablename__ = "book_author"

    book_id: Mapped[int] = mapped_column(
        ForeignKey("book.book_id", ondelete="RESTRICT"),
        primary_key=True,
    )
    author_id: Mapped[int] = mapped_column(
        ForeignKey("author.author_id", ondelete="RESTRICT"),
        primary_key=True,
    )


class BookCopy(Base):
    __tablename__ = "book_copy"

    copy_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("book.book_id", ondelete="RESTRICT"), nullable=False)
    copy_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    management_status: Mapped[str] = mapped_column(String(16), nullable=False, default="ACTIVE")


class BookChangeHistory(Base):
    __tablename__ = "book_change_history"

    book_change_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("book.book_id", ondelete="RESTRICT"), nullable=False)
    changed_by_user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="RESTRICT"), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    before_values: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    after_values: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)


class CopyStatusHistory(Base):
    __tablename__ = "copy_status_history"

    copy_status_history_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )
    copy_id: Mapped[int] = mapped_column(ForeignKey("book_copy.copy_id", ondelete="RESTRICT"), nullable=False)
    previous_status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    new_status: Mapped[str] = mapped_column(String(16), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    changed_by_user_id: Mapped[int] = mapped_column(ForeignKey("app_user.user_id", ondelete="RESTRICT"), nullable=False)
    related_loan_id: Mapped[int | None] = mapped_column(ForeignKey("loan.loan_id", ondelete="RESTRICT"), nullable=True)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )