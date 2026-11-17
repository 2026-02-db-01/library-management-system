import { create } from "zustand";
import type { AuthenticatedUser } from "../api/auth-contract";
import { httpAuthTransport } from "../api/http-auth";
import { libraryApi } from "../api/library-api";
import type {
  BookCopy,
  BookFormValues,
  CorrectionType,
  DbFlowEvent,
  DbFlowEventDraft,
  LibraryData,
  RecordStatus,
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

interface AccountInput {
  loginId: string;
  fullName: string;
  contact: string;
}

interface LibraryStore extends LibraryData {
  currentUser: AuthenticatedUser | null;
  isInitialized: boolean;
  isLoading: boolean;
  demoRole: UserRole | null;
  roleSwitchTarget: string | null;
  demoMemberId: number;
  demoLibrarianId: number;
  demoAdminId: number;
  dbFlowEvents: DbFlowEvent[];
  initialize: () => Promise<void>;
  syncState: () => Promise<void>;
  setCurrentUser: (user: AuthenticatedUser | null) => Promise<void>;
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
  ) => Promise<ActionResult>;
  returnLoan: (
    loan: number,
    staff: number,
    options?: RequestOptions & { damaged?: boolean; reason?: string },
  ) => Promise<ActionResult>;
  renewLoan: (
    loan: number,
    member: number,
    failure?: boolean,
    options?: RequestOptions,
  ) => Promise<ActionResult>;
  correctLoan: (
    loan: number,
    input: CorrectionInput,
    options?: RequestOptions,
  ) => Promise<ActionResult>;
  setUserStatus: (id: number, reason?: string) => Promise<ActionResult>;
  setUserRole: (id: number, role: UserRole) => Promise<ActionResult>;
  addAuthor: (name: string) => Promise<ActionResult>;
  renameAuthor: (id: number, name: string) => Promise<ActionResult>;
  addMember: (v: AccountInput) => Promise<ActionResult>;
  addStaff: (v: AccountInput & { role: "LIBRARIAN" | "ADMIN" }) => Promise<ActionResult>;
  updateProfile: (
    id: number,
    v: { fullName: string; contact: string },
  ) => Promise<ActionResult>;
  withdrawMember: (id: number, failure?: boolean) => Promise<ActionResult>;
  saveBook: (v: BookFormValues, id?: number) => Promise<ActionResult>;
  addCopy: (bookId: number, ignoredCode?: string) => Promise<ActionResult>;
  changeCopyStatus: (
    id: number,
    status: RecordStatus,
    reason: string,
    failure?: boolean,
  ) => Promise<ActionResult>;
  toggleCopyStatus: (id: number) => Promise<ActionResult>;
  setBookStatus: (id: number) => Promise<ActionResult>;
  resetDemo: () => Promise<void>;
}

const ok = (message: string, loanId?: number): ActionResult => ({
  ok: true,
  message,
  loanId,
});

const fail = (message: string): ActionResult => ({ ok: false, message });

const now = () => new Date().toISOString();

const emptyData: LibraryData = {
  users: [],
  books: [],
  authors: [],
  bookAuthors: [],
  copies: [],
  loans: [],
  renewals: [],
  staffHistory: [],
  bookHistory: [],
  copyHistory: [],
  corrections: [],
  requests: [],
};

function mapAuthToRoleState(user: AuthenticatedUser | null) {
  if (!user) {
    return {
      currentUser: null,
      demoRole: null,
      demoMemberId: 0,
      demoLibrarianId: 0,
      demoAdminId: 0,
    };
  }
  return {
    currentUser: user,
    demoRole: user.role,
    demoMemberId: user.role === "MEMBER" ? user.userId : 0,
    demoLibrarianId: user.role === "LIBRARIAN" ? user.userId : 0,
    demoAdminId: user.role === "ADMIN" ? user.userId : 0,
  };
}

export const useLibraryStore = create<LibraryStore>()((set, get) => {
  async function runAndSync(
    work: () => Promise<ActionResult>,
    options?: { simulateFailure?: boolean; operation?: string },
  ): Promise<ActionResult> {
    if (options?.simulateFailure) {
      const msg = "오류 시연: 이력 저장 실패. 요청을 전송하지 않고 롤백했습니다.";
      if (options.operation) {
        get().recordDbFlowEvents([
          {
            operation: "ROLLBACK",
            message: `${options.operation}: ${msg}`,
            status: "failed",
          },
        ]);
      }
      return fail(msg);
    }

    try {
      const result = await work();
      if (result.ok) {
        await get().syncState();
      }
      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "요청 처리에 실패했습니다.";
      if (options?.operation) {
        get().recordDbFlowEvents([
          {
            operation: "ROLLBACK",
            message: `${options.operation}: ${message}`,
            status: "failed",
          },
        ]);
      }
      return fail(message);
    }
  }

  return {
    ...emptyData,
    currentUser: null,
    isInitialized: false,
    isLoading: false,
    demoRole: null,
    roleSwitchTarget: null,
    demoMemberId: 0,
    demoLibrarianId: 0,
    demoAdminId: 0,
    dbFlowEvents: [],

    initialize: async () => {
      set({ isLoading: true });
      try {
        const user = await httpAuthTransport.currentUser();
        const data = await libraryApi.fetchState();
        set({
          ...data,
          ...mapAuthToRoleState(user),
          isInitialized: true,
          isLoading: false,
        });
      } catch {
        set({ isInitialized: true, isLoading: false });
      }
    },

    syncState: async () => {
      const [user, data] = await Promise.all([
        httpAuthTransport.currentUser(),
        libraryApi.fetchState(),
      ]);
      set({
        ...data,
        ...mapAuthToRoleState(user),
      });
    },

    setCurrentUser: async (user) => {
      set(mapAuthToRoleState(user));
      const data = await libraryApi.fetchState();
      set({ ...data });
    },

    requestRoleSwitch: (role, target) => {
      const current = get().currentUser;
      if (current && current.role === role) {
        set({ roleSwitchTarget: target });
        return;
      }
      set({
        demoRole: role,
        roleSwitchTarget: target,
      });
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

    checkout: (memberId, copyId, _staffId, options = {}) =>
      runAndSync(
        async () => {
          const res = await libraryApi.checkout(
            memberId,
            copyId,
            options.requestId,
          );
          if (Array.isArray(res.dbFlowEvents) && res.dbFlowEvents.length > 0) {
            set((s) => ({
              dbFlowEvents: [
                ...s.dbFlowEvents,
                ...(res.dbFlowEvents as DbFlowEvent[]),
              ].slice(-150),
            }));
          }
          return ok(res.message, res.loanId ?? undefined);
        },
        { simulateFailure: options.simulateFailure, operation: "CHECKOUT" },
      ),

    returnLoan: (loanId, _staffId, options = {}) =>
      runAndSync(
        async () => {
          const res = await libraryApi.returnLoan(
            loanId,
            Boolean(options.damaged),
            options.reason ?? "",
            options.requestId,
          );
          if (Array.isArray(res.dbFlowEvents) && res.dbFlowEvents.length > 0) {
            set((s) => ({
              dbFlowEvents: [
                ...s.dbFlowEvents,
                ...(res.dbFlowEvents as DbFlowEvent[]),
              ].slice(-150),
            }));
          }
          return ok(res.message, res.loanId ?? loanId);
        },
        { simulateFailure: options.simulateFailure, operation: "RETURN" },
      ),

    renewLoan: (loanId, _memberId, failure = false, options = {}) =>
      runAndSync(
        async () => {
          const res = await libraryApi.renewLoan(loanId, options.requestId);
          if (Array.isArray(res.dbFlowEvents) && res.dbFlowEvents.length > 0) {
            set((s) => ({
              dbFlowEvents: [
                ...s.dbFlowEvents,
                ...(res.dbFlowEvents as DbFlowEvent[]),
              ].slice(-150),
            }));
          }
          return ok(res.message, res.loanId ?? loanId);
        },
        {
          simulateFailure: failure || options.simulateFailure,
          operation: "RENEW",
        },
      ),

    correctLoan: (loanId, input, options = {}) =>
      runAndSync(
        async () => {
          const res = await libraryApi.correctLoan(loanId, {
            ...input,
            requestId: options.requestId,
          });
          if (Array.isArray(res.dbFlowEvents) && res.dbFlowEvents.length > 0) {
            set((s) => ({
              dbFlowEvents: [
                ...s.dbFlowEvents,
                ...(res.dbFlowEvents as DbFlowEvent[]),
              ].slice(-150),
            }));
          }
          return ok(res.message, res.loanId ?? loanId);
        },
        { simulateFailure: options.simulateFailure, operation: "CORRECT" },
      ),

    setUserStatus: (id, reason = "") =>
      runAndSync(async () => {
        const res = await libraryApi.toggleStaffStatus(id, reason);
        return ok(res.message);
      }),

    setUserRole: async () => fail("생성된 계정의 역할은 변경할 수 없습니다."),

    addAuthor: (name) =>
      runAndSync(async () => {
        await libraryApi.createAuthor(name);
        return ok("저자를 등록했습니다. 동명이인은 ID로 구분합니다.");
      }),

    renameAuthor: (id, name) =>
      runAndSync(async () => {
        await libraryApi.renameAuthor(id, name);
        return ok("저자명과 연결 서지 이력을 저장했습니다.");
      }),

    addMember: (v) =>
      runAndSync(async () => {
        await httpAuthTransport.signup({
          loginId: v.loginId,
          password: "password123",
          fullName: v.fullName,
          contact: v.contact,
        });
        return ok("회원가입이 완료되었습니다.");
      }),

    addStaff: (v) =>
      runAndSync(async () => {
        const res = await libraryApi.createStaff(v);
        return ok(res.message);
      }),

    updateProfile: (_id, v) =>
      runAndSync(async () => {
        const res = await libraryApi.updateProfile(v.fullName, v.contact);
        return ok(res.message);
      }),

    withdrawMember: (_id, failure = false) =>
      runAndSync(
        async () => {
          const res = await libraryApi.withdrawAccount();
          set({
            ...mapAuthToRoleState(null),
            dbFlowEvents: [],
          });
          return ok(res.message);
        },
        { simulateFailure: failure },
      ),

    saveBook: (v, id) =>
      runAndSync(async () => {
        await libraryApi.saveBook({
          bookId: id,
          isbn: v.isbn,
          title: v.title,
          publisher: v.publisher,
          publicationYear: v.publicationYear,
          authorNames: v.authorNames,
          categoryCode: v.categoryCode,
          authorIds: v.authorIds,
          confirmSimilar: v.confirmSimilar,
        });
        return ok("서지정보와 저자 연결을 저장했습니다.");
      }),

    addCopy: (bookId) =>
      runAndSync(async () => {
        const copy = (await libraryApi.addCopy(bookId)) as BookCopy;
        return ok(`소장본 등록 완료 · ${copy.copyCode}`);
      }),

    changeCopyStatus: (id, status, reason, failure = false) =>
      runAndSync(
        async () => {
          await libraryApi.changeCopyStatus(id, status, reason);
          return ok("소장본 상태와 이력을 저장했습니다.");
        },
        { simulateFailure: failure },
      ),

    toggleCopyStatus: async () =>
      fail("상태와 사유를 지정하세요. 제적 복원은 불가합니다."),

    setBookStatus: async () =>
      fail("서지정보 자체는 제적하지 않습니다. 개별 소장본 상태를 관리하세요."),

    resetDemo: async () => {
      await get().syncState();
    },
  };
});