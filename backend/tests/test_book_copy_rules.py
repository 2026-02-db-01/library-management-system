from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from src.books.models import Book, BookCopy
from src.books.schemas import CopyStatusUpdateRequest
from src.books.service import _copy_prefix, add_copy, change_copy_status
from src.core.exceptions import ConflictException


def test_copy_prefix_matches_seed_conventions() -> None:
    assert _copy_prefix("CS") == "CS"
    assert _copy_prefix("NOVEL") == "NV"
    assert _copy_prefix("HISTORY") == "HS"
    assert _copy_prefix("SCIENCE") == "SC"
    assert _copy_prefix("demo_general") == "DE"


def test_add_copy_generates_next_sequence_after_seed_and_legacy_codes() -> None:
    db = MagicMock()
    db.scalar.side_effect = [
        Book(book_id=7, title="별을 세는 물리학", category_code="SCIENCE"),
        None,  # uniqueness check for SC-0007-03
    ]
    db.scalars.return_value.all.return_value = ["SC-0007-01", "SC-0007-02", "CD-19"]

    copy = add_copy(db, 7)

    assert copy.book_id == 7
    assert copy.copy_code == "SC-0007-03"
    assert copy.management_status == "ACTIVE"
    db.add.assert_called_once()
    db.commit.assert_called_once()


def test_change_copy_status_blocks_damaged_when_actively_borrowed() -> None:
    db = MagicMock()
    copy = BookCopy(copy_id=1, book_id=1, copy_code="CS-0001-01", management_status="ACTIVE")
    active_loan = SimpleNamespace(loan_id=10, copy_id=1, is_cancelled=False, returned_at=None)
    db.scalar.side_effect = [copy, active_loan]
    db.scalars.return_value.all.return_value = []

    with pytest.raises(ConflictException) as exc_info:
        change_copy_status(
            db,
            1,
            CopyStatusUpdateRequest(status="DAMAGED", reason="대출 중 파손 변경 시도"),
            librarian_id=2,
        )

    assert exc_info.value.code == "COPY_CURRENTLY_BORROWED"
