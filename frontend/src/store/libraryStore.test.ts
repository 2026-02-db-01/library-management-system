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

beforeEach(async () => {
  await s().setCurrentUser(null);
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
    await s().syncState();
    const res = await s().checkout(1001, 5001, 2001);
    expect(res.ok).toBe(true);
    expect(res.loanId).toBe(9901);
  });

  it("keeps state and reports server conflict without fabricating a rollback", async () => {
    await s().syncState();
    s().clearDbFlowEvents();
    const loans = s().loans;
    const res = await s().returnLoan(9001, 2001);
    expect(res.ok).toBe(false);
    expect(res.message).toBe("반납 충돌");
    expect(s().loans).toEqual(loans);
    expect(s().dbFlowEvents).toEqual([]);
  });
});

describe("pending mutation requests", () => {
  function interceptLoans(respond: (path: string, body: Record<string, unknown>) => Promise<unknown>) {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path.startsWith("/api/v1/loans/")) {
        return respond(path, JSON.parse(String(init?.body)));
      }
      return originalFetch(input, init);
    }));
  }

  const accepted = () => Promise.resolve(mockJsonResponse({ ok: true, message: "?? ??" }));

  it("retry reuses request ID after lost response", async () => {
    await s().syncState();
    const committed = new Set<unknown>();
    const ids: unknown[] = [];
    interceptLoans((_path, body) => {
      ids.push(body.requestId);
      if (committed.has(body.requestId)) return accepted();
      committed.add(body.requestId);
      return Promise.reject(new TypeError("Network response was lost"));
    });
    expect(await s().checkout(1001, 5001, 2001)).toMatchObject({ ok: false, retryable: true });
    expect(ids).toHaveLength(1);
    expect((await s().checkout(1001, 5001, 2001)).ok).toBe(true);
    expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/i);
    expect(ids).toEqual([ids[0], ids[0]]);
    expect(committed.size).toBe(1);
  });

  it("successful mutation clears pending request ID", async () => {
    await s().syncState();
    const ids: unknown[] = [];
    interceptLoans((_path, body) => {
      ids.push(body.requestId);
      return accepted();
    });
    expect((await s().checkout(1001, 5001, 2001)).ok).toBe(true);
    expect((await s().checkout(1001, 5001, 2001)).ok).toBe(true);
    expect(ids).toHaveLength(2);
    expect(ids[1]).not.toBe(ids[0]);
  });

  it("changed mutation payload gets new request ID", async () => {
    await s().syncState();
    const ids: unknown[] = [];
    interceptLoans((_path, body) => {
      ids.push(body.requestId);
      return Promise.resolve(mockJsonResponse({}, 503));
    });
    await s().checkout(1001, 5001, 2001);
    await s().checkout(1001, 5002, 2001);
    await s().checkout(1002, 5001, 2001);
    await s().checkout(1001, 5001, 2001);
    expect(new Set(ids.slice(0, 3)).size).toBe(3);
    expect(ids[3]).toBe(ids[0]);
  });

  it("session change clears pending requests and isolates late responses", async () => {
    await s().syncState();
    const ids: unknown[] = [];
    let completeOld: ((value: unknown) => void) | undefined;
    interceptLoans((_path, body) => {
      ids.push(body.requestId);
      if (ids.length === 1) {
        return new Promise((resolve) => { completeOld = resolve; });
      }
      if (ids.length === 2) return Promise.reject(new Error("Offline"));
      return accepted();
    });
    const oldRequest = s().checkout(1001, 5001, 2001);
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
      String(input).endsWith("/auth/me")
        ? Promise.resolve(mockJsonResponse({ ...s().currentUser, userId: 2002 }))
        : originalFetch(input, init)
    ));
    await s().syncState();
    expect(s().currentUser?.userId).toBe(2002);
    await s().checkout(1001, 5001, 2002);
    completeOld?.(mockJsonResponse({ ok: true, message: "old", dbFlowEvents: [{ id: "old" }] }));
    expect((await oldRequest).ok).toBe(false);
    expect(s().dbFlowEvents).toEqual([]);
    expect((await s().checkout(1001, 5001, 2002)).ok).toBe(true);
    expect(ids[1]).not.toBe(ids[0]);
    expect(ids[2]).toBe(ids[1]);
  });

  it("return renewal correction honor request IDs", async () => {
    await s().syncState();
    const ids = new Map<string, unknown[]>();
    interceptLoans((path, body) => {
      const attempts = [...(ids.get(path) ?? []), body.requestId];
      ids.set(path, attempts);
      if (attempts.length === 1) return Promise.resolve(mockJsonResponse({}, 408));
      if (attempts.length === 2) return Promise.resolve(mockJsonResponse({ message: "conflict" }, 409));
      return accepted();
    });
    const operations = [
      () => s().returnLoan(9001, 2001, { damaged: true, reason: "QA" }),
      () => s().renewLoan(9001, 1001),
      () => s().correctLoan(9001, { type: "UNDO_RETURN", reason: "QA", physicalConfirmed: true }),
    ];
    for (const operation of operations) {
      expect(await operation()).toMatchObject({ ok: false, retryable: true });
      expect(await operation()).toMatchObject({ ok: false, message: "conflict" });
      expect((await operation()).ok).toBe(true);
    }
    expect(ids.size).toBe(3);
    for (const attempts of ids.values()) {
      expect(attempts).toHaveLength(3);
      expect(attempts[1]).toBe(attempts[0]);
      expect(attempts[2]).not.toBe(attempts[0]);
    }
  });

  it("session expiration clears protected data", async () => {
    await s().syncState();
    expect(s().books.length).toBeGreaterThan(0);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockJsonResponse({}, 401)));
    await s().syncState();
    expect(s().currentUser).toBeNull();
    expect(s().hasLoadedData).toBe(false);
    expect(s().books).toEqual([]);
    expect(s().loans).toEqual([]);
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