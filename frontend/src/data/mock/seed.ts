import type { LibraryData } from '../../types/domain'

export function getKoreanDate(date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + amount)
  return value.toISOString().slice(0, 10)
}

function timestampAt(date: string, time = '10:15:00'): string {
  return new Date(`${date}T${time}+09:00`).toISOString()
}

function ago(days: number): string {
  return timestampAt(addDays(getKoreanDate(), -days))
}

export function createSeedData(): LibraryData {
  const today = getKoreanDate()
  const users: LibraryData['users'] = [
    { userId: 1001, loginId: 'haneul.k', fullName: '김하늘', contact: '010-****-1204', role: 'MEMBER', accountStatus: 'ACTIVE', createdAt: ago(168) },
    { userId: 1002, loginId: 'doyun.p', fullName: '박도윤', contact: '010-****-3812', role: 'MEMBER', accountStatus: 'ACTIVE', createdAt: ago(130) },
    { userId: 1003, loginId: 'seoyun.l', fullName: '이서윤', contact: '010-****-4418', role: 'MEMBER', accountStatus: 'ACTIVE', createdAt: ago(97) },
    { userId: 1004, loginId: 'minjun.c', fullName: '최민준', contact: '010-****-2037', role: 'MEMBER', accountStatus: 'ACTIVE', createdAt: ago(82) },
    { userId: 1005, loginId: 'yujin.j', fullName: '정유진', contact: '010-****-9902', role: 'MEMBER', accountStatus: 'INACTIVE', createdAt: ago(215) },
    { userId: 2001, loginId: 'librarian.seo', fullName: '한서연', contact: '내선 204', role: 'LIBRARIAN', accountStatus: 'ACTIVE', createdAt: ago(480) },
    { userId: 2002, loginId: 'librarian.moon', fullName: '문재호', contact: '내선 207', role: 'LIBRARIAN', accountStatus: 'ACTIVE', createdAt: ago(402) },
    { userId: 3001, loginId: 'admin.kim', fullName: '김도현', contact: '내선 101', role: 'ADMIN', accountStatus: 'ACTIVE', createdAt: ago(610) },
  ]

  const authors: LibraryData['authors'] = [
    { authorId: 701, authorName: 'Robert C. Martin' },
    { authorId: 702, authorName: 'Martin Kleppmann' },
    { authorId: 703, authorName: 'David Thomas' },
    { authorId: 704, authorName: 'Andrew Hunt' },
    { authorId: 705, authorName: 'Abraham Silberschatz' },
    { authorId: 706, authorName: 'Antoine de Saint-Exupéry' },
    { authorId: 707, authorName: '한강' },
    { authorId: 708, authorName: 'Joshua Bloch' },
  ]

  const books: LibraryData['books'] = [
    { bookId: 501, isbn: '9780132350884', title: 'Clean Code', publisher: 'Prentice Hall', publicationYear: 2008, catalogStatus: 'ACTIVE' },
    { bookId: 502, isbn: '9781449373320', title: 'Designing Data-Intensive Applications', publisher: "O'Reilly Media", publicationYear: 2017, catalogStatus: 'ACTIVE' },
    { bookId: 503, isbn: '9780135957059', title: 'The Pragmatic Programmer', publisher: 'Addison-Wesley', publicationYear: 2019, catalogStatus: 'ACTIVE' },
    { bookId: 504, isbn: '9780073523323', title: 'Database System Concepts', publisher: 'McGraw-Hill', publicationYear: 2010, catalogStatus: 'ACTIVE' },
    { bookId: 505, isbn: '9780133591620', title: 'Modern Operating Systems', publisher: 'Pearson', publicationYear: 2014, catalogStatus: 'ACTIVE' },
    { bookId: 506, isbn: '9780156012195', title: '어린 왕자', publisher: 'HarperOne', publicationYear: 2000, catalogStatus: 'ACTIVE' },
    { bookId: 507, isbn: '9788936433598', title: '채식주의자', publisher: '창비', publicationYear: 2007, catalogStatus: 'ACTIVE' },
    { bookId: 508, isbn: '9780134685991', title: 'Effective Java', publisher: 'Addison-Wesley', publicationYear: 2017, catalogStatus: 'ACTIVE' },
  ]

  const bookAuthors: LibraryData['bookAuthors'] = [
    { bookId: 501, authorId: 701 },
    { bookId: 502, authorId: 702 },
    { bookId: 503, authorId: 703 },
    { bookId: 503, authorId: 704 },
    { bookId: 504, authorId: 705 },
    { bookId: 505, authorId: 702 },
    { bookId: 506, authorId: 706 },
    { bookId: 507, authorId: 707 },
    { bookId: 508, authorId: 708 },
  ]

  const copies: LibraryData['copies'] = [
    { copyId: 5001, bookId: 501, copyCode: 'LIB-2024-001', managementStatus: 'ACTIVE' },
    { copyId: 5002, bookId: 501, copyCode: 'LIB-2024-002', managementStatus: 'ACTIVE' },
    { copyId: 5003, bookId: 502, copyCode: 'LIB-2024-003', managementStatus: 'ACTIVE' },
    { copyId: 5004, bookId: 502, copyCode: 'LIB-2024-004', managementStatus: 'ACTIVE' },
    { copyId: 5005, bookId: 503, copyCode: 'LIB-2024-005', managementStatus: 'ACTIVE' },
    { copyId: 5006, bookId: 503, copyCode: 'LIB-2024-006', managementStatus: 'ACTIVE' },
    { copyId: 5007, bookId: 504, copyCode: 'LIB-2024-007', managementStatus: 'ACTIVE' },
    { copyId: 5008, bookId: 504, copyCode: 'LIB-2024-008', managementStatus: 'ACTIVE' },
    { copyId: 5009, bookId: 505, copyCode: 'LIB-2024-009', managementStatus: 'ACTIVE' },
    { copyId: 5010, bookId: 506, copyCode: 'LIB-2024-010', managementStatus: 'ACTIVE' },
    { copyId: 5011, bookId: 506, copyCode: 'LIB-2024-011', managementStatus: 'ACTIVE' },
    { copyId: 5012, bookId: 507, copyCode: 'LIB-2024-012', managementStatus: 'ACTIVE' },
    { copyId: 5013, bookId: 508, copyCode: 'LIB-2024-013', managementStatus: 'ACTIVE' },
  ]

  const loans: LibraryData['loans'] = [
    { loanId: 9001, memberUserId: 1001, copyId: 5001, checkedOutByUserId: 2001, borrowedAt: timestampAt(addDays(today, -11)), initialDueDate: addDays(today, 3), currentDueDate: addDays(today, 3), returnedAt: null, returnedByUserId: null },
    { loanId: 9002, memberUserId: 1002, copyId: 5005, checkedOutByUserId: 2002, borrowedAt: timestampAt(addDays(today, -16)), initialDueDate: addDays(today, -2), currentDueDate: addDays(today, -2), returnedAt: null, returnedByUserId: null },
    { loanId: 9003, memberUserId: 1004, copyId: 5008, checkedOutByUserId: 2001, borrowedAt: timestampAt(addDays(today, -7)), initialDueDate: addDays(today, 7), currentDueDate: addDays(today, 7), returnedAt: null, returnedByUserId: null },
    { loanId: 8998, memberUserId: 1003, copyId: 5002, checkedOutByUserId: 2002, borrowedAt: timestampAt(addDays(today, -34)), initialDueDate: addDays(today, -20), currentDueDate: addDays(today, -20), returnedAt: timestampAt(addDays(today, -19), '15:30:00'), returnedByUserId: 2001 },
    { loanId: 8997, memberUserId: 1003, copyId: 5003, checkedOutByUserId: 2001, borrowedAt: timestampAt(addDays(today, -90)), initialDueDate: addDays(today, -76), currentDueDate: addDays(today, -69), returnedAt: timestampAt(addDays(today, -68), '12:10:00'), returnedByUserId: 2002 },
    { loanId: 8996, memberUserId: 1002, copyId: 5006, checkedOutByUserId: 2002, borrowedAt: timestampAt(addDays(today, -63)), initialDueDate: addDays(today, -49), currentDueDate: addDays(today, -42), returnedAt: timestampAt(addDays(today, -44), '16:20:00'), returnedByUserId: 2001 },
    { loanId: 8995, memberUserId: 1001, copyId: 5004, checkedOutByUserId: 2001, borrowedAt: timestampAt(addDays(today, -155)), initialDueDate: addDays(today, -141), currentDueDate: addDays(today, -141), returnedAt: timestampAt(addDays(today, -143), '11:45:00'), returnedByUserId: 2001 },
    { loanId: 8994, memberUserId: 1003, copyId: 5010, checkedOutByUserId: 2002, borrowedAt: timestampAt(addDays(today, -120)), initialDueDate: addDays(today, -106), currentDueDate: addDays(today, -106), returnedAt: timestampAt(addDays(today, -105), '10:45:00'), returnedByUserId: 2002 },
    { loanId: 8993, memberUserId: 1004, copyId: 5009, checkedOutByUserId: 2001, borrowedAt: timestampAt(addDays(today, -185)), initialDueDate: addDays(today, -171), currentDueDate: addDays(today, -164), returnedAt: timestampAt(addDays(today, -166), '14:00:00'), returnedByUserId: 2002 },
    { loanId: 8992, memberUserId: 1005, copyId: 5012, checkedOutByUserId: 2002, borrowedAt: timestampAt(addDays(today, -245)), initialDueDate: addDays(today, -231), currentDueDate: addDays(today, -231), returnedAt: timestampAt(addDays(today, -234), '13:00:00'), returnedByUserId: 2001 },
  ]

  const renewals: LibraryData['renewals'] = [
    { renewalId: 9501, loanId: 8997, renewedAt: timestampAt(addDays(today, -76), '09:20:00'), previousDueDate: addDays(today, -76), newDueDate: addDays(today, -69) },
    { renewalId: 9502, loanId: 8996, renewedAt: timestampAt(addDays(today, -49), '14:35:00'), previousDueDate: addDays(today, -49), newDueDate: addDays(today, -42) },
    { renewalId: 9503, loanId: 8993, renewedAt: timestampAt(addDays(today, -171), '10:25:00'), previousDueDate: addDays(today, -171), newDueDate: addDays(today, -164) },
  ]

  return { users, books, authors, bookAuthors, copies, loans, renewals }
}
