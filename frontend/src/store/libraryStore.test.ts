import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  dataKeys,
  safeStorage,
  useLibraryStore as store,
} from "./libraryStore";
import { addDays, getKoreanDate } from "../data/mock/seed";
import {
  isActiveLoan,
  getAvailability,
  isBookVisible,
  normalizeIsbn,
  suspensionUntil,
} from "../services/library";
import {
  tableMetadata,
  dictionary,
  tableOrder,
  relationships,
} from "../data/metadata/schema";
import { getPreviewRows } from "../services/tablePreview";
const s = () => store.getState();
const role = (role: "MEMBER" | "LIBRARIAN" | "ADMIN") =>
  s().requestRoleSwitch(role, "/");
const state = () =>
  JSON.stringify(Object.fromEntries(dataKeys.map((k) => [k, s()[k]])));
beforeEach(() => {
  vi.useRealTimers();
  s().resetDemo();
  role("LIBRARIAN");
});
describe("Wiki V2 transaction invariants", () => {
  it("allows five books but rejects sixth, excluding cancelled rows", () => {
    store.setState({ loans: [], renewals: [] });
    for (const copy of s().copies.slice(0, 5))
      expect(s().checkout(1001, copy.copyId, 2001).ok).toBe(true);
    const before = state();
    expect(s().checkout(1001, 5006, 2001).ok).toBe(false);
    expect(state()).toBe(before);
  });
  it("serializes two competing checkout attempts in the single Mock store", () => {
    store.setState({ loans: [] });
    expect(s().checkout(1001, 5001, 2001).ok).toBe(true);
    expect(s().checkout(1003, 5001, 2001).ok).toBe(false);
    expect(
      s().loans.filter((l) => l.copyId === 5001 && isActiveLoan(l)),
    ).toHaveLength(1);
  });
  it("rejects duplicate return; same request ID replays exactly once", () => {
    const requestId = crypto.randomUUID();
    expect(s().returnLoan(9001, 2001, { requestId }).ok).toBe(true);
    expect(s().returnLoan(9001, 2001, { requestId }).ok).toBe(true);
    expect(s().requests).toHaveLength(1);
    expect(s().returnLoan(9001, 2001).ok).toBe(false);
    expect(
      s().returnLoan(9001, 2001, { requestId, damaged: true, reason: "파손" })
        .ok,
    ).toBe(false);
  });
  it("rejects same checkout ID for another patron or copy", () => {
    store.setState({ loans: [] });
    const requestId = crypto.randomUUID();
    expect(s().checkout(1001, 5001, 2001, { requestId }).ok).toBe(true);
    expect(s().checkout(1003, 5001, 2001, { requestId }).ok).toBe(false);
    expect(s().checkout(1001, 5002, 2001, { requestId }).ok).toBe(false);
  });
  it("blocks borrowing and every renewal when any loan is overdue", () => {
    expect(s().checkout(1002, 5002, 2001).ok).toBe(false);
    const loan = {
      ...s().loans[0],
      loanId: 9999,
      copyId: 5002,
      memberUserId: 1002,
    };
    store.setState({ loans: [...s().loans, loan] });
    role("MEMBER");
    s().setDemoMember(1002);
    expect(s().renewLoan(9999, 1002).ok).toBe(false);
  });
  it("renews from due date exactly seven days, at most once", () => {
    role("MEMBER");
    const before = s().loans.find((l) => l.loanId === 9001)!.currentDueDate;
    expect(s().renewLoan(9001, 1001).ok).toBe(true);
    expect(s().loans.find((l) => l.loanId === 9001)!.currentDueDate).toBe(
      addDays(before, 7),
    );
    expect(s().renewLoan(9001, 1001).ok).toBe(false);
  });
  it("rolls back a renewal, return and correction if history storage fails", () => {
    role("MEMBER");
    let before = state();
    expect(s().renewLoan(9001, 1001, true).ok).toBe(false);
    expect(state()).toBe(before);
    role("LIBRARIAN");
    before = state();
    expect(s().returnLoan(9001, 2001, { simulateFailure: true }).ok).toBe(
      false,
    );
    expect(state()).toBe(before);
    expect(
      s().correctLoan(
        9001,
        { type: "CANCEL_LOAN", reason: "입력 오류", physicalConfirmed: true },
        { simulateFailure: true },
      ).ok,
    ).toBe(false);
    expect(state()).toBe(before);
  });
  it("uses KST overdue calendar dates, exact 24 hours and the maximum suspension", () => {
    const loan = {
      ...s().loans[0],
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
  });
  it("allows renewal while only post-return suspension remains", () => {
    const returned = {
      ...s().loans[0],
      loanId: 8888,
      copyId: 5002,
      currentDueDate: addDays(getKoreanDate(), -3),
      returnedAt: new Date().toISOString(),
      returnedByUserId: 2001,
    };
    store.setState({ loans: [s().loans[0], returned] });
    expect(s().checkout(1001, 5003, 2001).ok).toBe(false);
    role("MEMBER");
    expect(s().renewLoan(9001, 1001).ok).toBe(true);
  });
  it("requires physical confirmation for cancellation and releases the copy", () => {
    expect(
      s().correctLoan(9001, { type: "CANCEL_LOAN", reason: "오류" }).ok,
    ).toBe(false);
    expect(
      s().correctLoan(9001, {
        type: "CANCEL_LOAN",
        reason: "오류",
        physicalConfirmed: true,
      }).ok,
    ).toBe(true);
    expect(s().checkout(1001, 5001, 2001).ok).toBe(true);
    expect(s().corrections).toHaveLength(1);
  });
  it("rejects undo return after a later checkout even if returned", () => {
    const original = s().loans.find((l) => l.loanId === 8995)!;
    const later = {
      ...original,
      loanId: 9999,
      memberUserId: 1003,
      borrowedAt:
        addDays(original.returnedAt!.slice(0, 10), 1) + "T02:00:00.000Z",
      returnedAt: new Date().toISOString(),
    };
    store.setState({ loans: [...s().loans, later] });
    expect(
      s().correctLoan(8995, { type: "UNDO_RETURN", reason: "오반납" }).ok,
    ).toBe(false);
  });
  it("withdraws without retaining a patron link and cannot undo their return", () => {
    role("MEMBER");
    s().setDemoMember(1003);
    expect(s().withdrawMember(1003).ok).toBe(true);
    const user = s().users.find((u) => u.userId === 1003)!;
    expect([
      user.loginId,
      user.fullName,
      user.contact,
      user.borrowingSuspendedUntil,
    ]).toEqual([null, null, null, null]);
    expect(s().loans.some((l) => l.memberUserId === 1003)).toBe(false);
    role("LIBRARIAN");
    expect(
      s().correctLoan(8998, { type: "UNDO_RETURN", reason: "오반납" }).ok,
    ).toBe(false);
    expect(
      s().addMember({
        loginId: "seoyun.l",
        fullName: "새 계정",
        contact: "01099999999",
      }).ok,
    ).toBe(false);
  });
  it("preserves all data on failed withdrawal, disallows withdrawal with open loans", () => {
    role("MEMBER");
    expect(s().withdrawMember(1001).ok).toBe(false);
    s().setDemoMember(1003);
    const before = state();
    expect(s().withdrawMember(1003, true).ok).toBe(false);
    expect(state()).toBe(before);
  });
  it("makes retirement final and records no partial history on failure", () => {
    const before = state();
    expect(s().changeCopyStatus(5002, "RETIRED", "노후", true).ok).toBe(false);
    expect(state()).toBe(before);
    expect(s().changeCopyStatus(5002, "RETIRED", "노후").ok).toBe(true);
    expect(s().changeCopyStatus(5002, "ACTIVE", "복원").ok).toBe(false);
  });
  it("protects last admin, fixed roles and other users profiles", () => {
    role("ADMIN");
    expect(s().setUserStatus(3001, "시험").ok).toBe(false);
    expect(s().setUserRole(2001, "ADMIN").ok).toBe(false);
    expect(
      s().updateProfile(1001, { fullName: "다른 이름", contact: "01088888888" })
        .ok,
    ).toBe(false);
    expect(s().setUserStatus(1001, "시험").ok).toBe(false);
    expect(s().setUserStatus(2001, "휴직").ok).toBe(true);
    expect(s().staffHistory.at(-1)?.actionType).toBe("DEACTIVATE");
  });
  it("checks contact uniqueness only among active members and preserves inactive login IDs", () => {
    expect(
      s().addMember({
        loginId: "test",
        fullName: "테스트",
        contact: s().users[0].contact!,
      }).ok,
    ).toBe(false);
    role("ADMIN");
    expect(
      s().addStaff({
        loginId: "staff.test",
        fullName: "직원",
        contact: s().users[0].contact!,
        role: "LIBRARIAN",
      }).ok,
    ).toBe(true);
    s().setUserStatus(2001, "휴직");
    expect(
      s().addStaff({
        loginId: "librarian.seo",
        fullName: "직원",
        contact: "01088888888",
        role: "LIBRARIAN",
      }).ok,
    ).toBe(false);
  });
  it("normalizes ISBN and permits multiple absent ISBNs", () => {
    expect(normalizeIsbn("0-13-235088-2")).toBe("9780132350884");
    expect(() => normalizeIsbn("9780132350885")).toThrow();
    for (const title of ["무ISBN 도서1", "무ISBN 도서2"])
      expect(
        s().saveBook({
          isbn: "",
          title,
          publisher: "",
          publicationYear: "",
          authorNames: "한강",
          categoryCode: "DEMO_GENERAL",
        }).ok,
      ).toBe(true);
  });
  it("rejects unauthorized business mutations", () => {
    role("ADMIN");
    expect(s().checkout(1001, 5002, 2001).ok).toBe(false);
    expect(s().addAuthor("테스트").ok).toBe(false);
    expect(s().changeCopyStatus(5002, "DAMAGED", "파손").ok).toBe(false);
  });
});
describe("metadata and privacy", () => {
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
  it("refuses patron identity in persistent reasons and fingerprints", () => {
    const before = state();
    expect(
      s().correctLoan(9001, {
        type: "CANCEL_LOAN",
        reason: "김하늘 입력 오류",
        physicalConfirmed: true,
      }).ok,
    ).toBe(false);
    expect(s().changeCopyStatus(5002, "DAMAGED", "010-1234-5678 파손").ok).toBe(
      false,
    );
    expect(state()).toBe(before);
  });
  it("enforces the fifth-loan boundary on undo return", () => {
    const old = s().loans.find((l) => l.loanId === 8995)!;
    const loans = s()
      .copies.filter((c) => c.copyId !== old.copyId)
      .slice(0, 5)
      .map((c, i) => ({ ...s().loans[0], loanId: 9900 + i, copyId: c.copyId }));
    store.setState({ loans: [old, ...loans] });
    expect(
      s().correctLoan(old.loanId, { type: "UNDO_RETURN", reason: "오반납" }).ok,
    ).toBe(false);
  });
  it("allows undo after cancelled follow-up, preserving damaged state", () => {
    const old = s().loans.find((l) => l.loanId === 8995)!;
    store.setState({
      loans: [
        old,
        {
          ...old,
          loanId: 9999,
          isCancelled: true,
          cancelledAt: new Date().toISOString(),
          borrowedAt: new Date().toISOString(),
        },
      ],
    });
    expect(s().changeCopyStatus(old.copyId, "DAMAGED", "파손 확인").ok).toBe(
      true,
    );
    expect(
      s().correctLoan(old.loanId, { type: "UNDO_RETURN", reason: "오반납" }).ok,
    ).toBe(true);
    expect(
      s().copies.find((c) => c.copyId === old.copyId)?.managementStatus,
    ).toBe("DAMAGED");
  });
  it("keeps at least one admin across sequential competing deactivations", () => {
    role("ADMIN");
    expect(
      s().addStaff({
        loginId: "admin.two",
        fullName: "직원",
        contact: "01088888888",
        role: "ADMIN",
      }).ok,
    ).toBe(true);
    const second = s().users.at(-1)!.userId;
    expect(s().setUserStatus(second, "휴직").ok).toBe(true);
    expect(s().setUserStatus(3001, "휴직").ok).toBe(false);
  });
  it("derives availability and search eligibility from copy states", () => {
    const bookId = s().books[0].bookId;
    expect(
      s().saveBook({
        isbn: "",
        title: "소장본 없는 도서",
        publisher: "",
        publicationYear: "",
        authorNames: "한강",
        categoryCode: "DEMO_GENERAL",
      }).ok,
    ).toBe(true);
    const id = s().books.at(-1)!.bookId;
    expect(isBookVisible(id, s())).toBe(false);
    store.setState({ loans: [] });
    for (const copy of s().copies.filter((c) => c.bookId === bookId))
      expect(s().changeCopyStatus(copy.copyId, "DAMAGED", "파손").ok).toBe(
        true,
      );
    expect(isBookVisible(bookId, s())).toBe(true);
    expect(getAvailability(bookId, s()).available).toBe(0);
    for (const copy of s().copies.filter((c) => c.bookId === bookId))
      expect(s().changeCopyStatus(copy.copyId, "RETIRED", "노후").ok).toBe(
        true,
      );
    expect(isBookVisible(bookId, s())).toBe(false);
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
    const text = JSON.stringify(
      tableOrder.flatMap((t) => getPreviewRows(t, s())),
    );
    for (const user of s().users) {
      expect(text).not.toContain(user.contact);
      expect(text).not.toContain(user.loginId);
      expect(text).not.toContain(user.fullName);
    }
    expect(
      getPreviewRows("loan", s()).every((r) => r.member_user_id === null),
    ).toBe(true);
  });
  it("ignores old and corrupt persisted data", () => {
    const storage = {
      getItem: vi.fn(() => "{invalid"),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    vi.stubGlobal("localStorage", storage);
    expect(safeStorage.getItem("x")).toBeNull();
    storage.getItem.mockReturnValue(JSON.stringify({ version: 1, state: {} }));
    expect(safeStorage.getItem("x")).toBeNull();
    vi.unstubAllGlobals();
  });
});
