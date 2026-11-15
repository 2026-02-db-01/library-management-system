import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { addDays, createSeedData, getKoreanDate } from "../data/mock/seed";
import {
  canRenew,
  isActiveLoan,
  isOverdue,
  normalizeIsbn,
  suspensionUntil,
} from "../services/library";
import type {
  BookFormValues,
  CorrectionType,
  DbFlowEvent,
  DbFlowEventDraft,
  LibraryData,
  Loan,
  RecordStatus,
  Snapshot,
  UserRole,
} from "../types/domain";

export interface ActionResult {
  ok: boolean;
  message: string;
  loanId?: number;
}
export interface RequestOptions {
  requestId?: string;
  simulateFailure?: boolean;
}
export interface CorrectionInput {
  type: CorrectionType;
  reason: string;
  evidence?: string;
  value?: string;
  physicalConfirmed?: boolean;
}
interface LibraryStore extends LibraryData {
  demoRole: UserRole | null;
  roleSwitchTarget: string | null;
  demoMemberId: number;
  demoLibrarianId: number;
  demoAdminId: number;
  dbFlowEvents: DbFlowEvent[];
  requestRoleSwitch: (role: UserRole, target: string) => void;
  completeRoleSwitch: () => void;
  setDemoMember: (id: number) => void;
  setDemoLibrarian: (id: number) => void;
  setDemoAdmin: (id: number) => void;
  recordDbFlowEvents: (events: DbFlowEventDraft[]) => void;
  clearDbFlowEvents: () => void;
  checkout: (
    member: number,
    copy: number,
    staff: number,
    options?: RequestOptions,
  ) => ActionResult;
  returnLoan: (
    loan: number,
    staff: number,
    options?: RequestOptions & { damaged?: boolean; reason?: string },
  ) => ActionResult;
  renewLoan: (
    loan: number,
    member: number,
    failure?: boolean,
    options?: RequestOptions,
  ) => ActionResult;
  correctLoan: (
    loan: number,
    input: CorrectionInput,
    options?: RequestOptions,
  ) => ActionResult;
  setUserStatus: (id: number, reason?: string) => ActionResult;
  setUserRole: (id: number, role: UserRole) => ActionResult;
  addAuthor: (name: string) => ActionResult;
  renameAuthor: (id: number, name: string) => ActionResult;
  addMember: (v: AccountInput) => ActionResult;
  addStaff: (v: AccountInput & { role: "LIBRARIAN" | "ADMIN" }) => ActionResult;
  updateProfile: (
    id: number,
    v: { fullName: string; contact: string },
  ) => ActionResult;
  withdrawMember: (id: number, failure?: boolean) => ActionResult;
  saveBook: (v: BookFormValues, id?: number) => ActionResult;
  addCopy: (bookId: number, ignoredCode?: string) => ActionResult;
  changeCopyStatus: (
    id: number,
    status: RecordStatus,
    reason: string,
    failure?: boolean,
  ) => ActionResult;
  toggleCopyStatus: (id: number) => ActionResult;
  setBookStatus: (id: number) => ActionResult;
  resetDemo: () => void;
}
interface AccountInput {
  loginId: string;
  fullName: string;
  contact: string;
}
const ok = (message: string, loanId?: number): ActionResult => ({
  ok: true,
  message,
  loanId,
});
const fail = (message: string): ActionResult => ({ ok: false, message });
const nextId = (rows: object[], key: string) =>
  Math.max(0, ...rows.map((r) => Number((r as Record<string, unknown>)[key]))) +
  1;
const now = () => new Date().toISOString();
export const dataKeys = [
  "users",
  "books",
  "authors",
  "bookAuthors",
  "copies",
  "loans",
  "renewals",
  "staffHistory",
  "bookHistory",
  "copyHistory",
  "corrections",
  "requests",
] as const;
function dataOf(s: LibraryData): LibraryData {
  return Object.fromEntries(
    dataKeys.map((k) => [k, structuredClone(s[k])]),
  ) as unknown as LibraryData;
}
function snapshot(l?: Loan): Snapshot {
  return l
    ? {
        returned_at: l.returnedAt,
        returned_by_user_id: l.returnedByUserId,
        current_due_date: l.currentDueDate,
        is_cancelled: l.isCancelled,
        cancelled_at: l.cancelledAt,
      }
    : {};
}
function recalculate(d: LibraryData) {
  d.users.forEach((u) => {
    u.borrowingSuspendedUntil =
      u.role === "MEMBER" && u.accountStatus === "ACTIVE"
        ? suspensionUntil(u.userId, d.loans)
        : null;
  });
}
function initial() {
  const d = createSeedData();
  recalculate(d);
  return {
    ...d,
    demoRole: null,
    roleSwitchTarget: null,
    demoMemberId: 1001,
    demoLibrarianId: 2001,
    demoAdminId: 3001,
    dbFlowEvents: [],
  };
}
function actor(s: LibraryStore, role: UserRole, id?: number) {
  const selected =
    role === "MEMBER"
      ? s.demoMemberId
      : role === "LIBRARIAN"
        ? s.demoLibrarianId
        : s.demoAdminId;
  return (
    s.demoRole === role &&
    (id === undefined || id === selected) &&
    s.users.some(
      (u) =>
        u.userId === selected &&
        u.role === role &&
        u.accountStatus === "ACTIVE",
    )
  );
}
function account(
  d: LibraryData,
  v: { loginId?: string; fullName: string; contact: string },
  role: UserRole,
  id?: number,
) {
  const contact = v.contact.replace(/[\s-]/g, "");
  if (
    !v.fullName.trim() ||
    v.fullName.length > 100 ||
    !/^\d{10,11}$/.test(contact)
  )
    throw Error("이름(1~100자)과 연락처(숫자 10~11자리)를 확인하세요.");
  if (
    role === "MEMBER" &&
    d.users.some(
      (u) =>
        u.userId !== id &&
        u.role === "MEMBER" &&
        u.accountStatus === "ACTIVE" &&
        u.contact === contact,
    )
  )
    throw Error("활성 회원이 사용 중인 연락처입니다.");
  if (
    v.loginId !== undefined &&
    (!v.loginId.trim() ||
      v.loginId.length > 50 ||
      d.users.some((u) => u.userId !== id && u.loginId === v.loginId!.trim()))
  )
    throw Error("로그인 ID 길이(1~50자) 또는 중복을 확인하세요.");
  return contact;
}

function containsPatronIdentity(text: string, users: LibraryData["users"]) {
  return (
    /0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}/.test(text) ||
    users.some(
      (u) =>
        u.role === "MEMBER" &&
        [u.fullName, u.loginId, u.contact, String(u.userId)].some(
          (value) => value !== null && value.length > 2 && text.includes(value),
        ),
    )
  );
}
export const safeStorage = {
  getItem: (key: string) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const v = JSON.parse(raw);
      const valid =
        v.version === 2 &&
        dataKeys.every(
          (k) =>
            Array.isArray(v.state?.[k]) &&
            v.state[k].every(
              (row: unknown) => row !== null && typeof row === "object",
            ),
        ) &&
        v.state.users.every(
          (u: Record<string, unknown>) =>
            Number.isSafeInteger(u.userId) &&
            ["MEMBER", "LIBRARIAN", "ADMIN"].includes(String(u.role)) &&
            ["ACTIVE", "INACTIVE", "WITHDRAWN"].includes(
              String(u.accountStatus),
            ),
        ) &&
        v.state.books.every(
          (b: Record<string, unknown>) =>
            typeof b.title === "string" && typeof b.categoryCode === "string",
        ) &&
        v.state.loans.every(
          (l: Record<string, unknown>) =>
            typeof l.isCancelled === "boolean" &&
            typeof l.currentDueDate === "string",
        );
      return valid ? raw : null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* memory-only fallback */
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* unavailable */
    }
  },
};
export const useLibraryStore = create<LibraryStore>()(
  persist(
    (set, get) => {
      function commit(
        work: (d: LibraryData, s: LibraryStore) => ActionResult,
        failure = false,
        extra: Partial<LibraryStore> = {},
      ): ActionResult {
        try {
          const s = get(),
            d = dataOf(s),
            result = work(d, s);
          if (!result.ok) return result;
          if (failure)
            throw Error(
              "오류 시연: 이력 저장 실패. 전체 Mock 변경을 롤백했습니다.",
            );
          recalculate(d);
          set({ ...d, ...extra });
          return result;
        } catch (e) {
          return fail(e instanceof Error ? e.message : "처리 실패");
        }
      }
      function transaction(
        operation: LibraryData["requests"][number]["operationType"],
        target: number | null,
        options: RequestOptions,
        payload: object,
        work: (d: LibraryData, s: LibraryStore) => ActionResult,
      ): ActionResult {
        const s = get(),
          id = options.requestId ?? crypto.randomUUID();
        if (
          Object.values(payload).some(
            (value) =>
              typeof value === "string" &&
              containsPatronIdentity(value, s.users),
          )
        )
          return fail(
            "사유·증빙에는 회원 이름·ID·연락처를 넣을 수 없습니다. 비식별 업무 사실만 입력하세요.",
          );
        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            id,
          )
        )
          return fail("요청 ID는 UUID여야 합니다.");
        const fingerprint = bytesToHex(
          sha256(
            new TextEncoder().encode(
              JSON.stringify({ operation, target, ...payload }),
            ),
          ),
        );
        const actingId =
          s.demoRole === "MEMBER"
            ? s.demoMemberId
            : s.demoRole === "LIBRARIAN"
              ? s.demoLibrarianId
              : s.demoAdminId;
        if (!s.demoRole || !actor(s, s.demoRole))
          return fail("활성 데모 계정을 선택하세요.");
        const prior = s.requests.find((r) => r.requestId === id);
        if (prior) {
          if (
            prior.actorUserId !== actingId ||
            prior.requestFingerprint !== fingerprint
          )
            return fail("요청 ID 충돌: 요청자 또는 내용이 다릅니다.");
          return prior.processingStatus === "COMPLETED"
            ? ok(
                "완료된 동일 요청의 Mock 결과입니다.",
                prior.targetLoanId ?? undefined,
              )
            : fail("완료되지 않은 요청입니다. 다시 확인하세요.");
        }
        const result = commit((d, current) => {
          const r = work(d, current);
          if (r.ok)
            d.requests.push({
              requestId: id,
              operationType: operation,
              requestFingerprint: fingerprint,
              processingStatus: "COMPLETED",
              resultCode: "MOCK_OK",
              responseSnapshot: { ok: true },
              actorUserId: actingId,
              targetLoanId: r.loanId ?? target,
              requestedAt: now(),
              completedAt: now(),
            });
          return r;
        }, options.simulateFailure);
        get().recordDbFlowEvents([
          {
            operation: "SELECT",
            tableId: "loan",
            columnIds: ["is_cancelled", "returned_at", "current_due_date"],
            message: `${operation}: 현재 유효 상태·권한 검사 (Mock)`,
            status: "success",
          },
          {
            operation: operation === "CHECKOUT" ? "INSERT" : "UPDATE",
            tableId: "loan",
            message: `${operation}: ${result.message}`,
            status: result.ok ? "success" : "failed",
            before: snapshot(s.loans.find((l) => l.loanId === target)),
            after: snapshot(
              get().loans.find((l) => l.loanId === (result.loanId ?? target)),
            ),
          },
          ...(operation === "RENEW" || operation === "CORRECT"
            ? [
                {
                  operation: "INSERT" as const,
                  tableId:
                    operation === "RENEW"
                      ? "loan_renewal"
                      : "loan_correction_history",
                  relationId:
                    operation === "RENEW"
                      ? "loan-loan_renewal"
                      : "loan-loan_correction_history-loan_id",
                  message: `${operation === "RENEW" ? "연장" : "정정"} 이력 ${result.ok ? "저장" : "저장 취소"} (Mock)`,
                  status: result.ok
                    ? ("success" as const)
                    : ("failed" as const),
                },
              ]
            : []),
          ...(operation === "RETURN" && result.ok
            ? [
                {
                  operation: "UPDATE" as const,
                  tableId: "app_user",
                  columnIds: ["borrowing_suspended_until"],
                  message: "유효한 연체 반납 기준 정지 종료시각 재계산 (Mock)",
                  status: "success" as const,
                },
              ]
            : []),
          ...(result.ok
            ? [
                {
                  operation: "INSERT" as const,
                  tableId: "request_record",
                  message: "비식별 요청 결과 기록 (Mock)",
                  status: "success" as const,
                },
              ]
            : []),
          {
            operation: result.ok ? "COMMIT" : "ROLLBACK",
            message: result.message,
            status: result.ok ? "success" : "failed",
          },
        ]);
        return result;
      }
      return {
        ...initial(),
        requestRoleSwitch: (role, target) => {
          const state = get(),
            key =
              role === "MEMBER"
                ? "demoMemberId"
                : role === "LIBRARIAN"
                  ? "demoLibrarianId"
                  : "demoAdminId";
          const id =
            state.users.find(
              (u) =>
                u.userId === state[key] &&
                u.role === role &&
                u.accountStatus === "ACTIVE",
            )?.userId ??
            state.users.find(
              (u) => u.role === role && u.accountStatus === "ACTIVE",
            )?.userId ??
            0;
          set({ demoRole: role, roleSwitchTarget: target, [key]: id });
        },
        completeRoleSwitch: () => set({ roleSwitchTarget: null }),
        setDemoMember: (id) => set({ demoMemberId: id }),
        setDemoLibrarian: (id) => set({ demoLibrarianId: id }),
        setDemoAdmin: (id) => set({ demoAdminId: id }),
        recordDbFlowEvents: (events) => {
          const runId = crypto.randomUUID();
          set((s) => ({
            dbFlowEvents: [
              ...s.dbFlowEvents,
              ...events.map((e, i) => ({
                ...e,
                id: `${runId}-${i}`,
                runId,
                step: i + 1,
                createdAt: now(),
              })),
            ].slice(-150),
          }));
        },
        clearDbFlowEvents: () => set({ dbFlowEvents: [] }),
        checkout: (memberId, copyId, staffId, options = {}) => {
          if (!actor(get(), "LIBRARIAN", staffId))
            return fail("활성 사서만 대출할 수 있습니다.");
          const prior =
            options.requestId &&
            get().requests.find((r) => r.requestId === options.requestId);
          if (
            prior &&
            get().loans.find((l) => l.loanId === prior.targetLoanId)
              ?.memberUserId !== memberId
          )
            return fail("요청 ID 충돌: 대상 회원이 다릅니다.");
          return transaction("CHECKOUT", null, options, { copyId }, (d) => {
            const member = d.users.find(
                (u) =>
                  u.userId === memberId &&
                  u.role === "MEMBER" &&
                  u.accountStatus === "ACTIVE",
              ),
              active = d.loans.filter(isActiveLoan);
            if (!member) return fail("활성 회원을 선택하세요.");
            if (active.filter((l) => l.memberUserId === memberId).length >= 5)
              return fail("회원당 최대 5권입니다. 6번째 대출은 불가합니다.");
            if (active.some((l) => l.memberUserId === memberId && isOverdue(l)))
              return fail("현재 연체 중이므로 신규 대출이 불가합니다.");
            const until = suspensionUntil(memberId, d.loans);
            if (until && until > now())
              return fail(`신규 대출 정지 기간: ${until}`);
            const copy = d.copies.find((c) => c.copyId === copyId);
            if (
              !copy ||
              copy.managementStatus !== "ACTIVE" ||
              active.some((l) => l.copyId === copyId)
            )
              return fail("정상 상태의 미대출 소장본만 대출 가능합니다.");
            const loanId = nextId(d.loans, "loanId"),
              due = addDays(getKoreanDate(), 14);
            d.loans.unshift({
              loanId,
              memberUserId: memberId,
              copyId,
              checkedOutByUserId: staffId,
              borrowedAt: now(),
              initialDueDate: due,
              currentDueDate: due,
              returnedAt: null,
              returnedByUserId: null,
              isCancelled: false,
              cancelledAt: null,
            });
            return ok(`대출 완료 · 반납예정일 ${due}`, loanId);
          });
        },
        returnLoan: (loanId, staffId, options = {}) => {
          if (!actor(get(), "LIBRARIAN", staffId))
            return fail("활성 사서만 반납할 수 있습니다.");
          return transaction(
            "RETURN",
            loanId,
            options,
            { damaged: !!options.damaged, reason: options.reason ?? "" },
            (d) => {
              const loan = d.loans.find((l) => l.loanId === loanId);
              if (!loan || !isActiveLoan(loan))
                return fail("유효한 미반납 대출이 아닙니다. 중복 반납 불가.");
              loan.returnedAt = now();
              loan.returnedByUserId = staffId;
              if (options.damaged) {
                if (!options.reason?.trim())
                  return fail("파손 사유가 필요합니다.");
                const copy = d.copies.find((c) => c.copyId === loan.copyId)!;
                d.copyHistory.push({
                  copyStatusHistoryId: nextId(
                    d.copyHistory,
                    "copyStatusHistoryId",
                  ),
                  copyId: copy.copyId,
                  previousStatus: copy.managementStatus,
                  newStatus: "DAMAGED",
                  reason: options.reason.trim(),
                  changedByUserId: staffId,
                  relatedLoanId: loanId,
                  changedAt: now(),
                });
                copy.managementStatus = "DAMAGED";
              }
              return ok("반납 완료 · 신규 대출 정지를 재계산했습니다.", loanId);
            },
          );
        },
        renewLoan: (loanId, memberId, failure = false, options = {}) => {
          if (!actor(get(), "MEMBER", memberId))
            return fail("활성 회원 본인만 연장할 수 있습니다.");
          return transaction(
            "RENEW",
            loanId,
            { ...options, simulateFailure: failure || options.simulateFailure },
            {},
            (d) => {
              const loan = d.loans.find((l) => l.loanId === loanId);
              if (
                !loan ||
                loan.memberUserId !== memberId ||
                !canRenew(loan, d.renewals) ||
                d.loans.some((l) => l.memberUserId === memberId && isOverdue(l))
              )
                return fail(
                  "본인 대출·미반납·전체 비연체·연장 0회 조건을 확인하세요.",
                );
              const previous = loan.currentDueDate;
              loan.currentDueDate = addDays(previous, 7);
              d.renewals.push({
                renewalId: nextId(d.renewals, "renewalId"),
                loanId,
                renewedAt: now(),
                previousDueDate: previous,
                newDueDate: loan.currentDueDate,
              });
              return ok(`7일 연장 완료 · ${loan.currentDueDate}`, loanId);
            },
          );
        },
        correctLoan: (loanId, input, options = {}) => {
          if (!actor(get(), "LIBRARIAN"))
            return fail("활성 사서만 정정할 수 있습니다.");
          return transaction(
            "CORRECT",
            loanId,
            options,
            { ...input },
            (d, s) => {
              const loan = d.loans.find((l) => l.loanId === loanId);
              if (!loan || loan.isCancelled || !input.reason.trim())
                return fail("유효한 대출과 정정 사유가 필요합니다.");
              const before = snapshot(loan);
              if (input.type === "CANCEL_LOAN") {
                if (!input.physicalConfirmed)
                  return fail("실물 회수·미반출 확인 후 취소하세요.");
                loan.isCancelled = true;
                loan.cancelledAt = now();
              } else if (input.type === "UNDO_RETURN") {
                if (
                  !loan.returnedAt ||
                  !d.users.some(
                    (u) =>
                      u.userId === loan.memberUserId &&
                      u.role === "MEMBER" &&
                      u.accountStatus === "ACTIVE",
                  )
                )
                  return fail(
                    "탈퇴 회원 또는 미반납 건은 반납 취소할 수 없습니다.",
                  );
                if (
                  d.loans.some(
                    (l) =>
                      l.loanId !== loanId &&
                      l.copyId === loan.copyId &&
                      !l.isCancelled &&
                      l.borrowedAt >= loan.returnedAt!,
                  )
                )
                  return fail(
                    "반납 이후 유효한 재대출 이력이 있어 복원할 수 없습니다.",
                  );
                if (
                  d.loans.filter(
                    (l) =>
                      l.memberUserId === loan.memberUserId && isActiveLoan(l),
                  ).length >= 5 ||
                  d.loans.some(
                    (l) => l.copyId === loan.copyId && isActiveLoan(l),
                  )
                )
                  return fail(
                    "복원 시 5권 한도 또는 소장본 점유가 충돌합니다.",
                  );
                loan.returnedAt = null;
                loan.returnedByUserId = null;
              } else
                return fail(
                  "날짜 정정은 Wiki 세부 운영·증빙 정책 확정 전까지 제한합니다. 원본을 유지합니다.",
                );
              d.corrections.push({
                correctionId: nextId(d.corrections, "correctionId"),
                loanId,
                correctionType: input.type,
                beforeValues: before,
                afterValues: snapshot(loan),
                reason: input.reason.trim(),
                evidenceReference: input.evidence?.trim() || null,
                correctedByUserId: s.demoLibrarianId,
                correctedAt: now(),
              });
              return ok("정정 완료 · 변경 전후 이력을 보존했습니다.", loanId);
            },
          );
        },
        setUserStatus: (id, reason = "") =>
          commit((d, s) => {
            if (!actor(s, "ADMIN"))
              return fail("활성 관리자만 직원 상태를 변경할 수 있습니다.");
            const u = d.users.find((u) => u.userId === id);
            if (!u || u.role === "MEMBER" || u.accountStatus === "WITHDRAWN")
              return fail("직원 계정만 상태 변경할 수 있습니다.");
            if (!reason.trim()) return fail("상태 변경 사유를 입력하세요.");
            if (containsPatronIdentity(reason, s.users))
              return fail("변경 사유에 회원 개인정보를 입력할 수 없습니다.");
            if (
              u.role === "ADMIN" &&
              u.accountStatus === "ACTIVE" &&
              d.users.filter(
                (u) => u.role === "ADMIN" && u.accountStatus === "ACTIVE",
              ).length <= 1
            )
              return fail("마지막 활성 관리자는 비활성화할 수 없습니다.");
            const previous = u.accountStatus;
            u.accountStatus = previous === "ACTIVE" ? "INACTIVE" : "ACTIVE";
            d.staffHistory.push({
              staffHistoryId: nextId(d.staffHistory, "staffHistoryId"),
              targetStaffUserId: id,
              actionType:
                u.accountStatus === "ACTIVE" ? "REACTIVATE" : "DEACTIVATE",
              previousStatus: previous,
              newStatus: u.accountStatus,
              roleAtCreation: null,
              reason: reason.trim(),
              processedByAdminUserId: s.demoAdminId,
              processedAt: now(),
            });
            return ok("직원 상태와 변경 이력을 저장했습니다.");
          }),
        setUserRole: () => fail("생성된 계정의 역할은 변경할 수 없습니다."),
        addMember: (v) =>
          commit((d) => {
            if (d.users.some((u) => u.accountStatus === "WITHDRAWN"))
              return fail(
                "탈퇴 전 로그인 ID 재사용 정책이 미확정이므로 이 데모에서 재가입을 제한합니다.",
              );
            const contact = account(d, v, "MEMBER");
            d.users.push({
              userId: nextId(d.users, "userId"),
              loginId: v.loginId.trim(),
              fullName: v.fullName.trim(),
              contact,
              role: "MEMBER",
              accountStatus: "ACTIVE",
              borrowingSuspendedUntil: null,
              createdAt: now(),
            });
            return ok(
              "회원가입 데모 완료. 실제 인증 계정은 생성하지 않습니다.",
            );
          }),
        addStaff: (v) =>
          commit((d, s) => {
            if (!actor(s, "ADMIN") || !["LIBRARIAN", "ADMIN"].includes(v.role))
              return fail("활성 관리자만 직원 계정을 생성할 수 있습니다.");
            const contact = account(d, v, v.role),
              id = nextId(d.users, "userId");
            d.users.push({
              userId: id,
              loginId: v.loginId.trim(),
              fullName: v.fullName.trim(),
              contact,
              role: v.role,
              accountStatus: "ACTIVE",
              borrowingSuspendedUntil: null,
              createdAt: now(),
            });
            d.staffHistory.push({
              staffHistoryId: nextId(d.staffHistory, "staffHistoryId"),
              targetStaffUserId: id,
              actionType: "CREATE",
              previousStatus: null,
              newStatus: "ACTIVE",
              roleAtCreation: v.role,
              reason: null,
              processedByAdminUserId: s.demoAdminId,
              processedAt: now(),
            });
            return ok("직원 데모 생성 완료. 초기 인증 설정은 미확정입니다.");
          }),
        updateProfile: (id, v) =>
          commit((d, s) => {
            if (!s.demoRole || !actor(s, s.demoRole, id))
              return fail("본인 계정만 수정할 수 있습니다.");
            const u = d.users.find((u) => u.userId === id)!;
            u.contact = account(d, v, u.role, id);
            u.fullName = v.fullName.trim();
            return ok(
              "본인 정보를 수정했습니다. 이전 개인정보는 저장하지 않습니다.",
            );
          }),
        withdrawMember: (id, failure = false) => {
          const r = commit(
            (d, s) => {
              if (!actor(s, "MEMBER", id))
                return fail("활성 회원 본인만 탈퇴할 수 있습니다.");
              if (d.loans.some((l) => l.memberUserId === id && isActiveLoan(l)))
                return fail("미반납 도서를 모두 반납한 후 탈퇴하세요.");
              const u = d.users.find((u) => u.userId === id)!;
              const identity = [
                u.fullName,
                u.loginId,
                u.contact,
                String(id),
              ].filter((value): value is string => !!value);
              const redact = (text: string) =>
                identity.reduce(
                  (value, token) => value.replaceAll(token, "[개인정보 제거]"),
                  text,
                );
              d.corrections.forEach((row) => {
                row.reason = redact(row.reason);
                row.evidenceReference = row.evidenceReference
                  ? redact(row.evidenceReference)
                  : null;
              });
              d.copyHistory.forEach((row) => {
                row.reason = redact(row.reason);
              });
              d.staffHistory.forEach((row) => {
                row.reason = row.reason ? redact(row.reason) : null;
              });
              u.loginId = null;
              u.fullName = null;
              u.contact = null;
              u.borrowingSuspendedUntil = null;
              u.accountStatus = "WITHDRAWN";
              d.loans.forEach((l) => {
                if (l.memberUserId === id) l.memberUserId = null;
              });
              d.requests.forEach((r) => {
                if (r.actorUserId === id) {
                  r.actorUserId = null;
                  r.responseSnapshot = { ok: true };
                }
              });
              return ok(
                "탈퇴 완료 · 개인정보와 과거 대출의 회원 연결을 제거했습니다.",
              );
            },
            failure,
            { demoRole: null, demoMemberId: 0, dbFlowEvents: [] },
          );
          return r;
        },
        addAuthor: (name) =>
          commit((d, s) => {
            if (!actor(s, "LIBRARIAN"))
              return fail("사서만 저자를 관리할 수 있습니다.");
            if (!name.trim() || name.length > 150)
              return fail("저자명은 1~150자입니다.");
            d.authors.push({
              authorId: nextId(d.authors, "authorId"),
              authorName: name.trim(),
            });
            return ok("저자를 등록했습니다. 동명이인은 ID로 구분합니다.");
          }),
        renameAuthor: (id, name) =>
          commit((d, s) => {
            if (!actor(s, "LIBRARIAN"))
              return fail("사서만 저자를 관리할 수 있습니다.");
            const a = d.authors.find((a) => a.authorId === id);
            if (!a || !name.trim() || name.length > 150)
              return fail("저자와 이름을 확인하세요.");
            d.books
              .filter((b) =>
                d.bookAuthors.some(
                  (r) => r.bookId === b.bookId && r.authorId === id,
                ),
              )
              .forEach((b) =>
                d.bookHistory.push({
                  bookChangeId: nextId(d.bookHistory, "bookChangeId"),
                  bookId: b.bookId,
                  changedByUserId: s.demoLibrarianId,
                  changedAt: now(),
                  beforeValues: { author_id: id, author_name: a.authorName },
                  afterValues: { author_id: id, author_name: name.trim() },
                }),
              );
            a.authorName = name.trim();
            return ok("저자명과 연결 서지 이력을 저장했습니다.");
          }),
        saveBook: (v, id) =>
          commit((d, s) => {
            if (!actor(s, "LIBRARIAN"))
              return fail("활성 사서만 서지정보를 관리할 수 있습니다.");
            const isbn = normalizeIsbn(v.isbn),
              title = v.title.trim(),
              categoryCode = v.categoryCode.trim(),
              year = v.publicationYear.trim()
                ? Number(v.publicationYear)
                : null;
            if (!title || title.length > 255 || v.publisher.length > 150)
              return fail("도서명(1~255자)과 출판사(150자)를 확인하세요.");
            if (categoryCode !== "DEMO_GENERAL")
              return fail(
                "분류 목록은 미확정입니다. 합성 데모 분류 DEMO_GENERAL만 사용합니다.",
              );
            if (isbn && d.books.some((b) => b.bookId !== id && b.isbn === isbn))
              return fail("이미 등록된 ISBN입니다.");
            if (
              year !== null &&
              (!Number.isInteger(year) || year < 1 || year > 9999)
            )
              return fail("발행연도는 1~9999 정수입니다.");
            if (
              !isbn &&
              !v.confirmSimilar &&
              d.books.some(
                (b) =>
                  b.bookId !== id &&
                  b.title.toLowerCase() === title.toLowerCase(),
              )
            )
              return fail(
                "유사 도서가 있습니다. 기존 서지를 검토하고 신규 등록 확인을 선택하세요.",
              );
            let ids = v.authorIds;
            if (!ids?.length)
              ids = [
                ...new Set(
                  v.authorNames
                    .split(/[;,、]/)
                    .map((n) => n.trim())
                    .filter(Boolean),
                ),
              ].map((name) => {
                if (name.length > 150)
                  throw Error("저자명은 150자 이하입니다.");
                const matches = d.authors.filter((a) => a.authorName === name);
                if (matches.length > 1)
                  throw Error("동명이인 저자는 ID로 선택하세요.");
                if (matches[0]) return matches[0].authorId;
                const authorId = nextId(d.authors, "authorId");
                d.authors.push({ authorId, authorName: name });
                return authorId;
              });
            if (
              !ids.length ||
              new Set(ids).size !== ids.length ||
              ids.some((id) => !d.authors.some((a) => a.authorId === id))
            )
              return fail("유효한 저자를 최소 1명 연결하세요.");
            const old = d.books.find((b) => b.bookId === id);
            if (id && !old) return fail("도서를 찾을 수 없습니다.");
            const book = {
              bookId: id ?? nextId(d.books, "bookId"),
              isbn,
              title,
              publisher: v.publisher.trim() || null,
              publicationYear: year,
              categoryCode,
            };
            if (old)
              d.bookHistory.push({
                bookChangeId: nextId(d.bookHistory, "bookChangeId"),
                bookId: book.bookId,
                changedByUserId: s.demoLibrarianId,
                changedAt: now(),
                beforeValues: {
                  ...old,
                  author_ids: d.bookAuthors
                    .filter((r) => r.bookId === id)
                    .map((r) => r.authorId),
                },
                afterValues: { ...book, author_ids: ids },
              });
            d.books = old
              ? d.books.map((b) => (b.bookId === id ? book : b))
              : [...d.books, book];
            d.bookAuthors = [
              ...d.bookAuthors.filter((r) => r.bookId !== book.bookId),
              ...ids.map((authorId) => ({ bookId: book.bookId, authorId })),
            ];
            return ok("서지정보와 저자 연결을 저장했습니다.");
          }),
        addCopy: (bookId) =>
          commit((d, s) => {
            if (!actor(s, "LIBRARIAN"))
              return fail("사서만 소장본을 등록할 수 있습니다.");
            if (!d.books.some((b) => b.bookId === bookId))
              return fail("도서를 찾을 수 없습니다.");
            const copyId = nextId(d.copies, "copyId");
            let serial = copyId;
            while (d.copies.some((c) => c.copyCode === `CD-${serial}`))
              serial++;
            d.copies.push({
              copyId,
              bookId,
              copyCode: `CD-${serial}`,
              managementStatus: "ACTIVE",
            });
            return ok(`소장본 등록 완료 · CD-${serial}`);
          }),
        changeCopyStatus: (id, status, reason, failure = false) =>
          commit((d, s) => {
            if (!actor(s, "LIBRARIAN"))
              return fail("사서만 소장본 상태를 변경할 수 있습니다.");
            const c = d.copies.find((c) => c.copyId === id);
            if (
              !c ||
              !["ACTIVE", "DAMAGED", "RETIRED"].includes(status) ||
              c.managementStatus === "RETIRED" ||
              c.managementStatus === status
            )
              return fail("제적 복원 또는 같은 상태 변경은 불가합니다.");
            if (!reason.trim()) return fail("상태 변경 사유가 필요합니다.");
            if (containsPatronIdentity(reason, s.users))
              return fail("변경 사유에 회원 개인정보를 입력할 수 없습니다.");
            if (
              status !== "DAMAGED" &&
              d.loans.some((l) => l.copyId === id && isActiveLoan(l))
            )
              return fail("미반납 소장본은 수리 완료·제적할 수 없습니다.");
            d.copyHistory.push({
              copyStatusHistoryId: nextId(d.copyHistory, "copyStatusHistoryId"),
              copyId: id,
              previousStatus: c.managementStatus,
              newStatus: status,
              reason: reason.trim(),
              changedByUserId: s.demoLibrarianId,
              relatedLoanId: null,
              changedAt: now(),
            });
            c.managementStatus = status;
            return ok("소장본 상태와 이력을 저장했습니다.");
          }, failure),
        toggleCopyStatus: () =>
          fail("상태와 사유를 지정하세요. 제적 복원은 불가합니다."),
        setBookStatus: () =>
          fail(
            "서지정보 자체는 제적하지 않습니다. 개별 소장본 상태를 관리하세요.",
          ),
        resetDemo: () => set(initial()),
      };
    },
    {
      name: "chaekdam-demo-state-v1",
      version: 2,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        ...dataOf(s),
        demoRole: s.demoRole,
        demoMemberId: s.demoMemberId,
        demoLibrarianId: s.demoLibrarianId,
        demoAdminId: s.demoAdminId,
      }),
    },
  ),
);
