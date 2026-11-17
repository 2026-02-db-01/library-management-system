import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticateMock } from "./mock-auth";

describe("fixed mock accounts", () => {
  afterEach(() => vi.unstubAllEnvs());
  it.each([
    ["user", "user", "MEMBER"], ["유저", "user", "MEMBER"],
    ["librarian", "사서", "LIBRARIAN"], ["사서", "사서", "LIBRARIAN"],
    ["admin", "관리자", "ADMIN"], ["관리자", "admin", "ADMIN"],
  ])("accepts %s with the correct alias", (id, password, role) => {
    expect(authenticateMock(id, password).role).toBe(role);
  });
  it("rejects wrong and cross-role credentials", () => {
    expect(() => authenticateMock("user", "admin")).toThrow();
    expect(() => authenticateMock("unknown", "user")).toThrow();
  });
  it("disables test accounts in API mode", () => {
    vi.stubEnv("VITE_AUTH_MODE", "api");
    expect(() => authenticateMock("user", "user")).toThrow("실제 인증 서버가 연결되지 않았습니다.");
  });
});
