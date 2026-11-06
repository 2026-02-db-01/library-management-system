import type { LibraryData } from '../types/domain'
import type { TableName } from '../data/metadata/schema'

export type PreviewRow = Record<string, string | number | null>

export function getPreviewRows(tableName: TableName, data: LibraryData): PreviewRow[] {
  switch (tableName) {
    case 'app_user':
      return data.users.map((user) => ({
        user_id: user.userId,
        login_id: user.loginId,
        full_name: user.fullName,
        contact: user.contact,
        role: user.role,
        account_status: user.accountStatus,
        created_at: user.createdAt,
      }))
    case 'book':
      return data.books.map((book) => ({
        book_id: book.bookId,
        isbn: book.isbn,
        title: book.title,
        publisher: book.publisher,
        publication_year: book.publicationYear,
        catalog_status: book.catalogStatus,
      }))
    case 'author':
      return data.authors.map((author) => ({ author_id: author.authorId, author_name: author.authorName }))
    case 'book_author':
      return data.bookAuthors.map((relation) => ({ book_id: relation.bookId, author_id: relation.authorId }))
    case 'book_copy':
      return data.copies.map((copy) => ({
        copy_id: copy.copyId,
        book_id: copy.bookId,
        copy_code: copy.copyCode,
        management_status: copy.managementStatus,
      }))
    case 'loan':
      return data.loans.map((loan) => ({
        loan_id: loan.loanId,
        member_user_id: loan.memberUserId,
        copy_id: loan.copyId,
        checked_out_by_user_id: loan.checkedOutByUserId,
        borrowed_at: loan.borrowedAt,
        initial_due_date: loan.initialDueDate,
        current_due_date: loan.currentDueDate,
        returned_at: loan.returnedAt,
        returned_by_user_id: loan.returnedByUserId,
      }))
    case 'loan_renewal':
      return data.renewals.map((renewal) => ({
        renewal_id: renewal.renewalId,
        loan_id: renewal.loanId,
        renewed_at: renewal.renewedAt,
        previous_due_date: renewal.previousDueDate,
        new_due_date: renewal.newDueDate,
      }))
  }
}
