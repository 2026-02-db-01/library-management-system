import { create } from "zustand";
import type { AuthenticatedUser } from "../api/auth-contract";
import { httpAuthTransport } from "../api/http-auth";
import { ApiError } from "../api/client";
import { libraryApi } from "../api/library-api";
import type {
  BookCopy,
  BookFormValues,
  CorrectionType,
  DbFlowEvent,
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
  dataError: string;
  logout: () => Promise<void>;
  dbFlowEvents: DbFlowEvent[];
  initialize: () => Promise<void>;
  syncState: () => Promise<void>;
  setCurrentUser: (user: AuthenticatedUser | null) => Promise<void>;
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
  addStaff: (v: AccountInput & { password: string; role: "LIBRARIAN" | "ADMIN" }) => Promise<ActionResult>;
  updateProfile: (
    v: { fullName: string; contact: string },
  ) => Promise<ActionResult>;
  withdrawMember: () => Promise<ActionResult>;
  saveBook: (v: BookFormValues, id?: number) => Promise<ActionResult>;
  addCopy: (bookId: number, ignoredCode?: string) => Promise<ActionResult>;
  changeCopyStatus: (
    id: number,
    status: RecordStatus,
    reason: string,
  ) => Promise<ActionResult>;
  toggleCopyStatus: (id: number) => Promise<ActionResult>;
  setBookStatus: (id: number) => Promise<ActionResult>;
}

const ok = (message: string, loanId?: number): ActionResult => ({
  ok: true,
  message,
  loanId,
});

const fail = (message: string): ActionResult => ({ ok: false, message });

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

export const useLibraryStore = create<LibraryStore>()((set, get) => {
  let sessionVersion = 0;
  let refreshVersion = 0;
  let initialization: Promise<void> | undefined;

  function replaceSession(currentUser: AuthenticatedUser | null) {
    sessionVersion++;
    set({ ...emptyData, currentUser, dbFlowEvents: [], dataError: "" });
  }

  async function runAndSync(work: () => Promise<ActionResult>): Promise<ActionResult> {
    const session = sessionVersion;
    try {
      const result = await work();
      if (result.ok && session === sessionVersion) {
        await get().syncState().catch(() => undefined);
      }
      return result;
    } catch (error) {
      if (session === sessionVersion && error instanceof ApiError &&
          (error.status === 401 || error.code === "INACTIVE_USER")) {
        replaceSession(null);
      }
      return fail(error instanceof Error ? error.message : "요청 처리에 실패했습니다.");
    }
  }

  return {
    ...emptyData,
    currentUser: null,
    isInitialized: false,
    dataError: "",
    dbFlowEvents: [],

    initialize: () => {
      initialization ??= get().syncState().catch(() => undefined)
        .finally(() => set({ isInitialized: true }));
      return initialization;
    },

    syncState: async () => {
      const refresh = ++refreshVersion;
      const session = sessionVersion;
      const isCurrent = () => refresh === refreshVersion && session === sessionVersion;
      try {
        const user = await httpAuthTransport.currentUser();
        if (!isCurrent()) return;
        if (user?.userId !== get().currentUser?.userId ||
            user?.role !== get().currentUser?.role) {
          set({ ...emptyData, dbFlowEvents: [] });
        }
        set({ currentUser: user });
        if (!user) return;
        const data = await libraryApi.fetchState();
        if (isCurrent()) set({ ...data, dataError: "" });
      } catch (error) {
        if (!isCurrent()) return;
        if (error instanceof ApiError && (error.status === 401 || error.code === "INACTIVE_USER")) {
          replaceSession(null);
        }
        set({ dataError: error instanceof Error ? error.message : "데이터를 불러오지 못했습니다." });
        throw error;
      }
    },

    setCurrentUser: async (user) => {
      replaceSession(user);
      if (user) await get().syncState().catch(() => undefined);
    },

    logout: async () => {
      try {
        await httpAuthTransport.logout();
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) throw error;
      }
      replaceSession(null);
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
      ),

    renewLoan: (loanId, _memberId, options = {}) =>
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

    addStaff: (v) =>
      runAndSync(async () => {
        const res = await libraryApi.createStaff(v);
        return ok(res.message);
      }),

    updateProfile: (v) =>
      runAndSync(async () => {
        const res = await libraryApi.updateProfile(v.fullName, v.contact);
        return ok(res.message);
      }),

    withdrawMember: () =>
      runAndSync(
        async () => {
          const res = await libraryApi.withdrawAccount();
          replaceSession(null);
          return ok(res.message);
        },
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

    changeCopyStatus: (id, status, reason) =>
      runAndSync(
        async () => {
          await libraryApi.changeCopyStatus(id, status, reason);
          return ok("소장본 상태와 이력을 저장했습니다.");
        },
      ),

    toggleCopyStatus: async () =>
      fail("상태와 사유를 지정하세요. 제적 복원은 불가합니다."),

    setBookStatus: async () =>
      fail("서지정보 자체는 제적하지 않습니다. 개별 소장본 상태를 관리하세요."),

  };
});