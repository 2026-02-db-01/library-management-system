import type { UserRole } from "../types/domain";

const accounts: { role: UserRole; aliases: readonly string[]; path: string }[] = [
  { role: "MEMBER", aliases: ["user", "유저"], path: "/user/books" },
  { role: "LIBRARIAN", aliases: ["librarian", "사서"], path: "/librarian" },
  { role: "ADMIN", aliases: ["admin", "관리자"], path: "/admin" },
];

export function mockAuthEnabled(): boolean {
  const mode = import.meta.env.VITE_AUTH_MODE;
  return !mode || mode === "mock";
}

export function authenticateMock(loginId: string, password: string) {
  if (!mockAuthEnabled()) throw new Error("실제 인증 서버가 연결되지 않았습니다.");
  const account = accounts.find((entry) => entry.aliases.includes(loginId.trim()) && entry.aliases.includes(password));
  if (!account) throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
  return { role: account.role, path: account.path };
}

const sessionKey = "chaekdam-mock-session";
export function readMockSession(): UserRole | null {
  if (!mockAuthEnabled()) return null;
  try {
    const role = sessionStorage.getItem(sessionKey);
    return role === "MEMBER" || role === "LIBRARIAN" || role === "ADMIN" ? role : null;
  } catch { return null; }
}
export function writeMockSession(role: UserRole | null) {
  try {
    if (role && mockAuthEnabled()) sessionStorage.setItem(sessionKey, role);
    else sessionStorage.removeItem(sessionKey);
  } catch { /* The current in-memory session remains usable. */ }
}
