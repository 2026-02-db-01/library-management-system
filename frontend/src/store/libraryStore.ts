import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addDays, createSeedData, getKoreanDate } from '../data/mock/seed'
import { canRenew, isOverdue } from '../services/library'
import type { BookFormValues, LibraryData, Loan, UserRole } from '../types/domain'

export interface ActionResult {
  ok: boolean
  message: string
  loanId?: number
}

interface LibraryStore extends LibraryData {
  demoMemberId: number
  setDemoMember: (userId: number) => void
  checkout: (memberUserId: number, copyId: number, librarianUserId: number) => ActionResult
  returnLoan: (loanId: number, librarianUserId: number) => ActionResult
  renewLoan: (loanId: number, librarianUserId: number) => ActionResult
  setUserStatus: (userId: number) => ActionResult
  setUserRole: (userId: number, role: UserRole) => ActionResult
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
      demoMemberId: 1001,
      setDemoMember: (userId) => set({ demoMemberId: userId }),
      checkout: (memberUserId, copyId, librarianUserId) => {
        const state = get()
        if (!validLibrarian(state, librarianUserId)) return { ok: false, message: '활성 사서 데모 계정을 확인해 주세요.' }
        const member = state.users.find((user) => user.userId === memberUserId && user.role === 'MEMBER')
        if (!member) return { ok: false, message: '회원 정보를 찾을 수 없습니다.' }
        if (member.accountStatus !== 'ACTIVE') return { ok: false, message: '비활성 회원은 대출할 수 없습니다.' }
        const activeLoans = state.loans.filter((loan) => loan.returnedAt === null)
        if (activeLoans.some((loan) => loan.memberUserId === memberUserId)) {
          return { ok: false, message: '회원당 활성 대출은 1권까지 가능합니다. 현재 대출을 먼저 반납해 주세요.' }
        }
        if (activeLoans.some((loan) => loan.memberUserId === memberUserId && isOverdue(loan))) {
          return { ok: false, message: '연체 중인 도서가 있어 신규 대출을 처리할 수 없습니다.' }
        }
        const copy = state.copies.find((item) => item.copyId === copyId)
        const book = copy ? state.books.find((item) => item.bookId === copy.bookId) : undefined
        if (!copy || !book) return { ok: false, message: '소장본을 찾을 수 없습니다.' }
        if (book.catalogStatus !== 'ACTIVE' || copy.managementStatus !== 'ACTIVE') {
          return { ok: false, message: '제적 또는 비활성 소장본은 대출할 수 없습니다.' }
        }
        if (activeLoans.some((loan) => loan.copyId === copyId)) return { ok: false, message: '이미 대출 중인 소장본입니다.' }
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
        return { ok: true, message: `${book.title} 대출이 완료되었습니다. 반납 예정일은 ${loan.currentDueDate}입니다.`, loanId }
      },
      returnLoan: (loanId, librarianUserId) => {
        const state = get()
        if (!validLibrarian(state, librarianUserId)) return { ok: false, message: '활성 사서 데모 계정을 확인해 주세요.' }
        const loan = state.loans.find((item) => item.loanId === loanId)
        if (!loan) return { ok: false, message: '대출 기록을 찾을 수 없습니다.' }
        if (loan.returnedAt !== null) return { ok: false, message: '이미 반납 처리된 대출입니다.' }
        set({ loans: state.loans.map((item) => item.loanId === loanId ? { ...item, returnedAt: new Date().toISOString(), returnedByUserId: librarianUserId } : item) })
        return { ok: true, message: '반납이 완료되었습니다. 데모 대출 상태를 갱신했습니다.' }
      },
      renewLoan: (loanId, librarianUserId) => {
        const state = get()
        if (!validLibrarian(state, librarianUserId)) return { ok: false, message: '활성 사서 데모 계정을 확인해 주세요.' }
        const loan = state.loans.find((item) => item.loanId === loanId)
        if (!loan) return { ok: false, message: '대출 기록을 찾을 수 없습니다.' }
        if (!canRenew(loan, state.renewals)) return { ok: false, message: '반납, 연체 또는 1회 연장 여부를 확인해 주세요.' }
        const result = renewalsForLoan(loan, state)
        set({
          loans: state.loans.map((item) => item.loanId === loanId ? { ...item, currentDueDate: result.currentDueDate } : item),
          renewals: [result.renewal, ...state.renewals],
        })
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
      resetDemo: () => set({ ...createSeedData(), demoMemberId: 1001 }),
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
        demoMemberId: state.demoMemberId,
      }),
    },
  ),
)
