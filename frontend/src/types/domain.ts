export type UserRole = 'MEMBER' | 'LIBRARIAN' | 'ADMIN'
export type AccountStatus = 'ACTIVE' | 'INACTIVE'
export type RecordStatus = 'ACTIVE' | 'RETIRED'

export type DbFlowOperation = 'SELECT' | 'INSERT' | 'UPDATE' | 'COMMIT' | 'ROLLBACK'
export type DbFlowStatus = 'pending' | 'active' | 'success' | 'failed'

export interface DbFlowEvent {
  id: string
  runId: string
  step: number
  createdAt: string
  operation: DbFlowOperation
  tableId?: string
  columnIds?: string[]
  relationId?: string
  message: string
  status: DbFlowStatus
  before?: unknown
  after?: unknown
}

export type DbFlowEventDraft = Omit<DbFlowEvent, 'id' | 'runId' | 'step' | 'createdAt'>

export interface LibraryUser {
  userId: number
  loginId: string
  fullName: string
  contact: string | null
  role: UserRole
  accountStatus: AccountStatus
  createdAt: string
}

export interface Book {
  bookId: number
  isbn: string
  title: string
  publisher: string | null
  publicationYear: number | null
  catalogStatus: RecordStatus
}

export interface Author {
  authorId: number
  authorName: string
}

export interface BookAuthor {
  bookId: number
  authorId: number
}

export interface BookCopy {
  copyId: number
  bookId: number
  copyCode: string
  managementStatus: RecordStatus
}

export interface Loan {
  loanId: number
  memberUserId: number
  copyId: number
  checkedOutByUserId: number
  borrowedAt: string
  initialDueDate: string
  currentDueDate: string
  returnedAt: string | null
  returnedByUserId: number | null
}

export interface LoanRenewal {
  renewalId: number
  loanId: number
  renewedAt: string
  previousDueDate: string
  newDueDate: string
}

export interface LibraryData {
  users: LibraryUser[]
  books: Book[]
  authors: Author[]
  bookAuthors: BookAuthor[]
  copies: BookCopy[]
  loans: Loan[]
  renewals: LoanRenewal[]
}

export interface BookFormValues {
  isbn: string
  title: string
  publisher: string
  publicationYear: string
  authorNames: string
}
