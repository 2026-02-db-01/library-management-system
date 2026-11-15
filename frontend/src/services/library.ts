import { addDays, getKoreanDate } from "../data/mock/seed";
import type {
  Author,
  Book,
  BookCopy,
  LibraryData,
  Loan,
  LoanRenewal,
} from "../types/domain";

export interface BookAvailability {
  total: number;
  available: number;
  borrowed: number;
  retired: number;
  damaged: number;
}

export function getAuthorsForBook(
  bookId: number,
  data: Pick<LibraryData, "authors" | "bookAuthors">,
): Author[] {
  return data.bookAuthors
    .filter((relation) => relation.bookId === bookId)
    .map((relation) =>
      data.authors.find((author) => author.authorId === relation.authorId),
    )
    .filter((author): author is Author => Boolean(author));
}

export function getBookForCopy(
  copyId: number,
  data: Pick<LibraryData, "books" | "copies">,
): Book | undefined {
  const copy = data.copies.find((item) => item.copyId === copyId);
  return copy
    ? data.books.find((book) => book.bookId === copy.bookId)
    : undefined;
}

export function getAvailability(
  bookId: number,
  data: Pick<LibraryData, "copies" | "loans">,
): BookAvailability {
  const copies = data.copies.filter((copy) => copy.bookId === bookId);
  const activeCopyIds = new Set(
    data.loans.filter(isActiveLoan).map((loan) => loan.copyId),
  );
  const active = copies.filter((copy) => copy.managementStatus === "ACTIVE");
  const available = active.filter(
    (copy) => !activeCopyIds.has(copy.copyId),
  ).length;
  return {
    total: copies.length,
    available,
    borrowed: copies.filter((copy) => activeCopyIds.has(copy.copyId)).length,
    retired: copies.filter((copy) => copy.managementStatus === "RETIRED")
      .length,
    damaged: copies.filter((copy) => copy.managementStatus === "DAMAGED")
      .length,
  };
}

export function isOverdue(loan: Loan, today = getKoreanDate()): boolean {
  return isActiveLoan(loan) && loan.currentDueDate < today;
}

export function getOverdueDays(loan: Loan, today = getKoreanDate()): number {
  if (loan.isCancelled) return 0;
  const actualDate = loan.returnedAt
    ? getKoreanDate(new Date(loan.returnedAt))
    : today;
  if (actualDate <= loan.currentDueDate) return 0;
  const start = new Date(`${loan.currentDueDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${actualDate}T00:00:00.000Z`).getTime();
  return Math.floor((end - start) / 86_400_000);
}

export function getRenewalCount(
  loanId: number,
  renewals: LoanRenewal[],
): number {
  return renewals.filter((renewal) => renewal.loanId === loanId).length;
}

export function canRenew(
  loan: Loan,
  renewals: LoanRenewal[],
  today = getKoreanDate(),
): boolean {
  return (
    isActiveLoan(loan) &&
    !isOverdue(loan, today) &&
    getRenewalCount(loan.loanId, renewals) < 1
  );
}

export function getAvailableCopies(
  bookId: number,
  data: Pick<LibraryData, "copies" | "loans">,
): BookCopy[] {
  const activeCopyIds = new Set(
    data.loans.filter(isActiveLoan).map((loan) => loan.copyId),
  );
  return data.copies.filter(
    (copy) =>
      copy.bookId === bookId &&
      copy.managementStatus === "ACTIVE" &&
      !activeCopyIds.has(copy.copyId),
  );
}

export function deriveLoanCounts(
  data: Pick<LibraryData, "loans">,
  today = getKoreanDate(),
) {
  const active = data.loans.filter(isActiveLoan);
  return {
    active: active.length,
    overdue: active.filter((loan) => isOverdue(loan, today)).length,
    dueToday: active.filter((loan) => loan.currentDueDate === today).length,
    dueSoon: active.filter(
      (loan) =>
        loan.currentDueDate >= today &&
        loan.currentDueDate <= addDays(today, 3),
    ).length,
    returned: data.loans.filter(
      (loan) => !loan.isCancelled && loan.returnedAt !== null,
    ).length,
  };
}

export function formatDate(date: string | null): string {
  if (!date) return "—";
  const value = new Date(date.length === 10 ? `${date}T00:00:00+09:00` : date);
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(value);
}

export function initials(name: string | null): string {
  return name?.trim().slice(0, 1) || "—";
}

export function isActiveLoan(loan: Loan): boolean {
  return !loan.isCancelled && loan.returnedAt === null;
}
export function isBookVisible(
  bookId: number,
  data: Pick<LibraryData, "copies">,
): boolean {
  return data.copies.some(
    (copy) => copy.bookId === bookId && copy.managementStatus !== "RETIRED",
  );
}
export function suspensionUntil(
  memberId: number,
  loans: Loan[],
): string | null {
  const times = loans
    .filter(
      (loan) =>
        loan.memberUserId === memberId &&
        !loan.isCancelled &&
        loan.returnedAt &&
        getOverdueDays(loan) > 0,
    )
    .map(
      (loan) =>
        new Date(loan.returnedAt!).getTime() + getOverdueDays(loan) * 86400000,
    );
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}
export function normalizeIsbn(input: string): string | null {
  const value = input.replace(/[\s-]/g, "").toUpperCase();
  if (!value) return null;
  if (/^\d{9}[\dX]$/.test(value)) {
    if (
      [...value].reduce(
        (sum, char, i) => sum + (char === "X" ? 10 : Number(char)) * (10 - i),
        0,
      ) %
        11 !==
      0
    )
      throw new Error("ISBN-10 체크디지트를 확인하세요.");
    const prefix = `978${value.slice(0, 9)}`;
    const sum = [...prefix].reduce(
      (s, c, i) => s + Number(c) * (i % 2 ? 3 : 1),
      0,
    );
    return prefix + ((10 - (sum % 10)) % 10);
  }
  if (
    !/^\d{13}$/.test(value) ||
    [...value].reduce((s, c, i) => s + Number(c) * (i % 2 ? 3 : 1), 0) % 10 !==
      0
  )
    throw new Error("ISBN-10/13 형식과 체크디지트를 확인하세요.");
  return value;
}
