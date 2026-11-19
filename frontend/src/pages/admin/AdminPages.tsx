import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BookCopy,
  BookOpen,
  Boxes,
  CircleAlert,
  Pencil,
  Plus,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { DataTable } from "../../components/tables/DataTable";
import { CatalogFilters } from "../../components/catalog/CatalogFilters";
import {
  emptyCatalogFilters,
  matchesCatalogFilters,
} from "../../services/catalog";
import { WorkspaceLayout } from "../../components/layout/WorkspaceLayout";
import {
  Badge,
  Button,
  Card,
  Field,
  MetricCard,
  Modal,
  ModalFooter,
  Notice,
  PageHeading,
  ResultMessage,
  SectionHeading,
  SearchField,
} from "../../components/ui/Primitives";
import { getKoreanDate } from "../../services/korean-date";
import {
  deriveLoanCounts,
  getAvailability,
  getAuthorsForBook,
  getOverdueDays,
  normalizeIsbn,
} from "../../services/library";
import { useLibraryStore, type ActionResult } from "../../store/libraryStore";
import type { Author, Book, BookFormValues } from "../../types/domain";

function useAdminData() {
  return useLibraryStore(
    useShallow((state) => ({
      users: state.users,
      books: state.books,
      authors: state.authors,
      bookAuthors: state.bookAuthors,
      copies: state.copies,
      occupiedCopyIds: state.occupiedCopyIds,
      loanStatistics: state.loanStatistics,
      loans: state.loans,
      renewals: state.renewals,
      role: state.currentUser?.role,
    })),
  );
}

function getMonthKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(value));
}

function getMonthlyLoanStats(loans: ReturnType<typeof useAdminData>["loans"]) {
  const today = new Date(`${getKoreanDate()}T12:00:00+09:00`);
  const start = new Date(today);
  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() - 5);
  return Array.from({ length: 6 }, (_, index) => {
    const month = new Date(start);
    month.setUTCMonth(start.getUTCMonth() + index);
    const key = getMonthKey(month.toISOString());
    const label = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "short",
    }).format(month);
    return {
      month: label,
      loans: loans.filter((loan) => getMonthKey(loan.borrowedAt) === key)
        .length,
      returns: loans.filter(
        (loan) =>
          loan.returnedAt !== null && getMonthKey(loan.returnedAt) === key,
      ).length,
    };
  });
}

export function AdminDashboardPage() {
  const data = useAdminData();
  const counts = data.loanStatistics ?? deriveLoanCounts(data);
  const members = data.users.filter((user) => user.role === "MEMBER");
  const bookCounts = data.books
    .map((book) => ({
      book,
      count: data.loanStatistics?.byBook[book.bookId] ?? data.loans.filter(
        (loan) =>
          !loan.isCancelled &&
          data.copies.some(
            (copy) =>
              copy.copyId === loan.copyId && copy.bookId === book.bookId,
          ),
      ).length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <WorkspaceLayout
      section={data.role === "LIBRARIAN" ? "librarian" : "admin"}
    >
      <PageHeading
        eyebrow="ADMINISTRATION · OVERVIEW"
        title="관리자 대시보드"
        description="회원, 도서, 소장본과 대출 현황을 공유 DB 데이터에서 집계합니다."
        actions={<Badge tone="blue">ADMIN</Badge>}
      />
      <div className="metric-grid five">
        <MetricCard
          label="전체 회원"
          value={members.length}
          note={`${members.filter((member) => member.accountStatus === "ACTIVE").length}명 활성`}
          icon={<UsersRound size={17} />}
          tone="navy"
        />
        <MetricCard
          label="등록 도서"
          value={data.books.length}
          note={`${data.books.filter((book) => data.copies.some((c) => c.bookId === book.bookId && c.managementStatus !== "RETIRED")).length}종 이용 가능`}
          icon={<BookOpen size={17} />}
          tone="blue"
        />
        <MetricCard
          label="실물 소장본"
          value={data.copies.length}
          note={`${data.copies.filter((copy) => copy.managementStatus === "ACTIVE").length}권 활성`}
          icon={<BookCopy size={17} />}
          tone="blue"
        />
        <MetricCard
          label="현재 대출"
          value={counts.active}
          note="미반납 대출 기준"
          icon={<Boxes size={17} />}
          tone="green"
        />
        <MetricCard
          label="현재 연체"
          value={counts.overdue}
          note="KST 기준 자동 산출"
          icon={<CircleAlert size={17} />}
          tone={counts.overdue ? "red" : "green"}
        />
      </div>
      <div className="admin-dashboard-grid">
        <Card className="panel-card">
          <SectionHeading
            title="관리 메뉴"
            description="직원 계정과 비식별 장서 통계를 확인합니다."
          />
          <div className="admin-action-grid">
            <Link to="/admin/members">
              <span>
                <UsersRound size={17} />
              </span>
              <strong>계정 현황</strong>
              <small>역할과 계정 상태</small>
              <ArrowRight size={15} />
            </Link>
            <Link to="/admin/books">
              <span>
                <BookOpen size={17} />
              </span>
              <strong>도서 관리</strong>
              <small>서지와 실물 소장본</small>
              <ArrowRight size={15} />
            </Link>
            <Link to="/admin/statistics">
              <span>
                <ShieldCheck size={17} />
              </span>
              <strong>업무 통계</strong>
              <small>대출·반납·연체 이력</small>
              <ArrowRight size={15} />
            </Link>
            <Link to="/admin/db-console">
              <span>
                <Boxes size={17} />
              </span>
              <strong>DB Console</strong>
              <small>설계 스키마 탐색</small>
              <ArrowRight size={15} />
            </Link>
          </div>
        </Card>
        <Card className="panel-card admin-recent-card">
          <SectionHeading
            title="도서별 이용 집계"
            description="개인 이용 이력 없이 도서 단위 건수만 표시합니다."
            action={
              <Link to="/admin/statistics" className="text-action">
                전체 통계 <ArrowRight size={14} />
              </Link>
            }
          />
          <div className="admin-recent-list">
            {bookCounts.map(({ book, count }) => (
              <div key={book.bookId}>
                <strong>{book.title}</strong>
                <Badge tone="blue">{count}건</Badge>
              </div>
            ))}
          </div>
          {counts.active > 0 && (
            <p className="admin-recent-footnote">
              현재 {counts.active}건이 미반납 상태입니다.
            </p>
          )}
        </Card>
      </div>
      <Notice tone="info" title="집계 기준">
        모든 수치는 PostgreSQL DB 데이터에서 계산합니다. 새 대출·반납·연장은
        관리자 통계에도 즉시 반영됩니다.
      </Notice>
    </WorkspaceLayout>
  );
}

export function AdminBooksPage() {
  const [filters, setFilters] = useState(emptyCatalogFilters);
  const data = useAdminData();
  const saveBook = useLibraryStore((state) => state.saveBook);
  const addCopy = useLibraryStore((state) => state.addCopy);
  const toggleCopyStatus = useLibraryStore((state) => state.toggleCopyStatus);
  const [params] = useSearchParams();
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  useEffect(() => {
    setQuery(params.get("q") ?? "");
  }, [params]);
  const searchBy = params.get("by");
  const searchText = query.trim().toLocaleLowerCase();
  let normalizedIsbn: string | null = null;
  let isbnSearchError = "";
  if (searchText) {
    try {
      normalizedIsbn = normalizeIsbn(query);
    } catch (error) {
      if (searchBy === "isbn") {
        isbnSearchError = error instanceof Error ? error.message : "ISBN 형식을 확인하세요.";
      }
    }
  }
  const [editingBookId, setEditingBookId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const visibleBooks = data.books
    .filter((book) => {
      if (!matchesCatalogFilters(book, data, filters)) return false;
      if (
        data.role !== "LIBRARIAN" &&
        !data.copies.some(
          (c) => c.bookId === book.bookId && c.managementStatus !== "RETIRED",
        )
      )
        return false;
      const authors = getAuthorsForBook(book.bookId, data)
        .map((author) => author.authorName)
        .join(" ");
      if (!searchText) return true;
      if (searchBy === "isbn") return book.isbn !== null && book.isbn === normalizedIsbn;
      if (searchBy === "author") return authors.toLocaleLowerCase().includes(searchText);
      return (
        `${book.title} ${book.isbn ?? ""} ${authors}`
          .toLocaleLowerCase()
          .includes(searchText) ||
        (normalizedIsbn !== null && book.isbn === normalizedIsbn)
      );
    })
    .sort(
      (a, b) => a.title.localeCompare(b.title, "ko") || a.bookId - b.bookId,
    );
  const editingBook = data.books.find((book) => book.bookId === editingBookId);

  return (
    <WorkspaceLayout
      section={data.role === "LIBRARIAN" ? "librarian" : "admin"}
    >
      <PageHeading
        eyebrow="ADMINISTRATION · CATALOG"
        title="도서 관리"
        description="ISBN 기반 서지정보와 저자 연결, 개별 실물 소장본을 관리합니다."
        actions={
          data.role === "LIBRARIAN" && (
            <Button
              onClick={() => {
                setShowCreate(true);
                setResult(null);
              }}
              icon={<Plus size={16} />}
            >
              도서 등록
            </Button>
          )
        }
      />
      <div className="book-management-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          label="도서 검색"
          placeholder={searchBy === "isbn" ? "ISBN-10 또는 ISBN-13" : "도서명, ISBN, 저자 검색"}
        />
        {isbnSearchError && <p role="alert">{isbnSearchError}</p>}
        <span className="toolbar-count">
          {visibleBooks.length}종 · {data.copies.length}권
        </span>
      </div>
      <CatalogFilters value={filters} onChange={setFilters} />
      {result && <ResultMessage message={result.message} error={!result.ok} />}
      <Card className="table-card">
        <DataTable
          rows={visibleBooks}
          getRowKey={(book) => book.bookId}
          emptyMessage="검색 조건에 맞는 도서가 없습니다."
          columns={[
            {
              key: "book",
              title: "도서",
              render: (book) => (
                <span className="table-title-cell">
                  <strong>{book.title}</strong>
                  <small>
                    {getAuthorsForBook(book.bookId, data)
                      .map((author) => author.authorName)
                      .join(", ")}
                  </small>
                </span>
              ),
            },
            {
              key: "isbn",
              title: "ISBN-13",
              render: (book) => <code>{book.isbn ?? "없음"}</code>,
            },
            {
              key: "copies",
              title: "소장본",
              render: (book) => {
                const availability = getAvailability(book.bookId, data);
                return (
                  <span>
                    {availability.available} / {availability.total} 이용 가능
                  </span>
                );
              },
            },
            {
              key: "status",
              title: "검색 노출",
              render: (book) => (
                <Badge
                  tone={
                    data.copies.some(
                      (c) =>
                        c.bookId === book.bookId &&
                        c.managementStatus !== "RETIRED",
                    )
                      ? "green"
                      : "neutral"
                  }
                >
                  {data.copies.some(
                    (c) =>
                      c.bookId === book.bookId &&
                      c.managementStatus !== "RETIRED",
                  )
                    ? "일반 열람"
                    : "사서 전용"}
                </Badge>
              ),
            },
            {
              key: "actions",
              title: "관리",
              render: (book) =>
                data.role === "LIBRARIAN" ? (
                  <Button onClick={() => setEditingBookId(book.bookId)}>
                    정보·소장본
                  </Button>
                ) : (
                  <Button
                    variant="quiet"
                    onClick={() => setEditingBookId(book.bookId)}
                  >
                    상세 조회
                  </Button>
                ),
            },
          ]}
        />
      </Card>
      <Notice tone="info" title="삭제 제한">
        서지정보는 보존하며 제적은 소장본에만 적용합니다. ISBN은 선택 입력이며
        ISBN-10/13을 검증합니다.
      </Notice>
      {showCreate && (
        <BookEditorModal
          key="create-book"
          data={data}
          onClose={() => setShowCreate(false)}
          onSave={async (values) => {
            const outcome = await saveBook(values);
            setResult(outcome);
            if (outcome.ok) setShowCreate(false);
            return outcome;
          }}
        />
      )}
      {editingBook && data.role !== "LIBRARIAN" && (
        <Modal title={editingBook.title} onClose={() => setEditingBookId(null)}>
          <p>
            {getAuthorsForBook(editingBook.bookId, data)
              .map((a) => a.authorName)
              .join(", ")}
          </p>
          <p>
            ISBN {editingBook.isbn ?? "없음"} ·{" "}
            {editingBook.publisher ?? "출판사 미상"} ·{" "}
            {editingBook.publicationYear ?? "발행연도 미상"}
          </p>
          <p>
            분류: {editingBook.categoryCode} · 전체 소장본{" "}
            {getAvailability(editingBook.bookId, data).total}권 / 대출 가능{" "}
            {getAvailability(editingBook.bookId, data).available}권
          </p>
          <DataTable
            rows={data.copies.filter((c) => c.bookId === editingBook.bookId)}
            getRowKey={(c) => c.copyId}
            columns={[
              { key: "copyCode", title: "관리번호", render: (c) => c.copyCode },
              {
                key: "managementStatus",
                title: "관리 상태",
                render: (c) => c.managementStatus,
              },
            ]}
          />
        </Modal>
      )}
      {editingBook && data.role === "LIBRARIAN" && (
        <BookEditorModal
          key={`edit-${editingBook.bookId}`}
          book={editingBook}
          authors={getAuthorsForBook(editingBook.bookId, data)
            .map((author) => author.authorName)
            .join("; ")}
          copies={data.copies.filter(
            (copy) => copy.bookId === editingBook.bookId,
          )}
          data={data}
          onClose={() => setEditingBookId(null)}
          onSave={async (values) => {
            const outcome = await saveBook(values, editingBook.bookId);
            setResult(outcome);
            if (outcome.ok) setEditingBookId(null);
            return outcome;
          }}
          onAddCopy={async (code) => {
            const outcome = await addCopy(editingBook.bookId, code);
            setResult(outcome);
            return outcome;
          }}
          onToggleCopy={async (id) => {
            const outcome = await toggleCopyStatus(id);
            setResult(outcome);
          }}
        />
      )}
    </WorkspaceLayout>
  );
}

function BookEditorModal({
  book,
  authors = "",
  copies = [],
  data,
  onClose,
  onSave,
  onAddCopy,
  onToggleCopy,
}: {
  book?: Book;
  authors?: string;
  copies?: ReturnType<typeof useAdminData>["copies"];
  data?: ReturnType<typeof useAdminData>;
  onClose: () => void;
  onSave: (values: BookFormValues) => Promise<ActionResult> | ActionResult;
  onAddCopy?: (code: string) => Promise<ActionResult> | ActionResult;
  onToggleCopy?: (id: number) => Promise<void> | void;
}) {
  const [values, setValues] = useState<BookFormValues>({
    isbn: book?.isbn ?? "",
    title: book?.title ?? "",
    publisher: book?.publisher ?? "",
    publicationYear: book?.publicationYear?.toString() ?? "",
    authorNames: authors,
    authorIds:
      book && data
        ? data.bookAuthors
            .filter((row) => row.bookId === book.bookId)
            .map((row) => row.authorId)
        : [],
    categoryCode: book?.categoryCode ?? "DEMO_GENERAL",
  });
  const [copyCode, setCopyCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingCopy, setAddingCopy] = useState(false);
  const [message, setMessage] = useState<ActionResult | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const outcome = await onSave(values);
      setMessage(outcome);
    } finally {
      setSaving(false);
    }
  }

  async function submitCopy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onAddCopy || addingCopy) return;
    setAddingCopy(true);
    try {
      const outcome = await onAddCopy(copyCode);
      setMessage(outcome);
      if (outcome.ok) setCopyCode("");
    } finally {
      setAddingCopy(false);
    }
  }

  return (
    <Modal
      title={book ? "도서 정보 수정" : "도서 등록"}
      description="서지정보와 저자 연결을 PostgreSQL DB에 저장합니다."
      onClose={onClose}
      wide
    >
      <div className="book-editor-layout">
        <form onSubmit={submit} className="modal-form">
          <div className="form-grid-two">
            <Field label="도서 제목">
              <input
                required
                maxLength={255}
                value={values.title}
                onChange={(event) =>
                  setValues({ ...values, title: event.target.value })
                }
                placeholder="도서 제목"
              />
            </Field>
            <Field label="ISBN-10/13 · 선택">
              <input
                maxLength={17}
                value={values.isbn}
                onChange={(event) =>
                  setValues({ ...values, isbn: event.target.value })
                }
                placeholder="978-0-000-00000-0"
              />
            </Field>
          </div>
          <Field label="분류 코드">
            <input value={values.categoryCode} readOnly />
          </Field>
          <label>
            <input
              type="checkbox"
              checked={!!values.confirmSimilar}
              onChange={(e) =>
                setValues({ ...values, confirmSimilar: e.target.checked })
              }
            />{" "}
            무ISBN 유사 도서를 검토하고 신규 등록합니다.
          </label>
          <Field label="저자 ID 선택 · 동명이인 구분">
            <select
              multiple
              value={values.authorIds?.map(String) ?? []}
              onChange={(e) =>
                setValues({
                  ...values,
                  authorIds: Array.from(e.target.selectedOptions).map((o) =>
                    Number(o.value),
                  ),
                })
              }
            >
              {data?.authors.map((a) => (
                <option key={a.authorId} value={a.authorId}>
                  #{a.authorId} {a.authorName}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="저자 연결"
            hint="여러 명은 쉼표 또는 세미콜론으로 구분합니다."
          >
            <input
              required={!values.authorIds?.length}
              value={values.authorNames}
              onChange={(event) =>
                setValues({
                  ...values,
                  authorNames: event.target.value,
                  authorIds: [],
                })
              }
              placeholder="저자 이름"
            />
          </Field>
          <div className="form-grid-two">
            <Field label="출판사">
              <input
                maxLength={150}
                value={values.publisher}
                onChange={(event) =>
                  setValues({ ...values, publisher: event.target.value })
                }
                placeholder="선택 입력"
              />
            </Field>
            <Field label="발행연도">
              <input
                inputMode="numeric"
                value={values.publicationYear}
                onChange={(event) =>
                  setValues({ ...values, publicationYear: event.target.value })
                }
                placeholder="예: 2024"
              />
            </Field>
          </div>
          {message && (
            <ResultMessage message={message.message} error={!message.ok} />
          )}
          <ModalFooter>
            <Button variant="secondary" type="button" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "저장 중…" : book ? "변경 저장" : "도서 등록"}
            </Button>
          </ModalFooter>
        </form>
        {book && data && onAddCopy && onToggleCopy && (
          <aside className="copy-management-panel">
            <SectionHeading
              title="소장본 관리"
              description={`${copies.length}개 실물`}
            />
            <form className="inline-copy-form" onSubmit={submitCopy}>
              <label className="sr-only" htmlFor="new-copy-code">
                새 소장본 관리번호
              </label>
              <input
                id="new-copy-code"
                value={copyCode}
                onChange={(event) => setCopyCode(event.target.value)}
                placeholder="시스템 자동 발급"
                disabled
                maxLength={50}
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={addingCopy}
                icon={<Plus size={15} />}
              >
                {addingCopy ? "추가 중…" : "추가"}
              </Button>
            </form>
            <div className="copy-admin-list">
              {copies.map((copy) => (
                <div key={copy.copyId}>
                  <span>
                    <code>{copy.copyCode}</code>
                    <small>
                      {data.loans.some(
                        (loan) =>
                          loan.copyId === copy.copyId &&
                          !loan.isCancelled &&
                          loan.returnedAt === null,
                      )
                        ? "대출 중"
                        : copy.managementStatus === "RETIRED"
                          ? "제적"
                          : "비치 중"}
                    </small>
                  </span>
                  <Link
                    to="/librarian/copies"
                    className="button button-secondary"
                  >
                    상태 관리
                  </Link>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </Modal>
  );
}

export function AdminAuthorsPage() {
  const data = useAdminData();
  const addAuthor = useLibraryStore((state) => state.addAuthor);
  const renameAuthor = useLibraryStore((state) => state.renameAuthor);
  const [newName, setNewName] = useState("");
  const [editingAuthor, setEditingAuthor] = useState<Author | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const authors = useMemo(
    () =>
      [...data.authors].sort((a, b) =>
        a.authorName.localeCompare(b.authorName, "ko"),
      ),
    [data.authors],
  );

  async function submitAuthor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const outcome = await addAuthor(newName);
      setResult(outcome);
      if (outcome.ok) setNewName("");
    } finally {
      setBusy(false);
    }
  }

  async function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAuthor || busy) return;
    setBusy(true);
    try {
      const outcome = await renameAuthor(editingAuthor.authorId, editingName);
      setResult(outcome);
      if (outcome.ok) setEditingAuthor(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <WorkspaceLayout
      section={data.role === "LIBRARIAN" ? "librarian" : "admin"}
    >
      <PageHeading
        eyebrow="ADMINISTRATION · AUTHORS"
        title="저자 관리"
        description="도서와 연결된 저자 식별자를 추가하고 이름을 수정합니다."
        actions={<Badge tone="blue">AUTHOR CATALOG</Badge>}
      />
      {result && <ResultMessage message={result.message} error={!result.ok} />}
      <form
        hidden={data.role !== "LIBRARIAN"}
        className="author-create-form"
        onSubmit={submitAuthor}
      >
        <Field
          label="새 저자명"
          hint="최대 150자. 동명이인 저자명은 데이터 모델에서 허용합니다."
        >
          <input
            required
            maxLength={150}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="저자 이름을 입력하세요"
          />
        </Field>
        <Button type="submit" disabled={busy} icon={<Plus size={15} />}>
          {busy ? "등록 중…" : "저자 등록"}
        </Button>
      </form>
      <Card className="table-card">
        <div className="table-card-heading">
          <SectionHeading
            title="저자 목록"
            description={`${authors.length}명 · 연결된 도서 정보는 book_author에서 계산합니다.`}
          />
          <Badge tone="neutral">AUTHOR</Badge>
        </div>
        <DataTable
          rows={authors}
          getRowKey={(author) => author.authorId}
          emptyMessage="등록된 저자가 없습니다."
          columns={[
            {
              key: "id",
              title: "저자 ID",
              render: (author) => <code>{author.authorId}</code>,
            },
            {
              key: "name",
              title: "저자명",
              render: (author) => (
                <strong className="table-primary-value">
                  {author.authorName}
                </strong>
              ),
            },
            {
              key: "books",
              title: "연결 도서",
              render: (author) => {
                const names = data.bookAuthors
                  .filter((relation) => relation.authorId === author.authorId)
                  .map(
                    (relation) =>
                      data.books.find((book) => book.bookId === relation.bookId)
                        ?.title,
                  )
                  .filter((title): title is string => Boolean(title));
                return names.length ? (
                  <span className="author-book-list">{names.join(" · ")}</span>
                ) : (
                  <span className="muted-small">연결된 도서 없음</span>
                );
              },
            },
            {
              key: "count",
              title: "연결 수",
              render: (author) =>
                data.bookAuthors.filter(
                  (relation) => relation.authorId === author.authorId,
                ).length,
            },
            {
              key: "action",
              title: "관리",
              render: (author) => (
                <Button
                  disabled={data.role !== "LIBRARIAN"}
                  variant="secondary"
                  onClick={() => {
                    setEditingAuthor(author);
                    setEditingName(author.authorName);
                  }}
                  icon={<Pencil size={14} />}
                >
                  이름 수정
                </Button>
              ),
            },
          ]}
        />
      </Card>
      <Notice tone="info" title="이력과 참조 보존">
        author_name은 UNIQUE 제약이 없어서 동명이인을 허용합니다. 도서에서 참조
        중인 저자를 삭제하지 않고 이름을 수정하며, 연결은 `book_author`에
        보존합니다.
      </Notice>
      {editingAuthor && (
        <Modal
          title="저자명 수정"
          description={`AUTHOR #${editingAuthor.authorId}`}
          onClose={() => setEditingAuthor(null)}
        >
          <form onSubmit={submitRename}>
            <Field label="저자명">
              <input
                autoFocus
                required
                maxLength={150}
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
              />
            </Field>
            <ModalFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditingAuthor(null)}
              >
                취소
              </Button>
              <Button type="submit" disabled={busy} icon={<Pencil size={14} />}>
                {busy ? "저장 중…" : "저자명 저장"}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </WorkspaceLayout>
  );
}

export function AdminStatisticsPage() {
  const data = useAdminData();
  const counts = data.loanStatistics ?? deriveLoanCounts(data);
  const monthly = data.loanStatistics?.monthly ?? getMonthlyLoanStats(data.loans);
  const byBook = data.books
    .map((book) => ({
      book: book.title,
      loans: data.loanStatistics?.byBook[book.bookId] ?? data.loans.filter(
        (loan) =>
          data.copies.find((copy) => copy.copyId === loan.copyId)?.bookId ===
          book.bookId,
      ).length,
    }))
    .sort((a, b) => b.loans - a.loans)
    .slice(0, 6);
  const librarians = data.users
    .filter((user) => user.role === "LIBRARIAN")
    .map((user) => ({
      user,
      checkouts: data.loanStatistics?.byLibrarian[user.userId]?.checkouts ?? data.loans.filter(
        (loan) => loan.checkedOutByUserId === user.userId,
      ).length,
      returns: data.loanStatistics?.byLibrarian[user.userId]?.returns ?? data.loans.filter(
        (loan) => loan.returnedByUserId === user.userId,
      ).length,
    }));
  const overdueHistory = data.loanStatistics?.overdueHistory ?? data.loans.filter(
    (loan) => loan.returnedAt !== null && getOverdueDays(loan) > 0,
  ).length;

  return (
    <WorkspaceLayout
      section={data.role === "LIBRARIAN" ? "librarian" : "admin"}
    >
      <PageHeading
        eyebrow="ADMINISTRATION · ANALYTICS"
        title="업무 통계"
        description="대출, 반납, 연체, 도서별·사서별 이력을 동일한 PostgreSQL 기록에서 계산합니다."
      />
      <div className="metric-grid four">
        <MetricCard
          label="누적 대출"
          value={data.loanStatistics?.total ?? data.loans.length}
          note="현재·과거 이력 포함"
          icon={<BookCopy size={17} />}
          tone="navy"
        />
        <MetricCard
          label="현재 대출"
          value={counts.active}
          note="미반납 이력 기준"
          icon={<BookOpen size={17} />}
          tone="blue"
        />
        <MetricCard
          label="반납 완료"
          value={counts.returned}
          note="반납 처리 사서 기록 포함"
          icon={<ArrowRight size={17} />}
          tone="green"
        />
        <MetricCard
          label="현재 연체"
          value={counts.overdue}
          note={`과거 연체 반납 ${overdueHistory}건`}
          icon={<CircleAlert size={17} />}
          tone={counts.overdue ? "red" : "green"}
        />
      </div>
      <div className="statistics-chart-grid">
        <Card className="chart-card">
          <SectionHeading
            title="월별 대출·반납"
            description="최근 6개월의 실제 대출·반납 기록"
          />
          <div className="chart-canvas">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthly}
                margin={{ top: 12, right: 8, left: -14, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e8edf3"
                />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#748197", fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#748197", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    borderColor: "#dfe6ef",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="loans"
                  name="대출"
                  fill="#294d7a"
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="returns"
                  name="반납"
                  fill="#91abc9"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="chart-card">
          <SectionHeading
            title="도서별 대출 이력"
            description="누적 대출 기록 기준 상위 6종"
          />
          <div className="chart-canvas">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={byBook}
                margin={{ top: 14, right: 12, left: -12, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e8edf3"
                />
                <XAxis
                  dataKey="book"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#748197", fontSize: 10 }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={52}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#748197", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    borderColor: "#dfe6ef",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="loans"
                  name="대출 건수"
                  stroke="#294d7a"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#294d7a" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <div className="statistics-lists-grid">
        <Card className="table-card">
          <SectionHeading
            title="사서별 처리 이력"
            description="대출·반납 FK 처리자 참조 기준"
          />
          <DataTable
            rows={librarians}
            getRowKey={(row) => row.user.userId}
            columns={[
              {
                key: "librarian",
                title: "사서",
                render: (row) => (
                  <span className="table-title-cell">
                    <strong>{row.user.fullName}</strong>
                    <small>ID {row.user.userId}</small>
                  </span>
                ),
              },
              {
                key: "checkout",
                title: "대출 처리",
                render: (row) => `${row.checkouts}건`,
              },
              {
                key: "return",
                title: "반납 처리",
                render: (row) => `${row.returns}건`,
              },
            ]}
          />
        </Card>
        <Card className="table-card">
          <SectionHeading
            title="도서별 대출 집계"
            description="각 book_id에 연결된 전체 loan 수"
          />
          <DataTable
            rows={byBook}
            getRowKey={(row) => row.book}
            columns={[
              {
                key: "book",
                title: "도서",
                render: (row) => <strong>{row.book}</strong>,
              },
              {
                key: "loans",
                title: "누적 대출",
                render: (row) => <Badge tone="blue">{row.loans}건</Badge>,
              },
            ]}
          />
        </Card>
      </div>
      <Notice tone="info" title="통계 산출 방식">
        월별 수치는 `borrowed_at`, `returned_at`, 도서별 이력은
        `loan.copy_id`에서 계산합니다. 임의로 만든 수치는 사용하지 않습니다.
      </Notice>
    </WorkspaceLayout>
  );
}