import { installApiFixture } from "./api-fixture";
import { expect, test } from "@playwright/test";

test("desktop menus support hover, keyboard, and protected navigation", async ({ page }) => {
  await installApiFixture(page);
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "주요 메뉴" });
  const books = nav.getByRole("button", { name: "도서 검색" });
  await books.hover();
  await expect(books).toHaveAttribute("aria-expanded", "true");
  await expect(nav.getByRole("link", { name: "도서 검색" })).toBeVisible();
  const shelf = nav.getByRole("button", { name: "내 서재" });
  await shelf.hover();
  await expect(books).toHaveAttribute("aria-expanded", "false");
  await expect(nav.getByRole("link", { name: "내 대출 현황" })).toBeVisible();
  await shelf.focus(); await page.keyboard.press("Escape");
  await expect(shelf).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Enter");
  await nav.getByRole("link", { name: "내 대출 현황" }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("search retains query and type, and fixture roles expose correct routes", async ({ page }) => {
  const api = await installApiFixture(page);
  await page.goto("/");
  await page.getByLabel("검색 유형").selectOption("author");
  await page.getByLabel("검색어", { exact: true }).fill("Martin");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
  expect(new URL(page.url()).searchParams.get("next")).toContain("by=author");
  expect(new URL(page.url()).searchParams.get("next")).toContain("q=Martin");
  api.setRole("MEMBER"); await page.goto("/");
  await page.getByLabel("검색 유형").selectOption("author");
  await page.getByLabel("검색어", { exact: true }).fill("Martin");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(page).toHaveURL(/\/user\/books\?/);
  await expect(page.getByRole("textbox", { name: "도서 검색어" })).toHaveValue("Martin");
  api.setRole("LIBRARIAN"); await page.goto("/");
  await expect(page.getByRole("button", { name: "사서 업무" })).toBeVisible();
  await expect(page.getByLabel("데모 사서 선택")).toHaveCount(0);
  await page.goto("/librarian"); await expect(page).toHaveURL(/\/librarian$/);
  api.setRole("ADMIN"); await page.goto("/");
  await expect(page.getByRole("button", { name: "DB 구조" })).toBeVisible();
  await expect(page.getByLabel("데모 관리자 선택")).toHaveCount(0);
  await page.goto("/admin/db-console/erd"); await expect(page).toHaveURL(/\/erd$/);
});

test("mobile menu opens an accordion and login does not succeed without a server", async ({ page }) => {
  const api = await installApiFixture(page);
  api.authUnavailable();
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/");
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  const nav = page.getByRole("navigation", { name: "모바일 메뉴" });
  await nav.getByRole("button", { name: "내 서재" }).click();
  await expect(nav.getByRole("link", { name: "내 대출 현황" })).toBeVisible();
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await expect(nav).not.toBeVisible();
  await page.getByLabel("로그인 ID").fill("reader"); await page.getByLabel("비밀번호", { exact: true }).fill("secret");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("인증 서버에 연결할 수 없습니다");
});

test("server roles determine routing, session restore and logout", async ({ page }) => {
  const api = await installApiFixture(page);
  for (const [role, path, forbidden] of [
    ["MEMBER", "/user/books", "/librarian"],
    ["LIBRARIAN", "/librarian", "/admin"],
    ["ADMIN", "/admin", "/librarian"],
  ] as const) {
    const user = api.data.users.find((item) => item.role === role && item.accountStatus === "ACTIVE")!;
    await page.goto("/login");
    await page.getByLabel("로그인 ID").fill(user.loginId!);
    await page.getByLabel("비밀번호", { exact: true }).fill("fixture-test-password");
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page).toHaveURL(path);
    await page.reload();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto(forbidden);
    await expect(page).toHaveURL("/");
    await page.goto(path);
    await page.getByRole("banner").getByRole("button", { name: "로그아웃", exact: true }).click();
    await expect(page).toHaveURL("/");
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?next=/);
  }
});

test("homepage login keeps credentials out of storage and failed logout preserves session", async ({ page }) => {
  const api = await installApiFixture(page);
  const user = api.data.users.find((item) => item.role === "MEMBER" && item.accountStatus === "ACTIVE")!;
  await page.goto("/");
  await page.getByLabel("로그인 ID").fill(user.loginId!);
  await page.getByLabel("비밀번호", { exact: true }).fill("fixture-test-password");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "도서 검색어" })).toBeVisible();
  await expect(page).toHaveURL("/user/books");
  const storage = await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]));
  expect(storage).not.toContain("fixture-test-password");
  expect(storage).not.toContain("chaekdam-mock-session");
  api.failLogout(true);
  await page.getByRole("banner").getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page.locator(".global-toast")).toContainText("로그아웃 요청을 처리하지 못했습니다.");
  await expect(page).toHaveURL("/user/books");
  api.failLogout(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await page.locator(".mobile-nav").getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/user/books");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("state fetch failure does not render zero metrics", async ({ page }) => {
  const api = await installApiFixture(page);
  api.setRole("ADMIN");
  await page.route("**/api/v1/library/state", route => route.fulfill({
    status: 503, json: { message: "DB 일시 장애" },
  }));
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "업무 데이터를 불러오지 못했습니다." })).toBeVisible();
  await expect(page.locator(".metric-grid")).toHaveCount(0);
  await expect(page.getByRole("main").getByText("DB 일시 장애")).toBeVisible();
});

test("retry restores the actual dashboard", async ({ page }) => {
  const api = await installApiFixture(page);
  api.setRole("ADMIN");
  await page.route("**/api/v1/library/state", route => route.abort("connectionfailed"), { times: 1 });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "업무 데이터를 불러오지 못했습니다." })).toBeVisible();
  await expect(page.locator(".metric-grid")).toHaveCount(0);
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page).toHaveURL("/admin");
  await expect(page.getByRole("heading", { name: "관리자 대시보드", level: 1 })).toBeVisible();
  await expect(page.locator(".metric-grid").getByText(String(api.data.books.length), { exact: true }).first()).toBeVisible();
});

test("session expiration clears protected data and redirects to login", async ({ page }) => {
  const api = await installApiFixture(page);
  api.setRole("ADMIN");
  await page.goto("/admin");
  await expect(page.locator(".metric-grid")).toBeVisible();
  await page.route("**/api/v1/library/state", route => route.fulfill({
    status: 401, json: { message: "세션이 만료되었습니다." },
  }));
  await page.getByRole("banner").getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
  await expect(page.locator(".metric-grid")).toHaveCount(0);
});
