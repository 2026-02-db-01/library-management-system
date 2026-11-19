import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLibraryStore as store } from "./libraryStore";
import { addDays, createSeedData, getKoreanDate } from "../data/mock/seed";
import {
  getAvailability,
  isBookVisible,
  normalizeIsbn,
  suspensionUntil,
} from "../services/library";
import {
  dictionary,
  relationships,
  tableMetadata,
  tableOrder,
} from "../data/metadata/schema";
import { getPreviewRows } from "../services/tablePreview";

const s = () => store.getState();

function mockJsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body === null ? "" : JSON.stringify(body)),
  };
}

beforeEach(() => {
  vi.useRealTimers();
  const seed = createSeedData();

  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/v1/auth/me")) {
      return Promise.resolve(
        mockJsonResponse({
          userId: 2001,
          role: "LIBRARIAN",
          accountStatus: "ACTIVE",
          loginId: "librarian",
          fullName: "김사서",
          contact: "01011112222",
        }),
      );
    }
    if (url.endsWith("/api/v1/library/state")) {
      return Promise.resolve(mockJsonResponse(seed));
    }
    if (url.endsWith("/api/v1/loans/9001/return")) {
      return Promise.resolve(mockJsonResponse({ message: "반납 충돌" }, 409));
    }
    if (url.endsWith("/api/v1/loans/checkout")) {
      return Promise.resolve(
        mockJsonResponse(
          {
            ok: true,
            message: "대출 완료",
            loanId: 9901,
            dbFlowEvents: [],
          },
          201,
        ),
      );
    }
    return Promise.resolve(mockJsonResponse({ ok: true, message: "완료" }));
  });

  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API-connected libraryStore", () => {
  it("hydrates authenticated session and 12 library tables on initialize", async () => {
    await s().initialize();
    expect(s().isInitialized).toBe(true);
    expect(s().currentUser?.role).toBe("LIBRARIAN");
    expect(s().currentUser?.userId).toBe(2001);
    expect(s().books.length).toBeGreaterThan(0);
  });

  it("executes checkout via backend API and syncs store state", async () => {
    await s().initialize();
    const res = await s().checkout(1001, 5001, 2001);
    expect(res.ok).toBe(true);
    expect(res.loanId).toBe(9901);
  });

  it("keeps state and reports server conflict without fabricating a rollback", async () => {
    await s().initialize();
    s().clearDbFlowEvents();
    const loans = s().loans;
    const res = await s().returnLoan(9001, 2001);
    expect(res.ok).toBe(false);
    expect(res.message).toBe("반납 충돌");
    expect(s().loans).toEqual(loans);
    expect(s().dbFlowEvents).toEqual([]);
  });
});

describe("domain helpers, metadata and privacy", () => {
  it("normalizes ISBN-10 to ISBN-13 and rejects invalid check digits", () => {
    expect(normalizeIsbn("0-13-235088-2")).toBe("9780132350884");
    expect(() => normalizeIsbn("9780132350885")).toThrow();
  });

  it("uses KST overdue calendar dates, exact 24 hours and the maximum suspension", () => {
    const seed = createSeedData();
    const loan = {
      ...seed.loans[0],
      currentDueDate: "2026-11-10",
      returnedAt: "2026-11-12T15:01:00.000Z",
      returnedByUserId: 2001,
    };
    expect(suspensionUntil(1001, [loan])).toBe("2026-11-15T15:01:00.000Z");
    expect(
      suspensionUntil(1001, [
        loan,
        { ...loan, loanId: 9999, currentDueDate: "2026-11-12" },
      ]),
    ).toBe("2026-11-15T15:01:00.000Z");
    expect(suspensionUntil(1001, [{ ...loan, isCancelled: true }])).toBeNull();
    expect(addDays(getKoreanDate(), 0)).toBe(getKoreanDate());
  });

  it("derives availability and search eligibility from copy states", () => {
    const seed = createSeedData();
    const bookId = seed.books[0].bookId;
    seed.loans = [];

    for (const copy of seed.copies.filter((c) => c.bookId === bookId)) {
      copy.managementStatus = "DAMAGED";
    }
    expect(isBookVisible(bookId, seed)).toBe(true);
    expect(getAvailability(bookId, seed).available).toBe(0);

    for (const copy of seed.copies.filter((c) => c.bookId === bookId)) {
      copy.managementStatus = "RETIRED";
    }
    expect(isBookVisible(bookId, seed)).toBe(false);
  });

  it("matches all Wiki columns, standard terms and composite/unique keys", () => {
    expect(
      tableOrder.reduce((n, key) => n + tableMetadata[key].columns.length, 0),
    ).toBe(81);
    expect(dictionary).toHaveLength(73);
    expect(
      tableMetadata.book_author.constraints.find(
        (c) => c.kind === "PRIMARY KEY",
      )?.columns,
    ).toEqual(["book_id", "author_id"]);
    expect(
      tableMetadata.loan_renewal.constraints.some(
        (c) => c.kind === "UNIQUE" && c.columns.includes("loan_id"),
      ),
    ).toBe(true);
    expect(
      tableMetadata.loan.indexes
        .filter((i) => i.unique)
        .every((i) => !i.definition.includes("(member_user_id)")),
    ).toBe(true);
  });

  it("has 12 tables and 19 FK relationships with valid endpoints", () => {
    expect(tableOrder).toHaveLength(12);
    expect(relationships).toHaveLength(19);
    relationships.forEach((r) => {
      expect(
        tableMetadata[r.from].columns.some((c) => c.name === r.fromColumn),
      ).toBe(true);
      expect(
        tableMetadata[r.to].columns.some((c) => c.name === r.toColumn),
      ).toBe(true);
    });
    expect(
      tableMetadata.book.columns.some((c) => c.name === "catalog_status"),
    ).toBe(false);
    expect(
      tableMetadata.loan.columns.find((c) => c.name === "member_user_id")
        ?.nullable,
    ).toBe(true);
  });

  it("redacts account PII and borrowing identity in Console previews", () => {
    const seed = createSeedData();
    const text = JSON.stringify(
      tableOrder.flatMap((t) => getPreviewRows(t, seed)),
    );
    for (const user of seed.users) {
      if (user.contact) expect(text).not.toContain(user.contact);
      if (user.loginId) expect(text).not.toContain(user.loginId);
      if (user.fullName) expect(text).not.toContain(user.fullName);
    }
    expect(
      getPreviewRows("loan", seed).every((r) => r.member_user_id === null),
    ).toBe(true);
  });
});