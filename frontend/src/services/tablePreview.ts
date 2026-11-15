import type { LibraryData } from "../types/domain";
import type { TableName } from "../data/metadata/schema";

export type PreviewRow = Record<string, string | number | null>;

export function getPreviewRows(
  tableName: TableName,
  data: LibraryData,
): PreviewRow[] {
  // Administrators may inspect these schemas, but Wiki FR-20 reserves the actual
  // book/copy/correction audit records for librarians.
  if (
    [
      "book_change_history",
      "copy_status_history",
      "loan_correction_history",
    ].includes(tableName)
  )
    return [];
  switch (tableName) {
    case "app_user":
      return data.users.map((user) => ({
        user_id: user.userId,
        login_id: null,
        full_name: null,
        contact: null,
        role: user.role,
        account_status: user.accountStatus,
        created_at: user.createdAt,
        borrowing_suspended_until: user.borrowingSuspendedUntil,
      }));
    case "book":
      return data.books.map((book) => ({
        book_id: book.bookId,
        isbn: book.isbn,
        title: book.title,
        publisher: book.publisher,
        publication_year: book.publicationYear,
        category_code: book.categoryCode,
      }));
    case "author":
      return data.authors.map((author) => ({
        author_id: author.authorId,
        author_name: author.authorName,
      }));
    case "book_author":
      return data.bookAuthors.map((relation) => ({
        book_id: relation.bookId,
        author_id: relation.authorId,
      }));
    case "book_copy":
      return data.copies.map((copy) => ({
        copy_id: copy.copyId,
        book_id: copy.bookId,
        copy_code: copy.copyCode,
        management_status: copy.managementStatus,
      }));
    case "loan":
      return data.loans.map((loan) => ({
        loan_id: loan.loanId,
        member_user_id: null,
        copy_id: loan.copyId,
        checked_out_by_user_id: loan.checkedOutByUserId,
        borrowed_at: loan.borrowedAt,
        initial_due_date: loan.initialDueDate,
        current_due_date: loan.currentDueDate,
        returned_at: loan.returnedAt,
        returned_by_user_id: loan.returnedByUserId,
        is_cancelled: String(loan.isCancelled),
        cancelled_at: loan.cancelledAt,
      }));
    case "loan_renewal":
      return data.renewals.map((renewal) => ({
        renewal_id: renewal.renewalId,
        loan_id: renewal.loanId,
        renewed_at: renewal.renewedAt,
        previous_due_date: renewal.previousDueDate,
        new_due_date: renewal.newDueDate,
      }));
    default: {
      const rows =
        tableName === "staff_account_history"
          ? data.staffHistory
          : tableName === "book_change_history"
            ? data.bookHistory
            : tableName === "copy_status_history"
              ? data.copyHistory
              : tableName === "loan_correction_history"
                ? data.corrections
                : data.requests;
      return rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`),
            key === "actorUserId" ||
            key === "reason" ||
            key === "evidenceReference" ||
            key === "requestFingerprint"
              ? null
              : value !== null && typeof value === "object"
                ? JSON.stringify(value)
                : typeof value === "number"
                  ? value
                  : value === null
                    ? null
                    : String(value),
          ]),
        ),
      );
    }
  }
}
