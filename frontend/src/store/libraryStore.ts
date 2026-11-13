import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addDays, createSeedData, getKoreanDate } from '../data/mock/seed'
import { canRenew, isOverdue } from '../services/library'
import type { BookFormValues, DbFlowEventDraft, LibraryData, Loan, UserRole } from '../types/domain'

export interface ActionResult {
  ok: boolean
  message: string
  loanId?: number
}

interface LibraryStore extends LibraryData {
  demoRole: UserRole | null
  roleSwitchTarget: string | null
  demoMemberId: number
  demoLibrarianId: number
  dbFlowEvents: import('../types/domain').DbFlowEvent[]
  requestRoleSwitch: (role: UserRole, targetPath: string) => void
  completeRoleSwitch: () => void
  setDemoMember: (userId: number) => void
  setDemoLibrarian: (userId: number) => void
  recordDbFlowEvents: (events: DbFlowEventDraft[]) => void
  clearDbFlowEvents: () => void
  checkout: (memberUserId: number, copyId: number, librarianUserId: number) => ActionResult
  returnLoan: (loanId: number, librarianUserId: number) => ActionResult
  renewLoan: (loanId: number, memberUserId: number, simulateFailure?: boolean) => ActionResult
  setUserStatus: (userId: number) => ActionResult
  setUserRole: (userId: number, role: UserRole) => ActionResult
  addAuthor: (authorName: string) => ActionResult
  renameAuthor: (authorId: number, authorName: string) => ActionResult
  addMember: (values: { loginId: string; fullName: string; contact: string }) => ActionResult
  saveBook: (values: BookFormValues, bookId?: number) => ActionResult
  addCopy: (bookId: number, copyCode: string) => ActionResult
  toggleCopyStatus: (copyId: number) => ActionResult
  setBookStatus: (bookId: number) => ActionResult
  resetDemo: () => void
}

function maxId<T extends object>(values: T[], key: keyof T, fallback: number): number {
  return Math.max(fallback, ...values.map((item) => Number(item[key] ?? 0)))
}

function validLibrarian(data: LibraryData, userId: number): boolean {
  return data.users.some((user) => user.userId === userId && user.role === 'LIBRARIAN' && user.accountStatus === 'ACTIVE')
}

function dbEvent(
  operation: DbFlowEventDraft['operation'],
  message: string,
  details: Omit<Partial<DbFlowEventDraft>, 'operation' | 'message'> = {},
): DbFlowEventDraft {
  return { operation, message, status: 'success', ...details }
}

function normalizeIsbn(value: string): string {
  return value.replace(/[\s-]/g, '')
}

function validIsbn13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false
  const sum = [...value.slice(0, 12)].reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0)
  return (10 - (sum % 10)) % 10 === Number(value[12])
}

function authorIdsForNames(data: LibraryData, value: string): { authors: LibraryData['authors']; authorIds: number[] } {
  const names = [...new Set(value.split(/[;,、]/).map((name) => name.trim()).filter(Boolean))]
  let authors = [...data.authors]
  let nextId = maxId(authors, 'authorId', 700)
  const authorIds = names.map((name) => {
    const existing = authors.find((author) => author.authorName.toLocaleLowerCase() === name.toLocaleLowerCase())
    if (existing) return existing.authorId
    nextId += 1
    authors = [...authors, { authorId: nextId, authorName: name }]
    return nextId
  })
  return { authors, authorIds }
}

function renewalsForLoan(loan: Loan, state: LibraryData) {
  const previousDueDate = loan.currentDueDate
  const newDueDate = addDays(previousDueDate, 7)
  const renewalId = maxId(state.renewals, 'renewalId', 9500) + 1
  return {
    currentDueDate: newDueDate,
    renewal: {
      renewalId,
      loanId: loan.loanId,
      renewedAt: new Date().toISOString(),
      previousDueDate,
      newDueDate,
    },
  }
}

const initialData = createSeedData()

export const useLibraryStore = create<LibraryStore>()(
  persist(
    (set, get) => ({
      ...initialData,
      demoRole: null,
      roleSwitchTarget: null,
      demoMemberId: 1001,
      demoLibrarianId: 2001,
      dbFlowEvents: [],
      requestRoleSwitch: (role, targetPath) => set({ demoRole: role, roleSwitchTarget: targetPath }),
      completeRoleSwitch: () => set({ roleSwitchTarget: null }),
      setDemoMember: (userId) => set({ demoMemberId: userId }),
      setDemoLibrarian: (userId) => set({ demoLibrarianId: userId }),
      recordDbFlowEvents: (drafts) => {
        if (!drafts.length) return
        const timestamp = Date.now()
        const runId = `run-${timestamp}-${Math.random().toString(36).slice(2, 7)}`
        const events = drafts.map((draft, index) => ({
          ...draft,
          id: `${runId}-${index + 1}`,
          runId,
          step: index + 1,
          createdAt: new Date(timestamp + index).toISOString(),
        }))
        set((state) => ({ dbFlowEvents: [...events.reverse(), ...state.dbFlowEvents].slice(0, 120) }))
      },
      clearDbFlowEvents: () => set({ dbFlowEvents: [] }),
      checkout: (memberUserId, copyId, librarianUserId) => {
        const state = get()
        const checks: DbFlowEventDraft[] = []
        const fail = (message: string, tableId: string, columnIds: string[] = [], relationId?: string) => {
          get().recordDbFlowEvents([
            ...checks,
            dbEvent('SELECT', `검증 중단: ${message}`, { tableId, columnIds, relationId, status: 'failed' }),
            dbEvent('ROLLBACK', 'Mock 대출 트랜잭션을 취소했습니다. 데이터는 변경되지 않았습니다.'),
          ])
          return { ok: false, message }
        }
        checks.push(dbEvent('SELECT', '대출을 처리할 활성 사서 계정을 확인합니다.', { tableId: 'app_user', columnIds: ['user_id', 'role', 'account_status'] }))
        if (!validLibrarian(state, librarianUserId)) return fail('활성 사서 데모 계정을 확인해 주세요.', 'app_user', ['role', 'account_status'])
        const member = state.users.find((user) => user.userId === memberUserId && user.role === 'MEMBER')
        checks.push(dbEvent('SELECT', '회원 역할과 활성 상태를 확인합니다.', { tableId: 'app_user', columnIds: ['user_id', 'role', 'account_status'] }))
        if (!member) return fail('회원 정보를 찾을 수 없습니다.', 'app_user', ['user_id', 'role'])
        if (member.accountStatus !== 'ACTIVE') return fail('비활성 회원은 대출할 수 없습니다.', 'app_user', ['account_status'])
        checks.push(dbEvent('SELECT', '회원 ID로 미반납 대출과 연체 여부를 확인합니다.', { tableId: 'loan', columnIds: ['member_user_id', 'current_due_date', 'returned_at'], relationId: 'app_user-loan-member' }))
        const activeLoans = state.loans.filter((loan) => loan.returnedAt === null)
        if (activeLoans.some((loan) => loan.memberUserId === memberUserId && isOverdue(loan))) return fail('연체 중인 도서가 있어 신규 대출을 처리할 수 없습니다.', 'loan', ['current_due_date', 'returned_at'], 'app_user-loan-member')
        if (activeLoans.some((loan) => loan.memberUserId === memberUserId)) return fail('회원당 활성 대출은 1권까지 가능합니다. 현재 대출을 먼저 반납해 주세요.', 'loan', ['member_user_id', 'returned_at'], 'app_user-loan-member')
        checks.push(dbEvent('SELECT', '선택한 서지정보와 실물 소장본의 관리 상태를 확인합니다.', { tableId: 'book_copy', columnIds: ['copy_id', 'book_id', 'management_status'], relationId: 'book-book_copy' }))
        const copy = state.copies.find((item) => item.copyId === copyId)
        const book = copy ? state.books.find((item) => item.bookId === copy.bookId) : undefined
        if (!copy || !book) return fail('소장본을 찾을 수 없습니다.', 'book_copy', ['copy_id', 'book_id'])
        if (book.catalogStatus !== 'ACTIVE' || copy.managementStatus !== 'ACTIVE') {
          return fail('제적 또는 비활성 소장본은 대출할 수 없습니다.', 'book_copy', ['management_status'], 'book-book_copy')
        }
        checks.push(dbEvent('SELECT', '소장본 ID로 기존 미반납 대출이 있는지 확인합니다.', { tableId: 'loan', columnIds: ['copy_id', 'returned_at'], relationId: 'book_copy-loan' }))
        if (activeLoans.some((loan) => loan.copyId === copyId)) return fail('이미 대출 중인 소장본입니다.', 'loan', ['copy_id', 'returned_at'], 'book_copy-loan')
        const today = getKoreanDate()
        const loanId = maxId(state.loans, 'loanId', 9000) + 1
        const loan: Loan = {
          loanId,
          memberUserId,
          copyId,
          checkedOutByUserId: librarianUserId,
          borrowedAt: new Date().toISOString(),
          initialDueDate: addDays(today, 14),
          currentDueDate: addDays(today, 14),
          returnedAt: null,
          returnedByUserId: null,
        }
        set({ loans: [loan, ...state.loans] })
        get().recordDbFlowEvents([
          ...checks,
          dbEvent('INSERT', '대출 대상은 loan 행입니다. book_copy.management_status는 변경하지 않습니다.', { tableId: 'loan', columnIds: ['member_user_id', 'copy_id', 'checked_out_by_user_id', 'borrowed_at', 'initial_due_date', 'current_due_date', 'returned_at'] }),
          dbEvent('COMMIT', 'Mock 대출 처리가 완료되었습니다.', { tableId: 'loan' }),
        ])
        return { ok: true, message: `${book.title} 대출이 완료되었습니다. 반납 예정일은 ${loan.currentDueDate}입니다.`, loanId }
      },
      returnLoan: (loanId, librarianUserId) => {
        const state = get()
        const checks: DbFlowEventDraft[] = []
        const fail = (message: string, columnIds: string[] = ['loan_id']) => {
          get().recordDbFlowEvents([
            ...checks,
            dbEvent('SELECT', `반납 확인 실패: ${message}`, { tableId: 'loan', columnIds, status: 'failed' }),
            dbEvent('ROLLBACK', 'Mock 반납 트랜잭션을 취소했습니다. 데이터는 변경되지 않았습니다.'),
          ])
          return { ok: false, message }
        }
        if (!validLibrarian(state, librarianUserId)) return fail('활성 사서 데모 계정을 확인해 주세요.', ['checked_out_by_user_id'])
        checks.push(dbEvent('SELECT', '반납 대상 loan과 미반납 상태를 확인합니다.', { tableId: 'loan', columnIds: ['loan_id', 'copy_id', 'returned_at'] }))
        const loan = state.loans.find((item) => item.loanId === loanId)
        if (!loan) return fail('대출 기록을 찾을 수 없습니다.')
        if (loan.returnedAt !== null) return fail('이미 반납 처리된 대출입니다.', ['returned_at'])
        const returnedAt = new Date().toISOString()
        set({ loans: state.loans.map((item) => item.loanId === loanId ? { ...item, returnedAt, returnedByUserId: librarianUserId } : item) })
        get().recordDbFlowEvents([
          ...checks,
          dbEvent('UPDATE', '반납 시각과 처리 사서를 같은 loan 행에 기록합니다.', { tableId: 'loan', columnIds: ['returned_at', 'returned_by_user_id'], before: { returned_at: null, returned_by_user_id: null }, after: { returned_at: returnedAt, returned_by_user_id: librarianUserId } }),
          dbEvent('COMMIT', 'Mock 반납 처리가 완료되었습니다. 대출 이력은 유지됩니다.', { tableId: 'loan' }),
        ])
        return { ok: true, message: '반납이 완료되었습니다. 데모 대출 상태를 갱신했습니다.' }
      },
      renewLoan: (loanId, memberUserId, simulateFailure = false) => {
        const state = get()
        const checks: DbFlowEventDraft[] = []
        const member = state.users.find((user) => user.userId === memberUserId && user.role === 'MEMBER')
        checks.push(dbEvent('SELECT', '현재 데모 회원과 대출 회원 참조를 확인합니다.', { tableId: 'app_user', columnIds: ['user_id', 'role'], relationId: 'app_user-loan-member' }))
        if (!member) {
          get().recordDbFlowEvents([
            ...checks,
            dbEvent('SELECT', '회원 검증에 실패했습니다.', { tableId: 'app_user', columnIds: ['role'], status: 'failed' }),
            dbEvent('ROLLBACK', 'Mock 연장 처리를 취소했습니다. 데이터는 변경되지 않았습니다.'),
          ])
          return { ok: false, message: '회원 데모 계정을 확인해 주세요.' }
        }
        checks.push(dbEvent('SELECT', '미반납 대출과 현재 반납 예정일을 조회합니다.', { tableId: 'loan', columnIds: ['loan_id', 'member_user_id', 'current_due_date', 'returned_at'] }))
        const loan = state.loans.find((item) => item.loanId === loanId)
        if (!loan) {
          get().recordDbFlowEvents([...checks, dbEvent('SELECT', '대출 기록을 찾을 수 없습니다.', { tableId: 'loan', status: 'failed' }), dbEvent('ROLLBACK', 'Mock 연장 처리를 취소했습니다. 데이터는 변경되지 않았습니다.')])
          return { ok: false, message: '대출 기록을 찾을 수 없습니다.' }
        }
        if (loan.memberUserId !== memberUserId) {
          get().recordDbFlowEvents([...checks, dbEvent('SELECT', '본인 대출이 아니므로 연장을 거부했습니다.', { tableId: 'loan', columnIds: ['member_user_id'], relationId: 'app_user-loan-member', status: 'failed' }), dbEvent('ROLLBACK', 'Mock 연장 처리를 취소했습니다. 데이터는 변경되지 않았습니다.')])
          return { ok: false, message: '본인의 대출만 연장할 수 있습니다.' }
        }
        checks.push(dbEvent('SELECT', '해당 대출의 연장 이력을 조회해 횟수를 확인합니다.', { tableId: 'loan_renewal', columnIds: ['loan_id', 'renewed_at'], relationId: 'loan-loan_renewal' }))
        if (!canRenew(loan, state.renewals)) {
          get().recordDbFlowEvents([...checks, dbEvent('SELECT', '미반납·비연체·연장 0회 조건을 만족하지 않습니다.', { tableId: 'loan', columnIds: ['returned_at', 'current_due_date'], status: 'failed' }), dbEvent('ROLLBACK', 'Mock 연장 처리를 취소했습니다. 데이터는 변경되지 않았습니다.')])
          return { ok: false, message: '반납, 연체 또는 1회 연장 여부를 확인해 주세요.' }
        }
        const result = renewalsForLoan(loan, state)
        if (simulateFailure) {
          get().recordDbFlowEvents([
            ...checks,
            dbEvent('UPDATE', '트랜잭션 안에서 loan.current_due_date 변경을 준비합니다.', { tableId: 'loan', columnIds: ['current_due_date'], before: loan.currentDueDate, after: result.currentDueDate }),
            dbEvent('INSERT', '시연 오류: loan_renewal 이력 생성이 실패했습니다.', { tableId: 'loan_renewal', columnIds: ['loan_id', 'previous_due_date', 'new_due_date'], relationId: 'loan-loan_renewal', status: 'failed' }),
            dbEvent('ROLLBACK', 'Mock 상태를 연장 전 값으로 되돌렸습니다. 부분 변경은 남지 않았습니다.', { tableId: 'loan', columnIds: ['current_due_date'] }),
          ])
          return { ok: false, message: '오류 시연: loan_renewal 생성 실패를 가정해 전체 Mock 변경을 롤백했습니다.' }
        }
        set({
          loans: state.loans.map((item) => item.loanId === loanId ? { ...item, currentDueDate: result.currentDueDate } : item),
          renewals: [result.renewal, ...state.renewals],
        })
        get().recordDbFlowEvents([
          ...checks,
          dbEvent('UPDATE', '기존 loan.current_due_date를 7일 연장합니다.', { tableId: 'loan', columnIds: ['current_due_date'], before: loan.currentDueDate, after: result.currentDueDate }),
          dbEvent('INSERT', '변경 전·후 기한을 loan_renewal 이력에 추가합니다.', { tableId: 'loan_renewal', columnIds: ['loan_id', 'previous_due_date', 'new_due_date'], relationId: 'loan-loan_renewal', before: null, after: result.renewal }),
          dbEvent('COMMIT', 'Mock 연장 트랜잭션이 완료되었습니다.', { tableId: 'loan' }),
        ])
        return { ok: true, message: `반납 예정일이 ${result.currentDueDate}로 7일 연장되었습니다.` }
      },
      setUserStatus: (userId) => {
        const state = get()
        const user = state.users.find((item) => item.userId === userId)
        if (!user) return { ok: false, message: '회원 정보를 찾을 수 없습니다.' }
        if (user.role === 'MEMBER' && user.accountStatus === 'ACTIVE' && state.loans.some((loan) => loan.memberUserId === userId && loan.returnedAt === null)) {
          return { ok: false, message: '미반납 대출이 있는 회원은 비활성화할 수 없습니다.' }
        }
        const next = user.accountStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
        set({ users: state.users.map((item) => item.userId === userId ? { ...item, accountStatus: next } : item) })
        return { ok: true, message: `${user.fullName} 계정이 ${next === 'ACTIVE' ? '활성' : '비활성'} 상태로 변경되었습니다.` }
      },
      setUserRole: (userId, role) => {
        const state = get()
        const user = state.users.find((item) => item.userId === userId)
        if (!user) return { ok: false, message: '계정을 찾을 수 없습니다.' }
        if (user.role === 'MEMBER' && role !== 'MEMBER' && state.loans.some((loan) => loan.memberUserId === userId && loan.returnedAt === null)) {
          return { ok: false, message: '미반납 대출이 있는 회원의 역할은 변경할 수 없습니다.' }
        }
        set({ users: state.users.map((item) => item.userId === userId ? { ...item, role } : item) })
        return { ok: true, message: '데모 계정 역할을 변경했습니다.' }
      },
      addAuthor: (authorName) => {
        const state = get()
        const name = authorName.trim()
        if (!name) return { ok: false, message: '저자명을 입력해 주세요.' }
        if (name.length > 150) return { ok: false, message: '저자명은 150자 이내로 입력해 주세요.' }
        const authorId = maxId(state.authors, 'authorId', 700) + 1
        set({ authors: [{ authorId, authorName: name }, ...state.authors] })
        return { ok: true, message: `${name} 저자를 데모 목록에 추가했습니다.` }
      },
      renameAuthor: (authorId, authorName) => {
        const state = get()
        const name = authorName.trim()
        if (!name) return { ok: false, message: '저자명을 입력해 주세요.' }
        if (name.length > 150) return { ok: false, message: '저자명은 150자 이내로 입력해 주세요.' }
        if (!state.authors.some((author) => author.authorId === authorId)) return { ok: false, message: '저자 정보를 찾을 수 없습니다.' }
        set({ authors: state.authors.map((author) => author.authorId === authorId ? { ...author, authorName: name } : author) })
        return { ok: true, message: '저자명을 수정했습니다. 연결된 도서 표시도 함께 갱신됩니다.' }
      },
      addMember: (values) => {
        const state = get()
        const loginId = values.loginId.trim()
        const fullName = values.fullName.trim()
        if (!loginId || !fullName) return { ok: false, message: '회원 ID와 이름을 입력해 주세요.' }
        if (loginId.length > 50 || fullName.length > 100) return { ok: false, message: 'ID 또는 이름 길이가 스키마 제한을 넘었습니다.' }
        if (state.users.some((user) => user.loginId.toLocaleLowerCase() === loginId.toLocaleLowerCase())) return { ok: false, message: '이미 등록된 로그인 ID입니다.' }
        const userId = maxId(state.users, 'userId', 1000) + 1
        set({ users: [{ userId, loginId, fullName, contact: values.contact.trim() || null, role: 'MEMBER', accountStatus: 'ACTIVE', createdAt: new Date().toISOString() }, ...state.users] })
        return { ok: true, message: `${fullName} 회원을 데모 목록에 추가했습니다.` }
      },
      saveBook: (values, bookId) => {
        const state = get()
        const isbn = normalizeIsbn(values.isbn)
        const title = values.title.trim()
        const authorNames = values.authorNames.trim()
        if (!title || !authorNames) return { ok: false, message: '도서명과 저자를 입력해 주세요.' }
        if (!validIsbn13(isbn)) return { ok: false, message: 'ISBN-13의 숫자 13자리와 체크 숫자를 확인해 주세요.' }
        if (state.books.some((book) => book.isbn === isbn && book.bookId !== bookId)) return { ok: false, message: '이미 등록된 ISBN입니다.' }
        const rawYear = values.publicationYear.trim()
        const publicationYear = rawYear ? Number(rawYear) : null
        if (publicationYear !== null && (!Number.isInteger(publicationYear) || publicationYear < 1 || publicationYear > 9999)) {
          return { ok: false, message: '발행연도는 1~9999의 정수로 입력해 주세요.' }
        }
        const { authors, authorIds } = authorIdsForNames(state, authorNames)
        const nextBookId = bookId ?? maxId(state.books, 'bookId', 500) + 1
        const book = {
          bookId: nextBookId,
          isbn,
          title,
          publisher: values.publisher.trim() || null,
          publicationYear,
          catalogStatus: state.books.find((item) => item.bookId === bookId)?.catalogStatus ?? 'ACTIVE' as const,
        }
        const books = bookId
          ? state.books.map((item) => item.bookId === bookId ? book : item)
          : [book, ...state.books]
        const bookAuthors = [
          ...state.bookAuthors.filter((relation) => relation.bookId !== nextBookId),
          ...authorIds.map((authorId) => ({ bookId: nextBookId, authorId })),
        ]
        set({ books, authors, bookAuthors })
        return { ok: true, message: bookId ? '도서 정보를 수정했습니다.' : '도서 정보와 저자 연결을 등록했습니다.' }
      },
      addCopy: (bookId, copyCode) => {
        const state = get()
        const code = copyCode.trim()
        if (!state.books.some((book) => book.bookId === bookId)) return { ok: false, message: '도서 정보를 찾을 수 없습니다.' }
        if (!code) return { ok: false, message: '소장본 관리번호를 입력해 주세요.' }
        if (state.copies.some((copy) => copy.copyCode.toLocaleLowerCase() === code.toLocaleLowerCase())) return { ok: false, message: '이미 사용 중인 소장본 관리번호입니다.' }
        const copyId = maxId(state.copies, 'copyId', 5000) + 1
        set({ copies: [{ copyId, bookId, copyCode: code, managementStatus: 'ACTIVE' }, ...state.copies] })
        return { ok: true, message: '소장본을 데모 목록에 추가했습니다.' }
      },
      toggleCopyStatus: (copyId) => {
        const state = get()
        const copy = state.copies.find((item) => item.copyId === copyId)
        if (!copy) return { ok: false, message: '소장본 정보를 찾을 수 없습니다.' }
        if (copy.managementStatus === 'ACTIVE' && state.loans.some((loan) => loan.copyId === copyId && loan.returnedAt === null)) {
          return { ok: false, message: '대출 중인 소장본은 제적할 수 없습니다.' }
        }
        const status = copy.managementStatus === 'ACTIVE' ? 'RETIRED' : 'ACTIVE'
        set({ copies: state.copies.map((item) => item.copyId === copyId ? { ...item, managementStatus: status } : item) })
        return { ok: true, message: `소장본 상태를 ${status === 'ACTIVE' ? '활성' : '제적'}으로 변경했습니다.` }
      },
      setBookStatus: (bookId) => {
        const state = get()
        const book = state.books.find((item) => item.bookId === bookId)
        if (!book) return { ok: false, message: '도서 정보를 찾을 수 없습니다.' }
        if (book.catalogStatus === 'ACTIVE') {
          const copyIds = new Set(state.copies.filter((copy) => copy.bookId === bookId).map((copy) => copy.copyId))
          if (state.loans.some((loan) => loan.returnedAt === null && copyIds.has(loan.copyId))) {
            return { ok: false, message: '대출 중인 소장본이 있어 도서를 제적할 수 없습니다.' }
          }
        }
        const status = book.catalogStatus === 'ACTIVE' ? 'RETIRED' : 'ACTIVE'
        set({ books: state.books.map((item) => item.bookId === bookId ? { ...item, catalogStatus: status } : item) })
        return { ok: true, message: `도서 서지 상태를 ${status === 'ACTIVE' ? '활성' : '제적'}으로 변경했습니다.` }
      },
      resetDemo: () => set({ ...createSeedData(), demoRole: null, roleSwitchTarget: null, demoMemberId: 1001, demoLibrarianId: 2001, dbFlowEvents: [] }),
    }),
    {
      name: 'chaekdam-demo-state-v1',
      version: 1,
      partialize: (state) => ({
        users: state.users,
        books: state.books,
        authors: state.authors,
        bookAuthors: state.bookAuthors,
        copies: state.copies,
        loans: state.loans,
        renewals: state.renewals,
        demoRole: state.demoRole,
        demoMemberId: state.demoMemberId,
        demoLibrarianId: state.demoLibrarianId,
        dbFlowEvents: state.dbFlowEvents,
      }),
    },
  ),
)
