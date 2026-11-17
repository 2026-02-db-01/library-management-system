import type { LibraryData } from '../types/domain'
import { apiRequest } from './client'

export interface ActionResult {
  ok: boolean
  message: string
  loanId?: number | null
  dbFlowEvents?: unknown[]
}

export const libraryApi = {
  fetchState(): Promise<LibraryData> {
    return apiRequest<LibraryData>('/api/v1/library/state', { method: 'GET' })
  },

  // 도서 및 저자
  createAuthor(authorName: string) {
    return apiRequest('/api/v1/books/authors', {
      method: 'POST',
      body: JSON.stringify({ authorName }),
    })
  },

  renameAuthor(authorId: number, authorName: string) {
    return apiRequest(`/api/v1/books/authors/${authorId}`, {
      method: 'PATCH',
      body: JSON.stringify({ authorName }),
    })
  },

  saveBook(payload: {
    bookId?: number
    isbn: string
    title: string
    publisher: string
    publicationYear: number | string | null
    authorNames: string
    categoryCode?: string
    authorIds?: number[]
    confirmSimilar?: boolean
  }) {
    const { bookId, ...body } = payload
    return apiRequest(bookId ? `/api/v1/books/${bookId}` : '/api/v1/books', {
      method: bookId ? 'PUT' : 'POST',
      body: JSON.stringify(body),
    })
  },

  addCopy(bookId: number) {
    return apiRequest(`/api/v1/books/${bookId}/copies`, {
      method: 'POST',
    })
  },

  changeCopyStatus(copyId: number, status: 'ACTIVE' | 'DAMAGED' | 'RETIRED', reason: string) {
    return apiRequest(`/api/v1/books/copies/${copyId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    })
  },

  // 대출·반납·연장·정정
  checkout(memberUserId: number, copyId: number, requestId?: string): Promise<ActionResult> {
    return apiRequest<ActionResult>('/api/v1/loans/checkout', {
      method: 'POST',
      body: JSON.stringify({ memberUserId, copyId, requestId }),
    })
  },

  returnLoan(loanId: number, damaged = false, reason = '', requestId?: string): Promise<ActionResult> {
    return apiRequest<ActionResult>(`/api/v1/loans/${loanId}/return`, {
      method: 'POST',
      body: JSON.stringify({ damaged, reason, requestId }),
    })
  },

  renewLoan(loanId: number, requestId?: string): Promise<ActionResult> {
    return apiRequest<ActionResult>(`/api/v1/loans/${loanId}/renew`, {
      method: 'POST',
      body: JSON.stringify({ requestId }),
    })
  },

  correctLoan(
    loanId: number,
    payload: {
      type: 'CANCEL_LOAN' | 'UNDO_RETURN' | 'CORRECT_DUE_DATE' | 'CORRECT_RETURNED_AT'
      reason: string
      evidence?: string
      value?: string
      physicalConfirmed?: boolean
      requestId?: string
    },
  ): Promise<ActionResult> {
    return apiRequest<ActionResult>(`/api/v1/loans/${loanId}/correct`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  // 회원 및 직원 관리
  updateProfile(fullName: string, contact: string): Promise<ActionResult> {
    return apiRequest<ActionResult>('/api/v1/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ fullName, contact }),
    })
  },

  withdrawAccount(): Promise<ActionResult> {
    return apiRequest<ActionResult>('/api/v1/users/me', {
      method: 'DELETE',
    })
  },

  createStaff(payload: {
    loginId: string
    fullName: string
    contact: string
    role: 'LIBRARIAN' | 'ADMIN'
  }): Promise<ActionResult> {
    return apiRequest<ActionResult>('/api/v1/users/staff', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  toggleStaffStatus(userId: number, reason: string): Promise<ActionResult> {
    return apiRequest<ActionResult>(`/api/v1/users/staff/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    })
  },
}