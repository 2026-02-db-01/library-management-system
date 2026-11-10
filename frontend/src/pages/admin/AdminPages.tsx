import { useMemo, useState, type FormEvent } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, BookCopy, BookOpen, Boxes, CircleAlert, Pencil, Plus, ShieldCheck, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { DataTable } from '../../components/tables/DataTable'
import { WorkspaceLayout } from '../../components/layout/WorkspaceLayout'
import { Badge, Button, Card, Field, MetricCard, Modal, ModalFooter, Notice, PageHeading, ResultMessage, SectionHeading, SearchField } from '../../components/ui/Primitives'
import { getKoreanDate } from '../../data/mock/seed'
import { deriveLoanCounts, formatDate, getAvailability, getAuthorsForBook, getBookForCopy, getOverdueDays, isOverdue } from '../../services/library'
import { useLibraryStore, type ActionResult } from '../../store/libraryStore'
import type { Author, Book, BookFormValues, LibraryUser, UserRole } from '../../types/domain'

function useAdminData() {
  return useLibraryStore(useShallow((state) => ({
    users: state.users,
    books: state.books,
    authors: state.authors,
    bookAuthors: state.bookAuthors,
    copies: state.copies,
    loans: state.loans,
    renewals: state.renewals,
  })))
}

function roleLabel(role: UserRole) {
  return role === 'MEMBER' ? '회원' : role === 'LIBRARIAN' ? '사서' : '관리자'
}

function getMonthKey(value: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).format(new Date(value))
}

function getMonthlyLoanStats(loans: ReturnType<typeof useAdminData>['loans']) {
  const today = new Date(`${getKoreanDate()}T12:00:00+09:00`)
  const start = new Date(today)
  start.setUTCDate(1)
  start.setUTCMonth(start.getUTCMonth() - 5)
  return Array.from({ length: 6 }, (_, index) => {
    const month = new Date(start)
    month.setUTCMonth(start.getUTCMonth() + index)
    const key = getMonthKey(month.toISOString())
    const label = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'short' }).format(month)
    return {
      month: label,
      loans: loans.filter((loan) => getMonthKey(loan.borrowedAt) === key).length,
      returns: loans.filter((loan) => loan.returnedAt !== null && getMonthKey(loan.returnedAt) === key).length,
    }
  })
}

export function AdminDashboardPage() {
  const data = useAdminData()
  const counts = deriveLoanCounts(data)
  const members = data.users.filter((user) => user.role === 'MEMBER')
  const activeLoans = data.loans.filter((loan) => loan.returnedAt === null)
  const recentLoans = [...data.loans].sort((a, b) => b.borrowedAt.localeCompare(a.borrowedAt)).slice(0, 5)

  return (
    <WorkspaceLayout section="admin">
      <PageHeading eyebrow="ADMINISTRATION · OVERVIEW" title="관리자 대시보드" description="회원, 도서, 소장본과 대출 현황을 공유 데모 상태에서 집계합니다." actions={<Badge tone="blue">DEMO ADMIN</Badge>} />
      <div className="metric-grid five">
        <MetricCard label="전체 회원" value={members.length} note={`${members.filter((member) => member.accountStatus === 'ACTIVE').length}명 활성`} icon={<UsersRound size={17} />} tone="navy" />
        <MetricCard label="등록 도서" value={data.books.length} note={`${data.books.filter((book) => book.catalogStatus === 'ACTIVE').length}종 이용 가능`} icon={<BookOpen size={17} />} tone="blue" />
        <MetricCard label="실물 소장본" value={data.copies.length} note={`${data.copies.filter((copy) => copy.managementStatus === 'ACTIVE').length}권 활성`} icon={<BookCopy size={17} />} tone="blue" />
        <MetricCard label="현재 대출" value={counts.active} note="미반납 대출 기준" icon={<Boxes size={17} />} tone="green" />
        <MetricCard label="현재 연체" value={counts.overdue} note="KST 기준 자동 산출" icon={<CircleAlert size={17} />} tone={counts.overdue ? 'red' : 'green'} />
      </div>
      <div className="admin-dashboard-grid">
        <Card className="panel-card">
          <SectionHeading title="관리 메뉴" description="계정·장서·업무 통계를 관리합니다." />
          <div className="admin-action-grid">
            <Link to="/admin/members"><span><UsersRound size={17} /></span><strong>회원 관리</strong><small>역할과 계정 상태</small><ArrowRight size={15} /></Link>
            <Link to="/admin/books"><span><BookOpen size={17} /></span><strong>도서 관리</strong><small>서지와 실물 소장본</small><ArrowRight size={15} /></Link>
            <Link to="/admin/statistics"><span><ShieldCheck size={17} /></span><strong>업무 통계</strong><small>대출·반납·연체 이력</small><ArrowRight size={15} /></Link>
            <Link to="/admin/db-console"><span><Boxes size={17} /></span><strong>DB Console</strong><small>설계 스키마 탐색</small><ArrowRight size={15} /></Link>
          </div>
        </Card>
        <Card className="panel-card admin-recent-card">
          <SectionHeading title="최근 대출 이력" description="기존 대출 기록에서 가져왔습니다." action={<Link to="/admin/statistics" className="text-action">전체 통계 <ArrowRight size={14} /></Link>} />
          <div className="admin-recent-list">{recentLoans.map((loan) => {
            const copy = data.copies.find((item) => item.copyId === loan.copyId)
            const book = getBookForCopy(loan.copyId, data)
            const member = data.users.find((user) => user.userId === loan.memberUserId)
            return <div key={loan.loanId}><span className="recent-loan-date">{formatDate(loan.borrowedAt)}</span><span className="table-title-cell"><strong>{book?.title ?? '도서 정보 없음'}</strong><small>{member?.fullName ?? '회원 정보 없음'} · {copy?.copyCode ?? '—'}</small></span><Badge tone={loan.returnedAt ? 'neutral' : isOverdue(loan) ? 'red' : 'blue'}>{loan.returnedAt ? '반납 완료' : isOverdue(loan) ? `연체 ${getOverdueDays(loan)}일` : '대출 중'}</Badge></div>
          })}</div>
          {activeLoans.length > 0 && <p className="admin-recent-footnote">현재 {activeLoans.length}건이 미반납 상태입니다.</p>}
        </Card>
      </div>
      <Notice tone="info" title="집계 기준">모든 수치는 같은 Mock Data에서 계산합니다. 새 대출·반납·연장은 관리자 통계에도 즉시 반영됩니다.</Notice>
    </WorkspaceLayout>
  )
}

export function AdminMembersPage() {
  const data = useAdminData()
  const addMember = useLibraryStore((state) => state.addMember)
  const setUserStatus = useLibraryStore((state) => state.setUserStatus)
  const setUserRole = useLibraryStore((state) => state.setUserRole)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL')
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [showAddMember, setShowAddMember] = useState(false)
  const [result, setResult] = useState<ActionResult | null>(null)
  const selectedUser = data.users.find((user) => user.userId === selectedUserId)
  const visibleUsers = data.users.filter((user) => {
    const text = `${user.fullName} ${user.loginId} ${user.userId}`.toLocaleLowerCase()
    return text.includes(query.trim().toLocaleLowerCase()) && (roleFilter === 'ALL' || user.role === roleFilter)
  }).sort((a, b) => a.userId - b.userId)
  const memberLoans = selectedUser ? data.loans.filter((loan) => loan.memberUserId === selectedUser.userId) : []

  function toggleStatus(userId: number) {
    setResult(setUserStatus(userId))
  }

  function submitMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const outcome = addMember({ loginId: String(form.get('loginId') ?? ''), fullName: String(form.get('fullName') ?? ''), contact: String(form.get('contact') ?? '') })
    setResult(outcome)
    if (outcome.ok) setShowAddMember(false)
  }

  return (
    <WorkspaceLayout section="admin">
      <PageHeading eyebrow="ADMINISTRATION · ACCOUNTS" title="회원 관리" description="계정 목록에서 역할과 상태를 확인하고 데모 계정을 관리합니다." actions={<Button onClick={() => { setShowAddMember(true); setResult(null) }} icon={<Plus size={16} />}>회원 추가</Button>} />
      <div className="member-management-toolbar">
        <SearchField value={query} onChange={setQuery} label="이름 또는 ID 검색" placeholder="이름, 로그인 ID, 사용자 ID 검색" />
        <select className="filter-select" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)} aria-label="역할 필터"><option value="ALL">전체 역할</option><option value="MEMBER">회원</option><option value="LIBRARIAN">사서</option><option value="ADMIN">관리자</option></select>
        <span className="toolbar-count">{visibleUsers.length}개 계정</span>
      </div>
      {result && <ResultMessage message={result.message} error={!result.ok} />}
      <Card className="table-card">
        <DataTable
          rows={visibleUsers}
          getRowKey={(user) => user.userId}
          emptyMessage="검색 조건에 맞는 계정이 없습니다."
          columns={[
            { key: 'name', title: '사용자', render: (user) => <span className="user-row-cell"><span className="user-avatar">{user.fullName.slice(0, 1)}</span><span className="table-title-cell"><strong>{user.fullName}</strong><small>{user.loginId}</small></span></span> },
            { key: 'id', title: '사용자 ID', render: (user) => <code>{user.userId}</code> },
            { key: 'role', title: '역할', render: (user) => <Badge tone={user.role === 'ADMIN' ? 'blue' : user.role === 'LIBRARIAN' ? 'amber' : 'neutral'}>{roleLabel(user.role)}</Badge> },
            { key: 'status', title: '계정 상태', render: (user) => <Badge tone={user.accountStatus === 'ACTIVE' ? 'green' : 'neutral'}>{user.accountStatus === 'ACTIVE' ? '활성' : '비활성'}</Badge> },
            { key: 'created', title: '등록일', render: (user) => formatDate(user.createdAt) },
            { key: 'actions', title: '관리', render: (user) => <div className="row-actions"><Button variant="quiet" onClick={() => setSelectedUserId(user.userId)}>상세</Button><Button variant={user.accountStatus === 'ACTIVE' ? 'secondary' : 'primary'} onClick={() => toggleStatus(user.userId)}>{user.accountStatus === 'ACTIVE' ? '비활성화' : '활성화'}</Button></div> },
          ]}
        />
      </Card>
      <Notice tone="info" title="계정 이력 보존">회원 탈퇴는 이력을 삭제하지 않고 INACTIVE로 전환합니다. 미반납 대출이 있는 회원은 비활성화할 수 없습니다.</Notice>

      {showAddMember && <Modal title="데모 회원 추가" description="실제 계정이나 인증을 만들지 않고 Mock Store에만 추가합니다." onClose={() => setShowAddMember(false)}>
        <form onSubmit={submitMember} className="modal-form">
          <Field label="로그인 ID"><input name="loginId" maxLength={50} required placeholder="library.member.06" /></Field>
          <Field label="이름"><input name="fullName" maxLength={100} required placeholder="회원 이름" /></Field>
          <Field label="연락처" hint="비밀번호나 인증 정보는 이 데모에서 입력·저장하지 않습니다."><input name="contact" maxLength={50} placeholder="선택 입력" /></Field>
          <ModalFooter><Button variant="secondary" type="button" onClick={() => setShowAddMember(false)}>취소</Button><Button type="submit">데모 회원 등록</Button></ModalFooter>
        </form>
      </Modal>}

      {selectedUser && <MemberDetailModal user={selectedUser} loans={memberLoans} onClose={() => setSelectedUserId(null)} onStatusChange={() => setResult(setUserStatus(selectedUser.userId))} onRoleChange={(role) => setResult(setUserRole(selectedUser.userId, role))} data={data} />}
    </WorkspaceLayout>
  )
}

function MemberDetailModal({ user, loans, onClose, onStatusChange, onRoleChange, data }: { user: LibraryUser; loans: ReturnType<typeof useAdminData>['loans']; onClose: () => void; onStatusChange: () => void; onRoleChange: (role: UserRole) => void; data: ReturnType<typeof useAdminData> }) {
  const openLoans = loans.filter((loan) => loan.returnedAt === null)
  const activeLoans = data.loans.filter((loan) => loan.returnedAt === null && loan.memberUserId === user.userId)
  return (
    <Modal title={`${user.fullName} 회원 상세`} description={`사용자 ID ${user.userId} · ${user.loginId}`} onClose={onClose}>
      <div className="member-detail-body">
        <div className="member-detail-summary"><span className="user-avatar user-avatar-large">{user.fullName.slice(0, 1)}</span><div><strong>{user.fullName}</strong><small>{user.contact ?? '연락처 없음'}</small></div><Badge tone={user.accountStatus === 'ACTIVE' ? 'green' : 'neutral'}>{user.accountStatus === 'ACTIVE' ? '활성' : '비활성'}</Badge></div>
        <div className="member-detail-fields"><div><span>역할</span><select value={user.role} onChange={(event) => onRoleChange(event.target.value as UserRole)} disabled={activeLoans.length > 0 && user.role === 'MEMBER'} aria-label="사용자 역할"><option value="MEMBER">회원</option><option value="LIBRARIAN">사서</option><option value="ADMIN">관리자</option></select></div><div><span>등록일</span><strong>{formatDate(user.createdAt)}</strong></div><div><span>대출 이력</span><strong>{loans.length}건</strong></div><div><span>현재 대출</span><strong>{activeLoans.length}건</strong></div></div>
        <div className="member-current-loans"><strong>현재 대출</strong>{activeLoans.length ? activeLoans.map((loan) => <div key={loan.loanId}><span>{getBookForCopy(loan.copyId, data)?.title ?? '도서 정보 없음'}</span><Badge tone={isOverdue(loan) ? 'red' : 'neutral'}>{isOverdue(loan) ? `연체 ${getOverdueDays(loan)}일` : `기한 ${formatDate(loan.currentDueDate)}`}</Badge></div>) : <p>현재 대출 중인 도서가 없습니다.</p>}</div>
        <ModalFooter><Button variant="secondary" onClick={onClose}>닫기</Button><Button variant={user.accountStatus === 'ACTIVE' ? 'danger' : 'primary'} disabled={openLoans.length > 0 && user.role === 'MEMBER' && user.accountStatus === 'ACTIVE'} onClick={onStatusChange}>{user.accountStatus === 'ACTIVE' ? '계정 비활성화' : '계정 활성화'}</Button></ModalFooter>
      </div>
    </Modal>
  )
}

export function AdminBooksPage() {
  const data = useAdminData()
  const saveBook = useLibraryStore((state) => state.saveBook)
  const addCopy = useLibraryStore((state) => state.addCopy)
  const toggleCopyStatus = useLibraryStore((state) => state.toggleCopyStatus)
  const setBookStatus = useLibraryStore((state) => state.setBookStatus)
  const [query, setQuery] = useState('')
  const [editingBookId, setEditingBookId] = useState<number | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [result, setResult] = useState<ActionResult | null>(null)
  const visibleBooks = data.books.filter((book) => {
    const authors = getAuthorsForBook(book.bookId, data).map((author) => author.authorName).join(' ')
    return `${book.title} ${book.isbn} ${authors}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  }).sort((a, b) => a.title.localeCompare(b.title))
  const editingBook = data.books.find((book) => book.bookId === editingBookId)

  return (
    <WorkspaceLayout section="admin">
      <PageHeading eyebrow="ADMINISTRATION · CATALOG" title="도서 관리" description="ISBN 기반 서지정보와 저자 연결, 개별 실물 소장본을 관리합니다." actions={<Button onClick={() => { setShowCreate(true); setResult(null) }} icon={<Plus size={16} />}>도서 등록</Button>} />
      <div className="book-management-toolbar"><SearchField value={query} onChange={setQuery} label="도서 검색" placeholder="도서명, ISBN, 저자 검색" /><span className="toolbar-count">{visibleBooks.length}종 · {data.copies.length}권</span></div>
      {result && <ResultMessage message={result.message} error={!result.ok} />}
      <Card className="table-card">
        <DataTable
          rows={visibleBooks}
          getRowKey={(book) => book.bookId}
          emptyMessage="검색 조건에 맞는 도서가 없습니다."
          columns={[
            { key: 'book', title: '도서', render: (book) => <span className="table-title-cell"><strong>{book.title}</strong><small>{getAuthorsForBook(book.bookId, data).map((author) => author.authorName).join(', ')}</small></span> },
            { key: 'isbn', title: 'ISBN-13', render: (book) => <code>{book.isbn}</code> },
            { key: 'copies', title: '소장본', render: (book) => { const availability = getAvailability(book.bookId, data); return <span>{availability.available} / {availability.total} 이용 가능</span> } },
            { key: 'status', title: '서지 상태', render: (book) => <Badge tone={book.catalogStatus === 'ACTIVE' ? 'green' : 'neutral'}>{book.catalogStatus === 'ACTIVE' ? '활성' : '제적'}</Badge> },
            { key: 'actions', title: '관리', render: (book) => <div className="row-actions"><Button variant="quiet" onClick={() => setEditingBookId(book.bookId)}>정보·소장본</Button><Button variant="secondary" onClick={() => setResult(setBookStatus(book.bookId))}>{book.catalogStatus === 'ACTIVE' ? '제적' : '재등록'}</Button></div> },
          ]}
        />
      </Card>
      <Notice tone="info" title="삭제 제한">도서와 소장본은 대출 이력의 참조 대상입니다. 물리 삭제하지 않고 RETIRED 상태로 관리합니다. 도서 등록은 ISBN-13 형식을 검사합니다.</Notice>
      {showCreate && <BookEditorModal key="create-book" onClose={() => setShowCreate(false)} onSave={(values) => { const outcome = saveBook(values); setResult(outcome); if (outcome.ok) setShowCreate(false); return outcome }} />}
      {editingBook && <BookEditorModal key={`edit-${editingBook.bookId}`} book={editingBook} authors={getAuthorsForBook(editingBook.bookId, data).map((author) => author.authorName).join('; ')} copies={data.copies.filter((copy) => copy.bookId === editingBook.bookId)} data={data} onClose={() => setEditingBookId(null)} onSave={(values) => { const outcome = saveBook(values, editingBook.bookId); setResult(outcome); if (outcome.ok) setEditingBookId(null); return outcome }} onAddCopy={(code) => { const outcome = addCopy(editingBook.bookId, code); setResult(outcome); return outcome }} onToggleCopy={(id) => setResult(toggleCopyStatus(id))} />}
    </WorkspaceLayout>
  )
}

function BookEditorModal({ book, authors = '', copies = [], data, onClose, onSave, onAddCopy, onToggleCopy }: { book?: Book; authors?: string; copies?: ReturnType<typeof useAdminData>['copies']; data?: ReturnType<typeof useAdminData>; onClose: () => void; onSave: (values: BookFormValues) => ActionResult; onAddCopy?: (code: string) => ActionResult; onToggleCopy?: (id: number) => void }) {
  const [values, setValues] = useState<BookFormValues>({ isbn: book?.isbn ?? '', title: book?.title ?? '', publisher: book?.publisher ?? '', publicationYear: book?.publicationYear?.toString() ?? '', authorNames: authors })
  const [copyCode, setCopyCode] = useState('')
  const [message, setMessage] = useState<ActionResult | null>(null)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const outcome = onSave(values)
    setMessage(outcome)
  }

  function submitCopy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!onAddCopy) return
    const outcome = onAddCopy(copyCode)
    setMessage(outcome)
    if (outcome.ok) setCopyCode('')
  }

  return (
    <Modal title={book ? '도서 정보 수정' : '도서 등록'} description="서지정보와 author 연결을 Mock Store에 저장합니다." onClose={onClose} wide>
      <div className="book-editor-layout">
        <form onSubmit={submit} className="modal-form">
          <div className="form-grid-two"><Field label="도서 제목"><input required maxLength={255} value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} placeholder="도서 제목" /></Field><Field label="ISBN-13"><input required maxLength={17} value={values.isbn} onChange={(event) => setValues({ ...values, isbn: event.target.value })} placeholder="978-0-000-00000-0" /></Field></div>
          <Field label="저자 연결" hint="여러 명은 쉼표 또는 세미콜론으로 구분합니다."><input required value={values.authorNames} onChange={(event) => setValues({ ...values, authorNames: event.target.value })} placeholder="저자 이름" /></Field>
          <div className="form-grid-two"><Field label="출판사"><input maxLength={150} value={values.publisher} onChange={(event) => setValues({ ...values, publisher: event.target.value })} placeholder="선택 입력" /></Field><Field label="발행연도"><input inputMode="numeric" value={values.publicationYear} onChange={(event) => setValues({ ...values, publicationYear: event.target.value })} placeholder="예: 2024" /></Field></div>
          {message && <ResultMessage message={message.message} error={!message.ok} />}
          <ModalFooter><Button variant="secondary" type="button" onClick={onClose}>취소</Button><Button type="submit">{book ? '변경 저장' : '도서 등록'}</Button></ModalFooter>
        </form>
        {book && data && onAddCopy && onToggleCopy && <aside className="copy-management-panel">
          <SectionHeading title="소장본 관리" description={`${copies.length}개 실물`} />
          <form className="inline-copy-form" onSubmit={submitCopy}><label className="sr-only" htmlFor="new-copy-code">새 소장본 관리번호</label><input id="new-copy-code" value={copyCode} onChange={(event) => setCopyCode(event.target.value)} placeholder="예: LIB-2026-014" required maxLength={50} /><Button type="submit" variant="secondary" icon={<Plus size={15} />}>추가</Button></form>
          <div className="copy-admin-list">{copies.map((copy) => <div key={copy.copyId}><span><code>{copy.copyCode}</code><small>{data.loans.some((loan) => loan.copyId === copy.copyId && loan.returnedAt === null) ? '대출 중' : copy.managementStatus === 'RETIRED' ? '제적' : '비치 중'}</small></span><Button variant="quiet" disabled={data.loans.some((loan) => loan.copyId === copy.copyId && loan.returnedAt === null)} onClick={() => onToggleCopy(copy.copyId)}>{copy.managementStatus === 'ACTIVE' ? '제적' : '활성화'}</Button></div>)}</div>
        </aside>}
      </div>
    </Modal>
  )
}

export function AdminAuthorsPage() {
  const data = useAdminData()
  const addAuthor = useLibraryStore((state) => state.addAuthor)
  const renameAuthor = useLibraryStore((state) => state.renameAuthor)
  const [newName, setNewName] = useState('')
  const [editingAuthor, setEditingAuthor] = useState<Author | null>(null)
  const [editingName, setEditingName] = useState('')
  const [result, setResult] = useState<ActionResult | null>(null)
  const authors = useMemo(() => [...data.authors].sort((a, b) => a.authorName.localeCompare(b.authorName, 'ko')), [data.authors])

  function submitAuthor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const outcome = addAuthor(newName)
    setResult(outcome)
    if (outcome.ok) setNewName('')
  }

  function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingAuthor) return
    const outcome = renameAuthor(editingAuthor.authorId, editingName)
    setResult(outcome)
    if (outcome.ok) setEditingAuthor(null)
  }

  return (
    <WorkspaceLayout section="admin">
      <PageHeading eyebrow="ADMINISTRATION · AUTHORS" title="저자 관리" description="도서와 연결된 저자 식별자를 추가하고 이름을 수정합니다." actions={<Badge tone="blue">AUTHOR CATALOG</Badge>} />
      {result && <ResultMessage message={result.message} error={!result.ok} />}
      <form className="author-create-form" onSubmit={submitAuthor}>
        <Field label="새 저자명" hint="최대 150자. 동명이인 저자명은 데이터 모델에서 허용합니다."><input required maxLength={150} value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="저자 이름을 입력하세요" /></Field>
        <Button type="submit" icon={<Plus size={15} />}>저자 등록</Button>
      </form>
      <Card className="table-card">
        <div className="table-card-heading"><SectionHeading title="저자 목록" description={`${authors.length}명 · 연결된 도서 정보는 book_author에서 계산합니다.`} /><Badge tone="neutral">AUTHOR</Badge></div>
        <DataTable rows={authors} getRowKey={(author) => author.authorId} emptyMessage="등록된 저자가 없습니다." columns={[
          { key: 'id', title: '저자 ID', render: (author) => <code>{author.authorId}</code> },
          { key: 'name', title: '저자명', render: (author) => <strong className="table-primary-value">{author.authorName}</strong> },
          { key: 'books', title: '연결 도서', render: (author) => {
            const names = data.bookAuthors.filter((relation) => relation.authorId === author.authorId).map((relation) => data.books.find((book) => book.bookId === relation.bookId)?.title).filter((title): title is string => Boolean(title))
            return names.length ? <span className="author-book-list">{names.join(' · ')}</span> : <span className="muted-small">연결된 도서 없음</span>
          } },
          { key: 'count', title: '연결 수', render: (author) => data.bookAuthors.filter((relation) => relation.authorId === author.authorId).length },
          { key: 'action', title: '관리', render: (author) => <Button variant="secondary" onClick={() => { setEditingAuthor(author); setEditingName(author.authorName) }} icon={<Pencil size={14} />}>이름 수정</Button> },
        ]} />
      </Card>
      <Notice tone="info" title="이력과 참조 보존">author_name은 UNIQUE 제약이 없어서 동명이인을 허용합니다. 도서에서 참조 중인 저자를 삭제하지 않고 이름을 수정하며, 연결은 `book_author`에 보존합니다.</Notice>
      {editingAuthor && <Modal title="저자명 수정" description={`AUTHOR #${editingAuthor.authorId}`} onClose={() => setEditingAuthor(null)}>
        <form onSubmit={submitRename}>
          <Field label="저자명"><input autoFocus required maxLength={150} value={editingName} onChange={(event) => setEditingName(event.target.value)} /></Field>
          <ModalFooter><Button type="button" variant="secondary" onClick={() => setEditingAuthor(null)}>취소</Button><Button type="submit" icon={<Pencil size={14} />}>저자명 저장</Button></ModalFooter>
        </form>
      </Modal>}
    </WorkspaceLayout>
  )
}

export function AdminStatisticsPage() {
  const data = useAdminData()
  const counts = deriveLoanCounts(data)
  const monthly = useMemo(() => getMonthlyLoanStats(data.loans), [data.loans])
  const byBook = data.books.map((book) => ({ book: book.title, loans: data.loans.filter((loan) => data.copies.find((copy) => copy.copyId === loan.copyId)?.bookId === book.bookId).length })).sort((a, b) => b.loans - a.loans).slice(0, 6)
  const librarians = data.users.filter((user) => user.role === 'LIBRARIAN').map((user) => ({
    user,
    checkouts: data.loans.filter((loan) => loan.checkedOutByUserId === user.userId).length,
    returns: data.loans.filter((loan) => loan.returnedByUserId === user.userId).length,
  }))
  const overdueHistory = data.loans.filter((loan) => loan.returnedAt !== null && getOverdueDays(loan) > 0).length

  return (
    <WorkspaceLayout section="admin">
      <PageHeading eyebrow="ADMINISTRATION · ANALYTICS" title="업무 통계" description="대출, 반납, 연체, 도서별·사서별 이력을 동일한 데모 기록에서 계산합니다." />
      <div className="metric-grid four">
        <MetricCard label="누적 대출" value={data.loans.length} note="현재·과거 이력 포함" icon={<BookCopy size={17} />} tone="navy" />
        <MetricCard label="현재 대출" value={counts.active} note="미반납 이력 기준" icon={<BookOpen size={17} />} tone="blue" />
        <MetricCard label="반납 완료" value={counts.returned} note="반납 처리 사서 기록 포함" icon={<ArrowRight size={17} />} tone="green" />
        <MetricCard label="현재 연체" value={counts.overdue} note={`과거 연체 반납 ${overdueHistory}건`} icon={<CircleAlert size={17} />} tone={counts.overdue ? 'red' : 'green'} />
      </div>
      <div className="statistics-chart-grid">
        <Card className="chart-card"><SectionHeading title="월별 대출·반납" description="최근 6개월의 실제 Mock Loan 기록" /><div className="chart-canvas"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly} margin={{ top: 12, right: 8, left: -14, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf3" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#748197', fontSize: 12 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#748197', fontSize: 12 }} /><Tooltip contentStyle={{ borderRadius: 8, borderColor: '#dfe6ef', fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="loans" name="대출" fill="#294d7a" radius={[3, 3, 0, 0]} /><Bar dataKey="returns" name="반납" fill="#91abc9" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
        <Card className="chart-card"><SectionHeading title="도서별 대출 이력" description="누적 대출 기록 기준 상위 6종" /><div className="chart-canvas"><ResponsiveContainer width="100%" height="100%"><LineChart data={byBook} margin={{ top: 14, right: 12, left: -12, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf3" /><XAxis dataKey="book" tickLine={false} axisLine={false} tick={{ fill: '#748197', fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={52} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#748197', fontSize: 12 }} /><Tooltip contentStyle={{ borderRadius: 8, borderColor: '#dfe6ef', fontSize: 12 }} /><Line type="monotone" dataKey="loans" name="대출 건수" stroke="#294d7a" strokeWidth={2.5} dot={{ r: 3, fill: '#294d7a' }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div></Card>
      </div>
      <div className="statistics-lists-grid">
        <Card className="table-card"><SectionHeading title="사서별 처리 이력" description="대출·반납 FK 처리자 참조 기준" /><DataTable rows={librarians} getRowKey={(row) => row.user.userId} columns={[
          { key: 'librarian', title: '사서', render: (row) => <span className="table-title-cell"><strong>{row.user.fullName}</strong><small>ID {row.user.userId}</small></span> },
          { key: 'checkout', title: '대출 처리', render: (row) => `${row.checkouts}건` },
          { key: 'return', title: '반납 처리', render: (row) => `${row.returns}건` },
        ]} /></Card>
        <Card className="table-card"><SectionHeading title="도서별 대출 집계" description="각 book_id에 연결된 전체 loan 수" /><DataTable rows={byBook} getRowKey={(row) => row.book} columns={[
          { key: 'book', title: '도서', render: (row) => <strong>{row.book}</strong> },
          { key: 'loans', title: '누적 대출', render: (row) => <Badge tone="blue">{row.loans}건</Badge> },
        ]} /></Card>
      </div>
      <Notice tone="info" title="통계 산출 방식">월별 수치는 `borrowed_at`, `returned_at`, 도서별 이력은 `loan.copy_id`에서 계산합니다. 임의로 만든 수치는 사용하지 않습니다.</Notice>
    </WorkspaceLayout>
  )
}
