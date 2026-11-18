import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookMarked,
  CalendarDays,
  CalendarClock,
  Clock3,
  Search,
  UserRound,
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

function DemoMemberPicker() {
  const users = useLibraryStore((state) => state.users);
  const demoMemberId = useLibraryStore((state) => state.demoMemberId);
  const setDemoMember = useLibraryStore((state) => state.setDemoMember);
  const members = users.filter(
    (user) => user.role === "MEMBER" && user.accountStatus === "ACTIVE",
  );

  return (
    <div className="demo-member-picker">
      <span className="demo-member-icon">
        <UserRound size={16} />
      </span>
      <div>
        <strong>데모 회원 선택</strong>
        <small>선택에 따라 대출 내역이 바뀝니다.</small>
      </div>
      <select
        id="demo-member-select"
        name="demoMemberId"
        aria-label="데모 회원 선택"
        value={demoMemberId}
        onChange={(event) => setDemoMember(Number(event.target.value))}
      >
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.fullName} · ID {member.userId}
            {member.accountStatus === "INACTIVE" ? " · 비활성" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

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
      <DemoMemberPicker />
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
            <option value="DEMO_GENERAL">일반 · 합성 데모 분류</option>
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
              <Notice tone="info">
                도서 대출은 사서가 회원과 실물 소장본을 확인한 뒤 처리합니다.
              </Notice>
            </div>
          </div>
        </Modal>
      )}
    </WorkspaceLayout>
  );
}

export function UserLoansPage() {
  const state = useLibraryStore();
  const member = state.users.find((user) => user.userId === state.demoMemberId);
  const memberLoans = state.loans.filter(
    (loan) => loan.memberUserId === state.demoMemberId,
  );
  const current = memberLoans
    .filter((loan) => !loan.isCancelled && loan.returnedAt === null)
    .sort((a, b) => a.currentDueDate.localeCompare(b.currentDueDate));
  const history = memberLoans
    .filter((loan) => loan.returnedAt !== null)
    .sort((a, b) => (b.returnedAt ?? "").localeCompare(a.returnedAt ?? ""));
  const [result, setResult] = useState<ActionResult | null>(null);
  const renewLoan = useLibraryStore((store) => store.renewLoan);
  const recordDbFlowEvents = useLibraryStore(
    (store) => store.recordDbFlowEvents,
  );

  useEffect(() => {
    recordDbFlowEvents([
      {
        operation: "SELECT",
        tableId: "app_user",
        columnIds: ["user_id", "role", "account_status"],
        message: "현재 데모 회원 계정을 확인합니다.",
        status: "success",
      },
      {
        operation: "SELECT",
        tableId: "loan",
        columnIds: [
          "member_user_id",
          "copy_id",
          "borrowed_at",
          "current_due_date",
          "returned_at",
        ],
        relationId: "app_user-loan-member",
        message: "회원 ID로 현재 대출과 과거 이력을 조회합니다.",
        status: "success",
      },
      {
        operation: "SELECT",
        tableId: "loan_renewal",
        columnIds: ["loan_id", "previous_due_date", "new_due_date"],
        relationId: "loan-loan_renewal",
        message: "대출 연장 이력을 연결해 남은 연장 가능 여부를 확인합니다.",
        status: "success",
      },
    ]);
  }, [recordDbFlowEvents, state.demoMemberId]);

  function titleFor(loan: Loan) {
    return getBookForCopy(loan.copyId, state)?.title ?? "도서 정보 없음";
  }

  function copyFor(loan: Loan) {
    return (
      state.copies.find((copy) => copy.copyId === loan.copyId)?.copyCode ?? "—"
    );
  }

  return (
    <WorkspaceLayout section="user">
      <PageHeading
        eyebrow="USER SERVICE · MY ACTIVITY"
        title="내 대출 현황"
        description="선택한 데모 회원의 현재 대출과 과거 이용 기록을 확인합니다."
      />
      <DemoMemberPicker />
      {member && (
        <div className="member-context-line">
          <span className="member-avatar">
            {(member.fullName ?? "—").slice(0, 1)}
          </span>
          <span>
            <strong>{member.fullName}</strong>
            <small>
              회원 ID {member.userId} ·{" "}
              {member.accountStatus === "ACTIVE" ? "활성 계정" : "비활성 계정"}
            </small>
          </span>
          <Badge tone={member.accountStatus === "ACTIVE" ? "green" : "neutral"}>
            {member.accountStatus === "ACTIVE" ? "이용 중" : "비활성"}
          </Badge>
        </div>
      )}
      {member?.borrowingSuspendedUntil && (
        <Notice tone="warning" title="연체 반납 후 신규 대출 정지">
          종료시각:{" "}
          {new Date(member.borrowingSuspendedUntil).toLocaleString("ko-KR")} ·
          기존 대출 연장은 현재 연체 여부에 따라 판단합니다.
        </Notice>
      )}
      {result && <ResultMessage message={result.message} error={!result.ok} />}
      <div className="loan-section-grid">
        <section className="user-loan-section">
          <SectionHeading
            title="현재 대출"
            description="미반납 상태의 실물 소장본"
          />
          {current.length > 0 ? (
            current.map((loan) => {
              const overdue = isOverdue(loan);
              const book = getBookForCopy(loan.copyId, state);
              const eligible =
                member?.accountStatus === "ACTIVE" &&
                canRenew(loan, state.renewals) &&
                !state.loans.some(
                  (other) =>
                    other.memberUserId === state.demoMemberId &&
                    isOverdue(other),
                );
              return (
                <Card
                  className={`current-loan-card ${overdue ? "is-overdue" : ""}`}
                  key={loan.loanId}
                >
                  <div className="current-loan-icon">
                    <BookMarked size={19} />
                  </div>
                  <div className="current-loan-main">
                    <span className="eyebrow">LOAN #{loan.loanId}</span>
                    <h3>{titleFor(loan)}</h3>
                    <p>
                      {book
                        ? getAuthorsForBook(book.bookId, state)
                            .map((author) => author.authorName)
                            .join(", ")
                        : "저자 정보 없음"}
                    </p>
                    <span className="copy-code-line">
                      소장본 {copyFor(loan)}
                    </span>
                  </div>
                  <div className="current-loan-dates">
                    <span>
                      <CalendarDays size={14} /> 대출일{" "}
                      <strong>{formatDate(loan.borrowedAt)}</strong>
                    </span>
                    <span>
                      <Clock3 size={14} /> 반납 예정{" "}
                      <strong>{formatDate(loan.currentDueDate)}</strong>
                    </span>
                    <Badge tone={overdue ? "red" : "green"}>
                      {overdue ? `연체 ${getOverdueDays(loan)}일` : "대출 중"}
                    </Badge>
                    <div className="renewal-action-group">
                      <Button
                        variant="secondary"
                        disabled={!eligible}
                        onClick={async () =>
                          setResult(await renewLoan(loan.loanId, state.demoMemberId))
                        }
                        icon={<CalendarClock size={14} />}
                      >
                        {eligible
                          ? "7일 연장"
                          : overdue
                            ? "연체로 연장 불가"
                            : "연장 완료"}
                      </Button>
                      {eligible && (
                        <Button
                          variant="quiet"
                          onClick={async () =>
                            setResult(
                              await renewLoan(loan.loanId, state.demoMemberId, true),
                            )
                          }
                          icon={<AlertTriangle size={14} />}
                        >
                          오류 상황 시연
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          ) : (
            <Card>
              <EmptyState
                title="현재 대출 중인 도서가 없습니다"
                description="대출은 사서 데스크에서 처리할 수 있습니다."
                action={
                  <Link
                    className="button button-secondary"
                    to="/librarian/checkout"
                  >
                    사서 화면 보기
                  </Link>
                }
              />
            </Card>
          )}
        </section>
        <section className="user-loan-section">
          <SectionHeading
            title="이용 이력"
            description="반납 완료된 대출 기록"
          />
          <Card className="table-card loan-history-card">
            <DataTable
              rows={history}
              getRowKey={(loan) => loan.loanId}
              emptyMessage="아직 완료된 대출 이력이 없습니다."
              columns={[
                {
                  key: "book",
                  title: "도서",
                  render: (loan) => (
                    <span className="table-title-cell">
                      <strong>{titleFor(loan)}</strong>
                      <small>{copyFor(loan)}</small>
                      <Badge
                        tone={getOverdueDays(loan) > 0 ? "amber" : "green"}
                      >
                        {getOverdueDays(loan) > 0
                          ? `반납 시 연체 ${getOverdueDays(loan)}일`
                          : "정상 반납"}
                      </Badge>
                    </span>
                  ),
                },
                {
                  key: "borrowed",
                  title: "대출일",
                  render: (loan) => formatDate(loan.borrowedAt),
                },
                {
                  key: "due",
                  title: "반납 예정",
                  render: (loan) => formatDate(loan.currentDueDate),
                },
                {
                  key: "returned",
                  title: "반납일",
                  render: (loan) => formatDate(loan.returnedAt),
                },
              ]}
            />
          </Card>
        </section>
      </div>
      <Notice tone="info" title="연장 처리 안내">
        본인 계정의 미반납·비연체 대출만 한 번, 현재 기한에서 7일 연장할 수
        있습니다. 오류 시연은 `loan_renewal` 생성 실패를 가정해 변경 전 Mock
        상태로 되돌립니다. 실제 PostgreSQL 롤백은 실행하지 않습니다.
      </Notice>
    </WorkspaceLayout>
  );
}
