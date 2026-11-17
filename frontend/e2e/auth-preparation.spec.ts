import { expect, test } from "@playwright/test";

test("registration validates and never reports success without a server", async ({ page }) => {
  await page.goto("/signup");
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page.getByText("로그인 ID를 1~50자로 입력하세요.")).toBeVisible();
  await page.getByLabel("로그인 ID").fill("reader");
  await page.getByLabel("비밀번호", { exact: true }).fill("secret");
  await page.getByLabel("비밀번호 확인").fill("secret");
  await page.getByLabel("이름", { exact: true }).fill("회원");
  await page.getByLabel("휴대전화번호").fill("010-1234-5678");
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("인증 서버가 연결되지 않았습니다");
  await expect(page).toHaveURL(/\/signup$/);
});

test("login cannot succeed without the authentication server", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("로그인 ID").fill("reader");
  await page.getByLabel("비밀번호", { exact: true }).fill("secret");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("인증 서버가 연결되지 않았습니다");
  await expect(page).toHaveURL(/\/login$/);
});

test("synthetic member registration remains available and clearly labelled", async ({ page }) => {
  await page.goto("/signup");
  await page.getByRole("link", { name: "회원가입 목업 체험하기" }).click();
  await expect(page.getByRole("heading", { name: "회원가입 데모" })).toBeVisible();
  await page.getByLabel("로그인 ID").fill("mock_new_reader");
  await page.getByLabel("이름").fill("목업회원");
  await page.getByLabel("연락처").fill("01087654321");
  await page.getByRole("button", { name: "일반 회원 가입" }).click();
  await expect(page.getByText(/실제 인증 계정은 생성하지 않습니다/).last()).toBeVisible();
});
