import { test, expect } from "@playwright/test";
test("all role routes, console errors, responsive layout and workflow controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const [role, paths] of [
    ["MEMBER", ["/user/books", "/user/loans", "/account"]],
    [
      "LIBRARIAN",
      [
        "/librarian",
        "/librarian/checkout",
        "/librarian/returns",
        "/librarian/renewals",
        "/librarian/overdue",
        "/librarian/books",
        "/librarian/authors",
        "/librarian/copies",
        "/librarian/corrections",
        "/librarian/history",
        "/librarian/loans",
      ],
    ],
    [
      "ADMIN",
      [
        "/admin",
        "/admin/members",
        "/admin/books",
        "/admin/authors",
        "/admin/statistics",
        "/admin/history",
        "/admin/db-console/catalog",
        "/admin/db-console/erd",
        "/admin/db-console/constraints",
        "/admin/db-console/dictionary",
        ...[
          "app_user",
          "book",
          "author",
          "book_author",
          "book_copy",
          "loan",
          "loan_renewal",
          "staff_account_history",
          "book_change_history",
          "copy_status_history",
          "loan_correction_history",
          "request_record",
        ].map((t) => "/admin/db-console/tables/" + t),
      ],
    ],
  ] as const) {
    await page.evaluate(async (role) => {
      const { useLibraryStore: s } = await import("/src/store/libraryStore.ts");
      s.getState().requestRoleSwitch(role, "/");
      s.getState().completeRoleSwitch();
    }, role);
    for (const path of paths) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText("화면을 불러오는 중…")).toHaveCount(0);
    }
  }
  await page.goto("/admin/db-console/erd");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.locator(".react-flow__node").first().waitFor();
  await expect(page.locator(".react-flow__node")).toHaveCount(12);
  await page.locator(".react-flow__edge").first().click({ force: true });
  await expect(page.locator(".column-highlighted")).toHaveCount(2);
  await expect(page.locator(".interactive-erd-detail")).toContainText(
    "참조합니다",
  );
  await page.screenshot({
    path: "test-results/console-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/db-console/catalog");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({
    path: "test-results/console-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(async () => {
    const { useLibraryStore: s } = await import("/src/store/libraryStore.ts");
    s.getState().requestRoleSwitch("MEMBER", "/");
    s.getState().completeRoleSwitch();
  });
  await page.goto("/user/books");
  await page.getByRole("textbox", { name: "도서 검색어" }).fill("Clean");
  await expect(page.locator(".book-card")).toHaveCount(1);
  await page.locator(".book-card").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/admin/members");
  await expect(page).toHaveURL("/");
  expect(errors).toEqual([]);
});
