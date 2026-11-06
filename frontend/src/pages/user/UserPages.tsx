import { useMemo, useState } from 'react'
import { BookMarked, CalendarDays, Clock3, Search, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { BookCard } from '../../components/catalog/BookCard'
import { DataTable } from '../../components/tables/DataTable'
import { Badge, Card, EmptyState, Modal, Notice, PageHeading, SectionHeading } from '../../components/ui/Primitives'
import { WorkspaceLayout } from '../../components/layout/WorkspaceLayout'
import { getAuthorsForBook, getAvailability, getBookForCopy, getOverdueDays, isOverdue, formatDate } from '../../services/library'
import { useLibraryStore } from '../../store/libraryStore'
import type { Book, Loan } from '../../types/domain'

function DemoMemberPicker() {
  const users = useLibraryStore((state) => state.users)
  const demoMemberId = useLibraryStore((state) => state.demoMemberId)
  const setDemoMember = useLibraryStore((state) => state.setDemoMember)
  const members = users.filter((user) => user.role === 'MEMBER')

  return (
    <div className="demo-member-picker">
      <span className="demo-member-icon"><UserRound size={16} /></span>
      <div><strong>데모 회원 선택</strong><small>선택에 따라 대출 내역이 바뀝니다.</small></div>
      <select aria-label="데모 회원 선택" value={demoMemberId} onChange={(event) => setDemoMember(Number(event.target.value))}>
        {members.map((member) => <option key={member.userId} value={member.userId}>{member.fullName} · ID {member.userId}{member.accountStatus === 'INACTIVE' ? ' · 비활성' : ''}</option>)}
      </select>
    </div>
  )
}

export function UserBooksPage() {
  const data = useLibraryStore(useShallow((state) => ({ users: state.users, books: state.books, authors: state.authors, bookAuthors: state.bookAuthors, copies: state.copies, loans: state.loans, renewals: state.renewals })))
  const [query, setQuery] = useState('')
  const [searchBy, setSearchBy] = useState<'title' | 'author' | 'isbn'>('title')
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'unavailable'>('all')
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const normalized = query.trim().toLocaleLowerCase()
  const books = useMemo(() => data.books.filter((book) => {
    if (book.catalogStatus !== 'ACTIVE') return false
    const authors = getAuthorsForBook(book.bookId, data).map((author) => author.authorName).join(' ').toLocaleLowerCase()
    const match = !normalized || (searchBy === 'title'
      ? book.title.toLocaleLowerCase().includes(normalized)
      : searchBy === 'author'
        ? authors.includes(normalized)
        : book.isbn.replace(/[\s-]/g, '').includes(query.replace(/[\s-]/g, '')))
    const available = getAvailability(book.bookId, data).available > 0
    return match && (availabilityFilter === 'all' || (availabilityFilter === 'available' ? available : !available))
  }), [availabilityFilter, data, normalized, query, searchBy])
  const selectedAuthors = selectedBook ? getAuthorsForBook(selectedBook.bookId, data) : []
  const selectedAvailability = selectedBook ? getAvailability(selectedBook.bookId, data) : null
  const selectedCopies = selectedBook ? data.copies.filter((copy) => copy.bookId === selectedBook.bookId) : []

  return (
    <WorkspaceLayout section="user">
      <PageHeading eyebrow="USER SERVICE · BOOK DISCOVERY" title="도서 검색" description="제목, 저자, ISBN으로 도서관 소장 도서를 찾고 실물 소장본의 이용 가능 여부를 확인합니다." />
      <DemoMemberPicker />
      <div className="book-search-toolbar">
        <div className="search-mode-tabs" role="group" aria-label="검색 기준">
          {[['title', '제목'], ['author', '저자'], ['isbn', 'ISBN']].map(([value, label]) => (
            <button key={value} className={searchBy === value ? 'selected' : ''} onClick={() => setSearchBy(value as typeof searchBy)}>{label}</button>
          ))}
        </div>
        <label className="catalog-search-input"><Search size={17} /><span className="sr-only">도서 검색어</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchBy === 'isbn' ? 'ISBN 숫자 13자리로 검색' : `${searchBy === 'author' ? '저자명' : '도서 제목'}을 입력하세요`} /><kbd>검색</kbd></label>
        <select className="filter-select" aria-label="대출 상태 필터" value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value as typeof availabilityFilter)}>
          <option value="all">전체 상태</option><option value="available">대출 가능</option><option value="unavailable">대출 중</option>
        </select>
      </div>
      <div className="results-heading"><strong>검색 결과 <span>{books.length}</span></strong><small>서지 정보와 연결된 실물 소장본 기준</small></div>
      {books.length > 0 ? (
        <div className="book-grid">{books.map((book) => <BookCard key={book.bookId} book={book} data={data} onSelect={setSelectedBook} />)}</div>
      ) : (
        <Card><EmptyState title="검색 결과가 없습니다" description="검색어 또는 대출 상태 필터를 바꿔 다시 검색해 보세요." /></Card>
      )}
      <Notice tone="info" title="대출은 사서 데스크에서 진행합니다.">이 화면에서는 도서와 소장 상태를 확인할 수 있습니다. 대출 신청·예약·결제 기능은 제공하지 않습니다. <Link to="/librarian/checkout">사서 대출 화면 보기</Link></Notice>

      {selectedBook && selectedAvailability && (
        <Modal title={selectedBook.title} description={`${selectedAuthors.map((author) => author.authorName).join(', ')} · ${selectedBook.publicationYear ?? '연도 미상'}`} onClose={() => setSelectedBook(null)} wide>
          <div className="book-detail-modal">
            <div className="book-detail-cover-wrap"><span className={`book-cover book-cover-${((selectedBook.bookId - 1) % 5) + 1}`}><span className="book-cover-mark"><BookMarked size={15} /></span><span className="book-cover-title">{selectedBook.title}</span><span className="book-cover-rule" /><span className="book-cover-author">{selectedAuthors.map((author) => author.authorName).join(', ')}</span><span className="book-cover-edition">ISBN {selectedBook.isbn}</span></span></div>
            <div className="book-detail-content">
              <div className="book-detail-status"><Badge tone={selectedAvailability.available > 0 ? 'green' : 'amber'}>{selectedAvailability.available > 0 ? '대출 가능' : '현재 대출 중'}</Badge><strong>{selectedAvailability.available}<small> / {selectedAvailability.total}권 대출 가능</small></strong></div>
              <dl className="book-facts"><div><dt>ISBN-13</dt><dd>{selectedBook.isbn}</dd></div><div><dt>출판사</dt><dd>{selectedBook.publisher ?? '정보 없음'}</dd></div><div><dt>발행연도</dt><dd>{selectedBook.publicationYear ?? '정보 없음'}</dd></div><div><dt>저자</dt><dd>{selectedAuthors.map((author) => author.authorName).join(', ') || '저자 정보 없음'}</dd></div></dl>
              <div className="copy-list-heading"><strong>소장본 현황</strong><span>도서관 관리번호 기준</span></div>
              <div className="copy-status-list">{selectedCopies.map((copy) => {
                const borrowed = data.loans.some((loan) => loan.copyId === copy.copyId && loan.returnedAt === null)
                return <div key={copy.copyId}><code>{copy.copyCode}</code><Badge tone={copy.managementStatus === 'RETIRED' ? 'neutral' : borrowed ? 'amber' : 'green'}>{copy.managementStatus === 'RETIRED' ? '제적' : borrowed ? '대출 중' : '비치 중'}</Badge></div>
              })}</div>
              <Notice tone="info">도서 대출은 사서가 회원과 실물 소장본을 확인한 뒤 처리합니다.</Notice>
            </div>
          </div>
        </Modal>
      )}
    </WorkspaceLayout>
  )
}

export function UserLoansPage() {
  const state = useLibraryStore()
  const member = state.users.find((user) => user.userId === state.demoMemberId)
  const memberLoans = state.loans.filter((loan) => loan.memberUserId === state.demoMemberId)
  const current = memberLoans.filter((loan) => loan.returnedAt === null).sort((a, b) => a.currentDueDate.localeCompare(b.currentDueDate))
  const history = memberLoans.filter((loan) => loan.returnedAt !== null).sort((a, b) => (b.returnedAt ?? '').localeCompare(a.returnedAt ?? ''))

  function titleFor(loan: Loan) {
    return getBookForCopy(loan.copyId, state)?.title ?? '도서 정보 없음'
  }

  function copyFor(loan: Loan) {
    return state.copies.find((copy) => copy.copyId === loan.copyId)?.copyCode ?? '—'
  }

  return (
    <WorkspaceLayout section="user">
      <PageHeading eyebrow="USER SERVICE · MY ACTIVITY" title="내 대출 현황" description="선택한 데모 회원의 현재 대출과 과거 이용 기록을 확인합니다." />
      <DemoMemberPicker />
      {member && <div className="member-context-line"><span className="member-avatar">{member.fullName.slice(0, 1)}</span><span><strong>{member.fullName}</strong><small>회원 ID {member.userId} · {member.accountStatus === 'ACTIVE' ? '활성 계정' : '비활성 계정'}</small></span><Badge tone={member.accountStatus === 'ACTIVE' ? 'green' : 'neutral'}>{member.accountStatus === 'ACTIVE' ? '이용 중' : '비활성'}</Badge></div>}
      <div className="loan-section-grid">
        <section className="user-loan-section">
          <SectionHeading title="현재 대출" description="미반납 상태의 실물 소장본" />
          {current.length > 0 ? current.map((loan) => {
            const overdue = isOverdue(loan)
            const book = getBookForCopy(loan.copyId, state)
            return <Card className={`current-loan-card ${overdue ? 'is-overdue' : ''}`} key={loan.loanId}>
              <div className="current-loan-icon"><BookMarked size={19} /></div>
              <div className="current-loan-main"><span className="eyebrow">LOAN #{loan.loanId}</span><h3>{titleFor(loan)}</h3><p>{book ? getAuthorsForBook(book.bookId, state).map((author) => author.authorName).join(', ') : '저자 정보 없음'}</p><span className="copy-code-line">소장본 {copyFor(loan)}</span></div>
              <div className="current-loan-dates"><span><CalendarDays size={14} /> 대출일 <strong>{formatDate(loan.borrowedAt)}</strong></span><span><Clock3 size={14} /> 반납 예정 <strong>{formatDate(loan.currentDueDate)}</strong></span><Badge tone={overdue ? 'red' : 'green'}>{overdue ? `연체 ${getOverdueDays(loan)}일` : '대출 중'}</Badge></div>
            </Card>
          }) : <Card><EmptyState title="현재 대출 중인 도서가 없습니다" description="대출은 사서 데스크에서 처리할 수 있습니다." action={<Link className="button button-secondary" to="/librarian/checkout">사서 화면 보기</Link>} /></Card>}
        </section>
        <section className="user-loan-section">
          <SectionHeading title="이용 이력" description="반납 완료된 대출 기록" />
          <Card className="table-card loan-history-card">
            <DataTable
              rows={history}
              getRowKey={(loan) => loan.loanId}
              emptyMessage="아직 완료된 대출 이력이 없습니다."
              columns={[
                { key: 'book', title: '도서', render: (loan) => <span className="table-title-cell"><strong>{titleFor(loan)}</strong><small>{copyFor(loan)}</small><Badge tone={getOverdueDays(loan) > 0 ? 'amber' : 'green'}>{getOverdueDays(loan) > 0 ? `반납 시 연체 ${getOverdueDays(loan)}일` : '정상 반납'}</Badge></span> },
                { key: 'borrowed', title: '대출일', render: (loan) => formatDate(loan.borrowedAt) },
                { key: 'due', title: '반납 예정', render: (loan) => formatDate(loan.currentDueDate) },
                { key: 'returned', title: '반납일', render: (loan) => formatDate(loan.returnedAt) },
              ]}
            />
          </Card>
        </section>
      </div>
      <Notice tone="info" title="데모 상태 안내">대출·반납·연장은 사서 영역의 Mock Service에서 처리합니다. 연체료, 예약, 결제 기능은 설계 범위에 없습니다.</Notice>
    </WorkspaceLayout>
  )
}
