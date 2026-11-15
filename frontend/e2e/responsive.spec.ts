import { test, expect } from "@playwright/test";
test("primary screens fit mobile, tablet and desktop without document overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [role, paths] of [
      ["MEMBER", ["/user/books", "/user/loans", "/account"]],
      [
        "LIBRARIAN",
        [
          "/librarian/checkout",
          "/librarian/returns",
          "/librarian/books",
          "/librarian/copies",
        ],
      ],
      [
        "ADMIN",
        [
          "/admin/members",
          "/admin/db-console/erd",
          "/admin/db-console/tables/request_record",
        ],
      ],
    ] as const) {
      await page.evaluate(async (role) => {
        const { useLibraryStore: s } =
          await import("/src/store/libraryStore.ts");
        s.getState().requestRoleSwitch(role, "/");
        s.getState().completeRoleSwitch();
      }, role);
      for (const path of paths) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
          `${width}px ${path}: ${await page.evaluate(() =>
            Array.from(document.querySelectorAll("body *"))
              .filter(
                (el) =>
                  el.getBoundingClientRect().right > window.innerWidth + 1 &&
                  !el.closest(".table-scroll,.react-flow"),
              )
              .slice(0, 10)
              .map((el) => `${el.tagName}.${el.className}`)
              .join(", "),
          )}`,
        ).toBe(true);
      }
    }
    await page.screenshot({
      path: `test-results/responsive-${width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
