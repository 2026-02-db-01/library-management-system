import { expect, test, type Page } from "@playwright/test";

async function setRole(page: Page, role: "MEMBER" | "LIBRARIAN" | "ADMIN") {
  await page.evaluate(async (value) => {
    const { useLibraryStore } = await import("/src/store/libraryStore.ts");
    useLibraryStore.getState().requestRoleSwitch(value, "/");
    useLibraryStore.getState().completeRoleSwitch();
  }, role);
}

test("desktop menus support hover, keyboard, and protected navigation", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "주요 메뉴" });
  const books = nav.getByRole("button", { name: "도서 검색" });
  await books.hover();
  await expect(books).toHaveAttribute("aria-expanded", "true");
  await expect(nav.getByRole("link", { name: "상세 검색" })).toBeVisible();
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
  await page.goto("/");
  await page.getByLabel("검색 유형").selectOption("author");
  await page.getByLabel("검색어", { exact: true }).fill("Martin");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
  expect(new URL(page.url()).searchParams.get("next")).toContain("by=author");
  expect(new URL(page.url()).searchParams.get("next")).toContain("q=Martin");
  await page.goto("/"); await setRole(page, "MEMBER");
  await page.getByLabel("검색 유형").selectOption("author");
  await page.getByLabel("검색어", { exact: true }).fill("Martin");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(page).toHaveURL(/\/user\/books\?/);
  await expect(page.getByRole("textbox", { name: "도서 검색어" })).toHaveValue("Martin");
  await page.goto("/"); await setRole(page, "LIBRARIAN");
  await expect(page.getByRole("button", { name: "사서 업무" })).toBeVisible();
  await expect(page.getByLabel("데모 사서 선택")).toBeVisible();
  await page.goto("/librarian"); await expect(page).toHaveURL(/\/librarian$/);
  await page.goto("/"); await setRole(page, "ADMIN");
  await expect(page.getByRole("button", { name: "DB 구조" })).toBeVisible();
  await expect(page.getByLabel("데모 관리자 선택")).toBeVisible();
  await page.goto("/admin/db-console/erd"); await expect(page).toHaveURL(/\/erd$/);
});

test("mobile menu opens an accordion and login does not succeed without a server", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/");
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  const nav = page.getByRole("navigation", { name: "모바일 메뉴" });
  await nav.getByRole("button", { name: "내 서재" }).click();
  await expect(nav.getByRole("link", { name: "내 대출 현황" })).toBeVisible();
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await expect(nav).not.toBeVisible();
  await page.getByLabel("로그인 ID").fill("reader"); await page.getByLabel("비밀번호", { exact: true }).fill("secret");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("인증 서버가 연결되지 않았습니다");
});

test("login shortcuts enter the selected mock role", async ({ page }) => {
  for (const [label, path] of [["유저", "/user/books"], ["사서", "/librarian"], ["관리자", "/admin"]] as const) {
    await page.goto("/login");
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
});
