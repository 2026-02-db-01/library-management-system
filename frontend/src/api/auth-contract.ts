/** Proposed interface only. Endpoint paths, sessions and error format require backend agreement. */
export type AuthRole = "MEMBER" | "LIBRARIAN" | "ADMIN";
export interface AuthenticatedUser {
  userId: number;
  role: AuthRole;
  accountStatus: "ACTIVE" | "INACTIVE" | "WITHDRAWN";
  loginId: string;
  fullName: string;
  contact: string;
}
export interface RegistrationInput {
  loginId: string;
  password: string;
  fullName: string;
  contact: string;
}
export interface AuthTransport {
  currentUser(signal?: AbortSignal): Promise<AuthenticatedUser | null>;
  login(input: { loginId: string; password: string }): Promise<AuthenticatedUser>;
  signup(input: RegistrationInput): Promise<void>;
  logout(): Promise<void>;
}
export class AuthUnavailableError extends Error {
  constructor() { super("인증 서버가 연결되지 않았습니다. 잠시 후 다시 시도해 주세요."); }
}
/** Deliberately fails closed until a server contract is agreed and implemented. */
export const unavailableAuth: AuthTransport = {
  async currentUser() { throw new AuthUnavailableError(); },
  async login() { throw new AuthUnavailableError(); },
  async signup() { throw new AuthUnavailableError(); },
  async logout() { throw new AuthUnavailableError(); },
};
