import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, BookCopy, BookOpenCheck, CalendarClock, Check, CircleAlert, Clock3, RotateCcw, Search, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { DataTable } from '../../components/tables/DataTable'
import { WorkspaceLayout } from '../../components/layout/WorkspaceLayout'
import { Badge, Button, Card, EmptyState, Field, MetricCard, Notice, PageHeading, ResultMessage, SectionHeading } from '../../components/ui/Primitives'
import { canRenew, deriveLoanCounts, formatDate, getAvailableCopies, getBookForCopy, getOverdueDays, isOverdue } from '../../services/library'
import { useLibraryStore, type ActionResult } from '../../store/libraryStore'
import type { Loan } from '../../types/domain'

const DEMO_LIBRARIAN_ID = 2001

function useLibraryData() {
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

function bookTitle(loan: Loan, data: ReturnType<typeof useLibraryData>) {
  return getBookForCopy(loan.copyId, data)?.title ?? '도서 정보 없음'
}

function copyCode(loan: Loan, data: ReturnType<typeof useLibraryData>) {
  return data.copies.find((copy) => copy.copyId === loan.copyId)?.copyCode ?? '—'
}

function memberName(loan: Loan, data: ReturnType<typeof useLibraryData>) {
  return data.users.find((user) => user.userId === loan.memberUserId)?.fullName ?? '회원 정보 없음'
}

export function LibrarianDashboardPage() {
  const data = useLibraryData()
  const counts = deriveLoanCounts(data)
  const activeLoans = data.loans.filter((loan) => loan.returnedAt === null)
  const recentEvents = useMemo(() => data.loans.flatMap((loan) => {
    const book = bookTitle(loan, data)
    const member = memberName(loan, data)
    const checkoutStaff = data.users.find((user) => user.userId === loan.checkedOutByUserId)?.fullName ?? '사서'
    const returnStaff = loan.returnedByUserId ? data.users.find((user) => user.userId === loan.returnedByUserId)?.fullName ?? '사서' : ''
    const events: { key: string; type: '대출' | '반납'; timestamp: string; book: string; member: string; staff: string }[] = [{ key: `${loan.loanId}-checkout`, type: '대출', timestamp: loan.borrowedAt, book, member, staff: checkoutStaff }]
    if (loan.returnedAt) events.push({ key: `${loan.loanId}-return`, type: '반납' as const, timestamp: loan.returnedAt, book, member, staff: returnStaff })
    return events
  }).sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 6), [data])

  return (
    <WorkspaceLayout section="librarian">
      <PageHeading eyebrow="LIBRARY DESK · OVERVIEW" title="사서 업무 현황" description="현재 대출과 반납 예정, 연체 상태를 공유 데모 데이터에서 계산합니다." actions={<Badge tone="blue">DEMO LIBRARIAN · 한서연</Badge>} />
      <div className="metric-grid four">
        <MetricCard label="현재 대출" value={counts.active} note="미반납 대출 기록 기준" icon={<BookCopy size={17} />} tone="navy" />
        <MetricCard label="반납 예정" value={counts.dueSoon} note="오늘부터 3일 이내" icon={<CalendarClock size={17} />} tone="blue" />
        <MetricCard label="연체" value={counts.overdue} note="현재 날짜 기준 자동 판정" icon={<AlertTriangle size={17} />} tone={counts.overdue > 0 ? 'red' : 'green'} />
        <MetricCard label="완료된 반납" value={counts.returned} note="누적 이력 기준" icon={<Check size={17} />} tone="green" />
      </div>
      <div className="librarian-dashboard-grid">
        <Card className="panel-card">
          <SectionHeading title="빠른 업무" description="업무에 필요한 화면으로 바로 이동합니다." />
          <div className="quick-task-list">
            <Link to="/librarian/checkout"><span className="quick-task-icon"><BookOpenCheck size={18} /></span><span><strong>도서 대출</strong><small>회원과 소장본을 확인하고 대출합니다.</small></span><ArrowRight size={15} /></Link>
            <Link to="/librarian/returns"><span className="quick-task-icon"><RotateCcw size={18} /></span><span><strong>도서 반납</strong><small>미반납 대출과 반납 처리자를 기록합니다.</small></span><ArrowRight size={15} /></Link>
            <Link to="/librarian/renewals"><span className="quick-task-icon"><CalendarClock size={18} /></span><span><strong>대출 연장</strong><small>조건을 확인하고 기존 기한에 7일을 더합니다.</small></span><ArrowRight size={15} /></Link>
            <Link to="/librarian/overdue"><span className="quick-task-icon"><CircleAlert size={18} /></span><span><strong>연체 조회</strong><small>미반납이며 예정일이 지난 건을 확인합니다.</small></span><ArrowRight size={15} /></Link>
          </div>
        </Card>
        <Card className="panel-card recent-activity-card">
          <SectionHeading title="최근 대출·반납" description="동일한 Mock State에서 산출한 최근 기록" />
          <div className="activity-list">
            {recentEvents.map((event) => (
              <div className="activity-row" key={event.key}>
                <span className={`activity-icon ${event.type === '반납' ? 'activity-return' : ''}`}>{event.type === '반납' ? <RotateCcw size={15} /> : <BookOpenCheck size={15} />}</span>
                <div className="activity-copy"><div><strong>{event.book}</strong><Badge tone={event.type === '반납' ? 'green' : 'blue'}>{event.type}</Badge></div><p>{event.member} · {event.staff} 처리</p></div>
                <time>{formatDate(event.timestamp)}</time>
              </div>
            ))}
          </div>
          {recentEvents.length === 0 && <EmptyState title="최근 활동이 없습니다" description="대출 또는 반납 처리를 하면 이곳에 표시됩니다." />}
        </Card>
      </div>
      <Notice tone="info" title="업무 규칙">회원당 동시 대출 최대 1권 · 기본 기간 14일 · 연체 중 신규 대출 및 연장 불가 · 반납은 가능</Notice>
      <div className="current-loan-summary"><SectionHeading title="현재 대출 목록" action={<Link to="/librarian/returns" className="text-action">반납 처리 <ArrowRight size={14} /></Link>} /><div className="summary-loan-chips">{activeLoans.slice(0, 5).map((loan) => <span key={loan.loanId}><strong>{memberName(loan, data)}</strong><span>{bookTitle(loan, data)}</span><Badge tone={isOverdue(loan) ? 'red' : 'neutral'}>{isOverdue(loan) ? `연체 ${getOverdueDays(loan)}일` : `기한 ${formatDate(loan.currentDueDate)}`}</Badge></span>)}{activeLoans.length === 0 && <p>현재 대출 중인 건이 없습니다.</p>}</div></div>
    </WorkspaceLayout>
  )
}

export function LibrarianCheckoutPage() {
  const data = useLibraryData()
  const checkout = useLibraryStore((state) => state.checkout)
  const [memberQuery, setMemberQuery] = useState('')
  const [memberId, setMemberId] = useState(1003)
  const [bookId, setBookId] = useState(502)
  const [copyId, setCopyId] = useState(5003)
  const [result, setResult] = useState<ActionResult | null>(null)
  const members = data.users.filter((user) => user.role === 'MEMBER' && `${user.fullName} ${user.loginId} ${user.userId}`.toLocaleLowerCase().includes(memberQuery.trim().toLocaleLowerCase()))
  const selectedMember = data.users.find((user) => user.userId === memberId && user.role === 'MEMBER')
  const selectedBook = data.books.find((book) => book.bookId === bookId)
  const availableCopies = selectedBook ? getAvailableCopies(selectedBook.bookId, data) : []
  const activeLoans = data.loans.filter((loan) => loan.returnedAt === null)
  const memberLoan = activeLoans.find((loan) => loan.memberUserId === memberId)
  const memberOverdue = memberLoan ? isOverdue(memberLoan) : false
  const canCheckout = selectedMember !== undefined && selectedMember.accountStatus === 'ACTIVE' && !memberLoan && selectedBook?.catalogStatus === 'ACTIVE' && availableCopies.some((copy) => copy.copyId === copyId)

  function onBookChange(value: number) {
    setBookId(value)
    const book = data.books.find((item) => item.bookId === value)
    setCopyId(book ? getAvailableCopies(book.bookId, data)[0]?.copyId ?? 0 : 0)
    setResult(null)
  }

  function handleCheckout() {
    const outcome = checkout(memberId, copyId, DEMO_LIBRARIAN_ID)
    setResult(outcome)
    if (outcome.ok) {
      const nextBook = data.books.find((book) => book.bookId !== bookId && getAvailableCopies(book.bookId, data).length > 0)
      if (nextBook) onBookChange(nextBook.bookId)
    }
  }

  return (
    <WorkspaceLayout section="librarian">
      <PageHeading eyebrow="LIBRARY DESK · CHECKOUT" title="도서 대출" description="회원의 대출 가능 상태와 실물 소장본을 확인한 뒤 데모 대출을 처리합니다." actions={<Badge tone="blue">14일 대출</Badge>} />
      <div className="checkout-layout">
        <Card className="workflow-card">
          <div className="workflow-card-head"><div><h2>회원 확인</h2><p>이름 또는 회원 ID로 검색합니다.</p></div></div>
          <Field label="회원 검색"><span className="input-with-icon"><Search size={15} /><input value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="이름, 로그인 ID, 회원 ID" /></span></Field>
          <Field label="대출 회원"><select value={memberId} onChange={(event) => { setMemberId(Number(event.target.value)); setResult(null) }}>{members.map((member) => <option value={member.userId} key={member.userId}>{member.fullName} · ID {member.userId}{member.accountStatus === 'INACTIVE' ? ' · 비활성' : ''}</option>)}</select></Field>
          {selectedMember ? <div className={`member-eligibility ${selectedMember.accountStatus !== 'ACTIVE' || memberLoan ? 'eligibility-blocked' : 'eligibility-ready'}`}>
            <span className="eligibility-mark">{selectedMember.accountStatus === 'ACTIVE' && !memberLoan ? <Check size={16} /> : <CircleAlert size={16} />}</span>
            <div><strong>{selectedMember.accountStatus !== 'ACTIVE' ? '비활성 회원' : memberOverdue ? '연체로 대출 제한' : memberLoan ? '이미 대출 중인 도서가 있습니다' : '대출 가능 회원'}</strong><small>{selectedMember.accountStatus !== 'ACTIVE' ? '활성 회원만 대출할 수 있습니다.' : memberLoan ? `${bookTitle(memberLoan, data)} · ${memberOverdue ? `연체 ${getOverdueDays(memberLoan)}일` : `반납 예정 ${formatDate(memberLoan.currentDueDate)}`}` : '현재 대출 또는 연체 건이 없습니다.'}</small></div>
          </div> : <div className="field-hint">검색 결과에 회원이 없습니다.</div>}
        </Card>
        <Card className="workflow-card">
          <div className="workflow-card-head"><div><h2>도서·소장본 선택</h2><p>실물 관리번호 기준으로 대출합니다.</p></div></div>
          <Field label="도서"><select value={bookId} onChange={(event) => onBookChange(Number(event.target.value))}>{data.books.filter((book) => book.catalogStatus === 'ACTIVE').map((book) => {
            const available = getAvailableCopies(book.bookId, data).length
            return <option value={book.bookId} key={book.bookId} disabled={available === 0}>{book.title} · 대출 가능 {available}권</option>
          })}</select></Field>
          <Field label="실물 소장본"><select value={copyId} onChange={(event) => setCopyId(Number(event.target.value))} disabled={availableCopies.length === 0}>{availableCopies.length === 0 ? <option value={0}>대출 가능한 소장본 없음</option> : availableCopies.map((copy) => <option value={copy.copyId} key={copy.copyId}>{copy.copyCode}</option>)}</select></Field>
          <div className="checkout-rule-line"><span><Clock3 size={14} /> 대출 기간</span><strong>대출일 + 14일</strong><small>Asia/Seoul 기준</small></div>
        </Card>
        <Card className="checkout-confirm-card">
          <span className="eyebrow">CHECK BEFORE CONFIRM</span>
          <h2>대출 조건 확인</h2>
          <ul className="checklist">
            <li className={selectedMember?.accountStatus === 'ACTIVE' ? 'check-ok' : ''}><span /> 활성 회원</li>
            <li className={!memberLoan ? 'check-ok' : ''}><span /> 회원당 활성 대출 1권 이하</li>
            <li className={!memberOverdue ? 'check-ok' : ''}><span /> 현재 연체 건 없음</li>
            <li className={availableCopies.some((copy) => copy.copyId === copyId) ? 'check-ok' : ''}><span /> 이용 가능한 소장본</li>
          </ul>
          {result && <ResultMessage message={result.message} error={!result.ok} />}
          <Button className="button-full" disabled={!canCheckout} onClick={handleCheckout} icon={<BookOpenCheck size={16} />}>대출 처리</Button>
          <p className="muted-small">대출 처리 사서: 한서연 · 데모 상태만 변경</p>
        </Card>
      </div>
      <Notice tone="warning" title="대출 조건">활성 회원, 연체 없음, 회원당 활성 대출 최대 1권, ACTIVE 상태이며 미대출인 소장본을 모두 만족해야 합니다.</Notice>
    </WorkspaceLayout>
  )
}

export function LibrarianReturnsPage() {
  const data = useLibraryData()
  const returnLoan = useLibraryStore((state) => state.returnLoan)
  const [result, setResult] = useState<ActionResult | null>(null)
  const activeLoans = data.loans.filter((loan) => loan.returnedAt === null).sort((a, b) => a.currentDueDate.localeCompare(b.currentDueDate))

  function handleReturn(loanId: number) {
    setResult(returnLoan(loanId, DEMO_LIBRARIAN_ID))
  }

  return (
    <WorkspaceLayout section="librarian">
      <PageHeading eyebrow="LIBRARY DESK · RETURNS" title="도서 반납" description="활성 대출에서 회원과 실물 소장본을 확인하고 반납 시각과 처리자를 기록합니다." />
      {result && <ResultMessage message={result.message} error={!result.ok} />}
      <Card className="table-card">
        <div className="table-card-heading"><SectionHeading title="활성 대출 목록" description={`미반납 대출 ${activeLoans.length}건 · 반납 완료 시 데모 대출 기록이 갱신됩니다.`} /><Badge tone="blue">RETURN WORKLIST</Badge></div>
        <DataTable
          rows={activeLoans}
          getRowKey={(loan) => loan.loanId}
          emptyMessage="반납 처리할 활성 대출이 없습니다."
          columns={[
            { key: 'member', title: '회원', render: (loan) => <span className="table-title-cell"><strong>{memberName(loan, data)}</strong><small>ID {loan.memberUserId}</small></span> },
            { key: 'book', title: '도서 / 소장본', render: (loan) => <span className="table-title-cell"><strong>{bookTitle(loan, data)}</strong><small>{copyCode(loan, data)}</small></span> },
            { key: 'borrowed', title: '대출일', render: (loan) => formatDate(loan.borrowedAt) },
            { key: 'due', title: '반납 예정', render: (loan) => formatDate(loan.currentDueDate) },
            { key: 'status', title: '상태', render: (loan) => isOverdue(loan) ? <Badge tone="red">연체 {getOverdueDays(loan)}일</Badge> : <Badge tone="green">대출 중</Badge> },
            { key: 'action', title: '처리', render: (loan) => <Button variant="secondary" onClick={() => handleReturn(loan.loanId)} icon={<RotateCcw size={14} />}>반납 처리</Button> },
          ]}
        />
      </Card>
      <Notice tone="info" title="반납 이력 보존">반납 시 `returned_at`과 `returned_by_user_id`가 함께 기록됩니다. 반납 시점 연체 일수는 이력에서 계산되며 별도 연체료는 없습니다.</Notice>
    </WorkspaceLayout>
  )
}

export function LibrarianRenewalsPage() {
  const data = useLibraryData()
  const renewLoan = useLibraryStore((state) => state.renewLoan)
  const [result, setResult] = useState<ActionResult | null>(null)
  const activeLoans = data.loans.filter((loan) => loan.returnedAt === null).sort((a, b) => a.currentDueDate.localeCompare(b.currentDueDate))
  const recentRenewals = [...data.renewals].sort((a, b) => b.renewedAt.localeCompare(a.renewedAt)).slice(0, 6)

  return (
    <WorkspaceLayout section="librarian">
      <PageHeading eyebrow="LIBRARY DESK · RENEWALS" title="대출 연장" description="미반납·비연체·연장 이력 0건인 대출만 기존 기한에서 7일 연장합니다." actions={<Badge tone="blue">최대 1회 · +7일</Badge>} />
      {result && <ResultMessage message={result.message} error={!result.ok} />}
      <Card className="table-card">
        <div className="table-card-heading"><SectionHeading title="연장 확인 대상" description="연체 중이거나 이미 연장한 대출은 처리할 수 없습니다." /><Badge tone="neutral">ACTIVE LOANS</Badge></div>
        <DataTable
          rows={activeLoans}
          getRowKey={(loan) => loan.loanId}
          emptyMessage="연장할 활성 대출이 없습니다."
          columns={[
            { key: 'member', title: '회원', render: (loan) => <span className="table-title-cell"><strong>{memberName(loan, data)}</strong><small>ID {loan.memberUserId}</small></span> },
            { key: 'book', title: '도서 / 소장본', render: (loan) => <span className="table-title-cell"><strong>{bookTitle(loan, data)}</strong><small>{copyCode(loan, data)}</small></span> },
            { key: 'due', title: '현재 반납 예정', render: (loan) => formatDate(loan.currentDueDate) },
            { key: 'renewalCount', title: '연장 횟수', render: (loan) => <span>{data.renewals.filter((renewal) => renewal.loanId === loan.loanId).length} / 1회</span> },
            { key: 'eligibility', title: '연장 가능 여부', render: (loan) => <Badge tone={canRenew(loan, data.renewals) ? 'green' : 'neutral'}>{isOverdue(loan) ? '연체로 불가' : canRenew(loan, data.renewals) ? '가능' : '이미 연장함'}</Badge> },
            { key: 'action', title: '처리', render: (loan) => <Button variant="secondary" disabled={!canRenew(loan, data.renewals)} onClick={() => setResult(renewLoan(loan.loanId, DEMO_LIBRARIAN_ID))} icon={<CalendarClock size={14} />}>7일 연장</Button> },
          ]}
        />
      </Card>
      <Card className="panel-card">
        <SectionHeading title="최근 연장 이력" description="성공한 연장의 이전 기한과 새 기한" />
        {recentRenewals.length ? <div className="renewal-history-list">{recentRenewals.map((renewal) => {
          const loan = data.loans.find((item) => item.loanId === renewal.loanId)
          return <div key={renewal.renewalId}><span className="renewal-history-mark"><CalendarClock size={16} /></span><div><strong>{loan ? bookTitle(loan, data) : '대출 정보 없음'}</strong><small>{loan ? `${memberName(loan, data)} · 대출 ID ${loan.loanId}` : `대출 ID ${renewal.loanId}`}</small></div><span className="renewal-date-shift">{formatDate(renewal.previousDueDate)} <ArrowRight size={13} /> <strong>{formatDate(renewal.newDueDate)}</strong></span></div>
        })}</div> : <EmptyState title="연장 이력이 없습니다" description="정상 대출을 연장하면 전후 기한이 여기에 표시됩니다." />}
      </Card>
      <Notice tone="warning" title="연장 업무 규칙">최대 1회, 기존 `current_due_date`에 7일 추가, 연체 상태에서는 연장할 수 없습니다. 데모 처리 결과는 화면 상태에만 저장됩니다.</Notice>
    </WorkspaceLayout>
  )
}

export function LibrarianOverduePage() {
  const data = useLibraryData()
  const overdueLoans = data.loans.filter((loan) => loan.returnedAt === null && isOverdue(loan)).sort((a, b) => a.currentDueDate.localeCompare(b.currentDueDate))

  return (
    <WorkspaceLayout section="librarian">
      <PageHeading eyebrow="LIBRARY DESK · OVERDUE" title="연체 조회" description="반납되지 않았고 반납 예정일이 오늘보다 이전인 대출만 표시합니다." actions={<Badge tone={overdueLoans.length > 0 ? 'red' : 'green'}>{overdueLoans.length}건 연체</Badge>} />
      <div className="metric-grid three">
        <MetricCard label="현재 연체" value={overdueLoans.length} note="미반납 + 예정일 경과" icon={<CircleAlert size={17} />} tone={overdueLoans.length ? 'red' : 'green'} />
        <MetricCard label="대출 제한 회원" value={new Set(overdueLoans.map((loan) => loan.memberUserId)).size} note="연체 중 신규 대출·연장 불가" icon={<UsersRound size={17} />} tone="amber" />
        <MetricCard label="반납 가능" value="허용" note="연체 상태에서도 반납 가능" icon={<RotateCcw size={17} />} tone="blue" />
      </div>
      <Card className="table-card">
        <SectionHeading title="연체 중인 대출" description="연체 일수는 KST 오늘과 현재 반납예정일 차이로 계산합니다." />
        <DataTable
          rows={overdueLoans}
          getRowKey={(loan) => loan.loanId}
          emptyMessage="현재 연체 중인 대출이 없습니다."
          columns={[
            { key: 'member', title: '회원', render: (loan) => <span className="table-title-cell"><strong>{memberName(loan, data)}</strong><small>ID {loan.memberUserId}</small></span> },
            { key: 'book', title: '도서 / 소장본', render: (loan) => <span className="table-title-cell"><strong>{bookTitle(loan, data)}</strong><small>{copyCode(loan, data)}</small></span> },
            { key: 'borrowed', title: '대출일', render: (loan) => formatDate(loan.borrowedAt) },
            { key: 'due', title: '반납 예정', render: (loan) => formatDate(loan.currentDueDate) },
            { key: 'overdue', title: '연체 일수', render: (loan) => <Badge tone="red">{getOverdueDays(loan)}일</Badge> },
            { key: 'renewal', title: '연장', render: (loan) => data.renewals.some((renewal) => renewal.loanId === loan.loanId) ? <Badge tone="neutral">사용 완료</Badge> : <span className="muted-small">연체로 불가</span> },
          ]}
        />
      </Card>
      <Notice tone="danger" title="제한 기준">현재 연체 대출이 하나라도 남아 있으면 해당 회원의 신규 대출과 연장은 차단됩니다. 반납이 완료되면 다른 연체가 없는지 다시 계산합니다.</Notice>
    </WorkspaceLayout>
  )
}
