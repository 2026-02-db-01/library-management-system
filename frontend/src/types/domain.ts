export type UserRole = "MEMBER" | "LIBRARIAN" | "ADMIN";
export type AccountStatus = "ACTIVE" | "INACTIVE" | "WITHDRAWN";
export type RecordStatus = "ACTIVE" | "DAMAGED" | "RETIRED";

export type DbFlowOperation =
  "SELECT" | "INSERT" | "UPDATE" | "COMMIT" | "ROLLBACK";
export type DbFlowStatus = "pending" | "active" | "success" | "failed";

export interface DbFlowEvent {
  id: string;
  runId: string;
  step: number;
  createdAt: string;
  operation: DbFlowOperation;
  tableId?: string;
  columnIds?: string[];
  relationId?: string;
  message: string;
  status: DbFlowStatus;
  before?: unknown;
  after?: unknown;
}

export type DbFlowEventDraft = Omit<
  DbFlowEvent,
  "id" | "runId" | "step" | "createdAt"
>;

export interface LibraryUser {
  userId: number;
  loginId: string | null;
  fullName: string | null;
  contact: string | null;
  role: UserRole;
  accountStatus: AccountStatus;
  createdAt: string;
  borrowingSuspendedUntil: string | null;
}

export interface Book {
  bookId: number;
  isbn: string | null;
  title: string;
  publisher: string | null;
  publicationYear: number | null;
  categoryCode: string;
}

export interface Author {
  authorId: number;
  authorName: string;
}

export interface BookAuthor {
  bookId: number;
  authorId: number;
}

export interface BookCopy {
  copyId: number;
  bookId: number;
  copyCode: string;
  managementStatus: RecordStatus;
}

export interface Loan {
  loanId: number;
  memberUserId: number | null;
  copyId: number;
  checkedOutByUserId: number;
  borrowedAt: string;
  initialDueDate: string;
  currentDueDate: string;
  returnedAt: string | null;
  returnedByUserId: number | null;
  isCancelled: boolean;
  cancelledAt: string | null;
}

export interface LoanRenewal {
  renewalId: number;
  loanId: number;
  renewedAt: string;
  previousDueDate: string;
  newDueDate: string;
}

export interface LibraryData {
  users: LibraryUser[];
  books: Book[];
  authors: Author[];
  bookAuthors: BookAuthor[];
  copies: BookCopy[];
  loans: Loan[];
  renewals: LoanRenewal[];
  staffHistory: StaffAccountHistory[];
  bookHistory: BookChangeHistory[];
  copyHistory: CopyStatusHistory[];
  corrections: LoanCorrectionHistory[];
  requests: RequestRecord[];
}

export interface BookFormValues {
  isbn: string;
  title: string;
  publisher: string;
  publicationYear: string;
  authorNames: string;
  categoryCode: string;
  authorIds?: number[];
  confirmSimilar?: boolean;
}

export type Snapshot = Record<
  string,
  string | number | boolean | null | number[]
>;
export interface StaffAccountHistory {
  staffHistoryId: number;
  targetStaffUserId: number;
  actionType: "CREATE" | "DEACTIVATE" | "REACTIVATE";
  previousStatus: "ACTIVE" | "INACTIVE" | null;
  newStatus: "ACTIVE" | "INACTIVE";
  roleAtCreation: "LIBRARIAN" | "ADMIN" | null;
  reason: string | null;
  processedByAdminUserId: number | null;
  processedAt: string;
}
export interface BookChangeHistory {
  bookChangeId: number;
  bookId: number;
  changedByUserId: number;
  changedAt: string;
  beforeValues: Snapshot;
  afterValues: Snapshot;
}
export interface CopyStatusHistory {
  copyStatusHistoryId: number;
  copyId: number;
  previousStatus: RecordStatus | null;
  newStatus: RecordStatus;
  reason: string;
  changedByUserId: number;
  relatedLoanId: number | null;
  changedAt: string;
}
export type CorrectionType =
  "CANCEL_LOAN" | "UNDO_RETURN" | "CORRECT_DUE_DATE" | "CORRECT_RETURNED_AT";
export interface LoanCorrectionHistory {
  correctionId: number;
  loanId: number;
  correctionType: CorrectionType;
  beforeValues: Snapshot;
  afterValues: Snapshot;
  reason: string;
  evidenceReference: string | null;
  correctedByUserId: number;
  correctedAt: string;
}
export interface RequestRecord {
  requestId: string;
  operationType: "CHECKOUT" | "RETURN" | "RENEW" | "CORRECT";
  requestFingerprint: string;
  processingStatus: "PENDING" | "COMPLETED" | "FAILED";
  resultCode: string | null;
  responseSnapshot: Snapshot | null;
  actorUserId: number | null;
  targetLoanId: number | null;
  requestedAt: string;
  completedAt: string | null;
}
