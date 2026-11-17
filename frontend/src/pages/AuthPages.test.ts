import { describe, expect, it } from "vitest";
import { validateAuth } from "../api/auth-validation";
import { AuthUnavailableError, unavailableAuth } from "../api/auth-contract";

describe("authentication preparation", () => {
  const valid = { loginId: "reader", password: "secret", confirm: "secret", fullName: "회원", contact: "010-1234-5678" };
  it("validates member registration without imposing a password policy", () => {
    expect(validateAuth(valid, true)).toEqual({});
    expect(validateAuth({ ...valid, confirm: "other", contact: "123" }, true)).toMatchObject({ confirm: expect.any(String), contact: expect.any(String) });
    expect(validateAuth({ ...valid, loginId: "", fullName: "" }, true)).toMatchObject({ loginId: expect.any(String), fullName: expect.any(String) });
  });
  it("fails closed when authentication is unavailable", async () => {
    await expect(unavailableAuth.login({ loginId: "reader", password: "secret" })).rejects.toBeInstanceOf(AuthUnavailableError);
    await expect(unavailableAuth.signup(valid)).rejects.toBeInstanceOf(AuthUnavailableError);
  });
});
