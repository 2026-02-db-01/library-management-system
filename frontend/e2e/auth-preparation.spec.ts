import { expect, test } from "@playwright/test";

test("registration validates inputs before contacting server", async ({ page }) => {
  let requested = false;
  await page.route("**/api/v1/auth/signup", async route => {
    requested = true;
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
  await page.goto("/signup/demo");
  await expect(page.getByRole("heading", { name: "회원가입 데모" })).toHaveCount(0);
});
