import { useEffect, useMemo, useState } from "react";
import {
  BookMarked,
  CalendarDays,
  CalendarClock,
  Clock3,
  Search,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { BookCard } from "../../components/catalog/BookCard";
import { DataTable } from "../../components/tables/DataTable";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  Notice,
  PageHeading,
  ResultMessage,
  SectionHeading,
} from "../../components/ui/Primitives";
import { WorkspaceLayout } from "../../components/layout/WorkspaceLayout";
import {
  canRenew,
  getAuthorsForBook,
  getAvailability,
  getBookForCopy,
  getOverdueDays,
  isOverdue,
  formatDate,
  normalizeIsbn,
} from "../../services/library";
import { useLibraryStore, type ActionResult } from "../../store/libraryStore";
import type { Book, Loan } from "../../types/domain";

export function UserBooksPage() {
  const [initialParams] = useSearchParams();
  const data = useLibraryStore(
    useShallow((state) => ({
      users: state.users,
      books: state.books,
      authors: state.authors,
      bookAuthors: state.bookAuthors,
      copies: state.copies,
      loans: state.loans,
      renewals: state.renewals,
      staffHistory: state.staffHistory,
      bookHistory: state.bookHistory,
      copyHistory: state.copyHistory,
      corrections: state.corrections,
      requests: state.requests,
    })),
  );
  const [query, setQuery] = useState(() => initialParams.get("q") ?? "");
  const [publisher, setPublisher] = useState("");
  const [authorQuery, setAuthorQuery] = useState("");
  const [category, setCategory] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [page, setPage] = useState(1);
  const [searchBy, setSearchBy] = useState<"title" | "author" | "isbn">(
    initialParams.get("by") === "author" ? "author" : initialParams.get("by") === "isbn" ? "isbn" : "title",
  );
  const [availabilityFilter, setAvailabilityFilter] = useState<
    "all" | "available" | "unavailable"
  >("all");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const recordDbFlowEvents = useLibraryStore(
    (state) => state.recordDbFlowEvents,
  );
  const normalized = query.trim().toLocaleLowerCase();
  let isbnError = "";
  if (searchBy === "isbn" && query.trim()) {
    try {
      normalizeIsbn(query);
    } catch (error) {
      isbnError =
        error instanceof Error ? error.message : "ISBN 형식을 확인하세요.";
    }
  }
  const books = useMemo(
    () =>
      data.books
        .filter((book) => {
          if (
            !data.copies.some(
              (copy) =>
                copy.bookId === book.bookId &&
                copy.managementStatus !== "RETIRED",
            )
          )
            return false;
          const authors = getAuthorsForBook(book.bookId, data)
            .map((author) => author.authorName)
            .join(" ")
            .toLocaleLowerCase();
          const match =
            !normalized ||
            (searchBy === "title"
              ? book.title.toLocaleLowerCase().includes(normalized)
              : searchBy === "author"
                ? authors.includes(normalized)
                : (() => {
                    try {
                      return book.isbn === normalizeIsbn(query);
                    } catch {
                      return false;
                    }
                  })());
          const available = getAvailability(book.bookId, data).available > 0;
          return (
            match &&
            authors.includes(authorQuery.toLocaleLowerCase()) &&
            (book.publisher ?? "")
              .toLocaleLowerCase()
              .includes(publisher.toLocaleLowerCase()) &&
            (!category || book.categoryCode === category) &&
            (!yearFrom ||
              (book.publicationYear !== null &&
                book.publicationYear >= Number(yearFrom))) &&
            (!yearTo ||
              (book.publicationYear !== null &&
                book.publicationYear <= Number(yearTo))) &&
            (availabilityFilter === "all" ||
              (availabilityFilter === "available" ? available : !available))
          );
        })
        .sort(
          (a, b) => a.title.localeCompare(b.title, "ko") || a.bookId - b.bookId,
        ),
    [
      availabilityFilter,
      data,
      normalized,
      query,
      searchBy,
      publisher,
      authorQuery,
      category,
      yearFrom,
      yearTo,
    ],
  );
  const safePage = Math.min(page, Math.max(1, Math.ceil(books.length / 20)));
  const selectedAuthors = selectedBook
    ? getAuthorsForBook(selectedBook.bookId, data)
    : [];
  const selectedAvailability = selectedBook
    ? getAvailability(selectedBook.bookId, data)
    : null;
  const selectedCopies = selectedBook
    ? data.copies.filter((copy) => copy.bookId === selectedBook.bookId)
    : [];

  function inspectBook(book: Book) {
    setSelectedBook(book);
    recordDbFlowEvents([
      {
        operation: "SELECT",
        tableId: "book",
        columnIds: [
          "book_id",
          "isbn",
          "title",
          "publisher",
          "publication_year",
        ],
        message: "검색 조건에 맞는 서지정보를 조회합니다.",
        status: "success",
      },
      {
        operation: "SELECT",
        tableId: "book_author",
        columnIds: ["book_id", "author_id"],
        relationId: "book-book_author",
        message: "도서 ID로 연결된 저자 식별자를 조회합니다.",
        status: "success",
      },
      {
        operation: "SELECT",
        tableId: "author",
        columnIds: ["author_id", "author_name"],
        relationId: "author-book_author",
        message: "연결된 저자의 이름을 조회합니다.",
        status: "success",
      },
      {
        operation: "SELECT",
        tableId: "book_copy",
        columnIds: ["copy_id", "copy_code", "management_status"],
        relationId: "book-book_copy",
        message: "도서 ID에 속한 실물 소장본과 관리 상태를 확인합니다.",
        status: "success",
      },
      {
        operation: "SELECT",
        tableId: "loan",
        columnIds: ["copy_id", "returned_at"],
        relationId: "book_copy-loan",
        message:
          "각 소장본의 미반납 loan을 확인해 대출 가능 수량을 계산합니다. book에서 loan으로 직접 연결되는 FK는 없습니다.",
        status: "success",
      },
    ]);
  }

  return (
    <WorkspaceLayout section="user">
      <PageHeading
        eyebrow="USER SERVICE · BOOK DISCOVERY"
        title="도서 검색"
        description="제목, 저자, ISBN으로 도서관 소장 도서를 찾고 실물 소장본의 이용 가능 여부를 확인합니다."
      />
      
      {isbnError && <ResultMessage message={isbnError} error />}
      <div className="advanced-search">
        <label>
          저자
          <input
            value={authorQuery}
            onChange={(e) => {
              setAuthorQuery(e.target.value);
              setPage(1);
            }}
            placeholder="저자 부분검색"
          />
        </label>
        <label>
          출판사
          <input
            value={publisher}
            onChange={(e) => {
              setPublisher(e.target.value);
              setPage(1);
            }}
            placeholder="출판사 부분검색"
          />
        </label>
        <label>
          분류
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">전체 분류</option>
            <option value="DEMO_GENERAL">일반</option>
          </select>
        </label>
        <label>
          발행연도 시작
          <input
            type="number"
            min="1"
            max="9999"
            value={yearFrom}
            onChange={(e) => {
              setYearFrom(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          발행연도 종료
          <input
            type="number"
            min="1"
            max="9999"
            value={yearTo}
            onChange={(e) => {
              setYearTo(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      <div className="book-search-toolbar">
        <div className="search-mode-tabs" role="group" aria-label="검색 기준">
          {[
            ["title", "제목"],
            ["author", "저자"],
            ["isbn", "ISBN"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={searchBy === value ? "selected" : ""}
              onClick={() => setSearchBy(value as typeof searchBy)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="catalog-search-input">
          <Search size={17} />
          <span className="sr-only">도서 검색어</span>
          <input
            id="book-search"
            name="bookSearch"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              searchBy === "isbn"
                ? "ISBN 숫자 13자리로 검색"
                : `${searchBy === "author" ? "저자명" : "도서 제목"}을 입력하세요`
            }
          />
          <kbd>검색</kbd>
        </label>
        <select
          id="availability-filter"
          name="availabilityFilter"
          className="filter-select"
          aria-label="대출 상태 필터"
          value={availabilityFilter}
          onChange={(event) =>
            setAvailabilityFilter(
              event.target.value as typeof availabilityFilter,
            )
          }
        >
          <option value="all">전체 상태</option>
          <option value="available">대출 가능</option>
          <option value="unavailable">대출 불가</option>
        </select>
      </div>
      <div className="results-heading">
        <strong>
          검색 결과 <span>{books.length}</span>
        </strong>
        <small>서지 정보와 연결된 실물 소장본 기준</small>
      </div>
      {books.length > 0 ? (
        <>
          <div className="book-grid">
            {books.slice((safePage - 1) * 20, safePage * 20).map((book) => (
              <BookCard
                key={book.bookId}
                book={book}
                data={data}
                onSelect={inspectBook}
              />
            ))}
          </div>
          <div className="pagination">
            <Button
              variant="secondary"
              disabled={safePage === 1}
              onClick={() => setPage(safePage - 1)}
            >
              이전
            </Button>
            <span>
              {safePage} / {Math.max(1, Math.ceil(books.length / 20))} ·
              페이지당 20건
            </span>
            <Button
              variant="secondary"
              disabled={safePage * 20 >= books.length}
              onClick={() => setPage(safePage + 1)}
            >
              다음
            </Button>
          </div>
        </>
      ) : (
        <Card>
          <EmptyState
            title="검색 결과가 없습니다"
            description="검색어 또는 대출 상태 필터를 바꿔 다시 검색해 보세요."
          />
        </Card>
      )}
      <Notice tone="info" title="대출은 사서 데스크에서 진행합니다.">
        이 화면에서는 도서와 소장 상태를 확인할 수 있습니다. 대출 신청·예약·결제
        기능은 제공하지 않습니다.{" "}
        <Link to="/librarian/checkout">사서 대출 화면 보기</Link>
      </Notice>

      {selectedBook && selectedAvailability && (
        <Modal
          title={selectedBook.title}
          description={`${selectedAuthors.map((author) => author.authorName).join(", ")} · ${selectedBook.publicationYear ?? "연도 미상"}`}
          onClose={() => setSelectedBook(null)}
          wide
        >
          <div className="book-detail-modal">
            <div className="book-detail-cover-wrap">
              <span
                className={`book-cover book-cover-${((selectedBook.bookId - 1) % 5) + 1}`}
              >
                <span className="book-cover-mark">
                  <BookMarked size={15} />
                </span>
                <span className="book-cover-title">{selectedBook.title}</span>
                <span className="book-cover-rule" />
                <span className="book-cover-author">
                  {selectedAuthors
                    .map((author) => author.authorName)
                    .join(", ")}
                </span>
                <span className="book-cover-edition">
                  ISBN {selectedBook.isbn}
                </span>
              </span>
            </div>
            <div className="book-detail-content">
              <div className="book-detail-status">
                <Badge
                  tone={selectedAvailability.available > 0 ? "green" : "amber"}
                >
                  {selectedAvailability.available > 0
                    ? "대출 가능"
                    : "현재 대출 중"}
                </Badge>
                <strong>
                  {selectedAvailability.available}
                  <small> / {selectedAvailability.total}권 대출 가능</small>
                </strong>
              </div>
              <dl className="book-facts">
                <div>
                  <dt>ISBN-13</dt>
                  <dd>{selectedBook.isbn}</dd>
                </div>
                <div>
                  <dt>출판사</dt>
                  <dd>{selectedBook.publisher ?? "정보 없음"}</dd>
                </div>
                <div>
                  <dt>발행연도</dt>
                  <dd>{selectedBook.publicationYear ?? "정보 없음"}</dd>
                </div>
                <div>
                  <dt>저자</dt>
                  <dd>
                    {selectedAuthors
                      .map((author) => author.authorName)
                      .join(", ") || "저자 정보 없음"}
                  </dd>
                </div>
              </dl>
              <div className="copy-list-heading">
                <strong>소장본 현황</strong>
                <span>도서관 관리번호 기준</span>
              </div>
              <div className="copy-status-list">
                {selectedCopies.map((copy) => {
                  const borrowed = data.loans.some(
                    (loan) =>
                      loan.copyId === copy.copyId &&
                      !loan.isCancelled &&
                      loan.returnedAt === null,
                  );
                  return (
                    <div key={copy.copyId}>
                      <code>{copy.copyCode}</code>
                      <Badge
                        tone={
                          copy.managementStatus === "RETIRED"
                            ? "neutral"
                            : borrowed
                              ? "amber"
                              : "green"
                        }
                      >
                        {copy.managementStatus === "RETIRED"
                          ? "제적"
                          : borrowed
                            ? "대출 중"
                            : "비치 중"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
              
    </WorkspaceLayout>
  );
}
