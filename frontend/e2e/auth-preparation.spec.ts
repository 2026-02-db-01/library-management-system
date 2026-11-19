import { installApiFixture } from "./api-fixture";
import { expect, test } from "@playwright/test";

test("registration validates inputs before contacting server", async ({ page }) => {
  await installApiFixture(page);
  let requested = false;
  await page.route("**/api/v1/auth/signup", async route => {
    requested = true;
    expect(route.request().postDataJSON()).toEqual({ loginId: "reader", password: "secret", fullName: "회원", contact: "01012345678" });
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "서버 점검 중" }),
    });
  });
  await page.goto("/signup");
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page.getByText("로그인 ID를 1~50자로 입력하세요.")).toBeVisible();
  expect(requested).toBe(false);
  await page.getByLabel("로그인 ID").fill("reader");
  await page.getByLabel("비밀번호", { exact: true }).fill("secret");
  await page.getByLabel("비밀번호 확인").fill("secret");
  await page.getByLabel("이름", { exact: true }).fill("회원");
  await page.getByLabel("휴대전화번호").fill("010-1234-5678");
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("서버 점검 중");
  expect(requested).toBe(true);
});

test("invalid server credentials do not authenticate", async ({ page }) => {
  await installApiFixture(page);
  await page.route("**/api/v1/auth/login", async route => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "아이디 또는 비밀번호가 올바르지 않습니다." }),
    });
  });
  await page.goto("/login");
  await page.getByLabel("로그인 ID").fill("unknown");
  await page.getByLabel("비밀번호", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("아이디 또는 비밀번호가 올바르지 않습니다.");
  await expect(page).toHaveURL(/\/login$/);
});

test("legacy demo signup route is not exposed", async ({ page }) => {
  await installApiFixture(page);
  await page.goto("/signup/demo");
  await expect(page.getByRole("heading", { name: "회원가입 데모" })).toHaveCount(0);
});

test("account password change validates confirmation and requires the new password on re-login", async ({ page }) => {
  await installApiFixture(page);
  const oldPassword = "fixture-test-password";
  const newPassword = "fixture-updated-password";
  let changeRequests = 0;
  await page.route("**/api/v1/auth/change-password", async route => {
    changeRequests++;
    expect(route.request().postDataJSON()).toEqual({
      currentPassword: expect.any(String), newPassword,
    });
    await route.fallback();
  });

  async function submitLogin(value: string) {
    await page.getByLabel("로그인 ID").fill("haneul.k");
    await page.getByLabel("비밀번호", { exact: true }).fill(value);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
  }

  await page.goto("/login");
  await submitLogin(oldPassword);
  await expect(page).toHaveURL(/\/user\/books$/);
  await page.goto("/account");

  const form = page.getByRole("form", { name: "비밀번호 변경" });
  const current = form.getByLabel("현재 비밀번호", { exact: true });
  const confirmation = form.getByLabel("새 비밀번호 확인", { exact: true });
  const submit = form.getByRole("button", { name: "비밀번호 변경" });
  await current.fill("invalid-current");
  await form.getByLabel("새 비밀번호", { exact: true }).fill(newPassword);
  await confirmation.fill("different-confirmation");
  await submit.click();
  await expect(form.getByRole("alert")).toHaveText("새 비밀번호와 확인 값이 일치하지 않습니다.");
  await expect(confirmation).toHaveAttribute("aria-invalid", "true");
  expect(changeRequests).toBe(0);

  await confirmation.fill(newPassword);
  await submit.click();
  await expect(form.getByRole("alert")).toHaveText("현재 비밀번호가 올바르지 않습니다.");
  await expect(current).toHaveAttribute("aria-invalid", "true");
  await expect(page).toHaveURL(/\/account$/);

  await current.fill(oldPassword);
  await submit.click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("status")).toHaveText("비밀번호를 변경했습니다. 새 비밀번호로 다시 로그인해 주세요.");
  expect(changeRequests).toBe(2);
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await submitLogin(oldPassword);
  await expect(page.getByRole("alert")).toHaveText("아이디 또는 비밀번호가 올바르지 않습니다.");
  await submitLogin(newPassword);
  await expect(page).toHaveURL(/\/user\/books$/);
});
