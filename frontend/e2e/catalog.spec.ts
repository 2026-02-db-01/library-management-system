import { installApiFixture } from "./api-fixture";
import { test, expect } from "@playwright/test";
test("catalog ISBN normalization, combined filters and twenty-row pagination", async ({
  page,
}) => {
  const api = await installApiFixture(page);
  api.setRole("MEMBER");
  await page.goto("/user/books");
  await page.getByRole("button", { name: "ISBN", exact: true }).click();
  await page
    .getByRole("textbox", { name: "도서 검색어" })
    .fill("0-13-235088-2");
  await expect(page.locator(".book-card")).toHaveCount(1);
  await page.getByRole("textbox", { name: "도서 검색어" }).fill("invalid");
  await expect(
    page.getByText("ISBN-10/13 형식과 체크디지트를 확인하세요.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".book-card")).toHaveCount(0);
  await page.getByRole("button", { name: "제목", exact: true }).click();
  await page.getByRole("textbox", { name: "도서 검색어" }).fill("Clean");
  await page.getByPlaceholder("저자 부분검색").fill("Martin");
  await page.getByPlaceholder("출판사 부분검색").fill("Prentice");
  await expect(page.locator(".book-card")).toHaveCount(1);
  await page.getByLabel("발행연도 시작", { exact: true }).fill("2020");
  await expect(page.locator(".book-card")).toHaveCount(0);
  const books = Array.from({ length: 25 }, (_, i) => ({
    bookId: 600 + i, isbn: null, title: "테스트 카탈로그 " + i,
    publisher: "테스트 출판사", publicationYear: 2026, categoryCode: "DEMO_GENERAL",
  }));
  api.data.books.push(...books);
  api.data.copies.push(...books.map((book, i) => ({
    copyId: 6000 + i, bookId: book.bookId, copyCode: "TEST-" + i, managementStatus: "ACTIVE" as const,
  })));
  api.data.bookAuthors.push(...books.map((book) => ({ bookId: book.bookId, authorId: 701 })));
  await page.reload();
  await page
    .getByRole("textbox", { name: "도서 검색어" })
    .fill("테스트 카탈로그");
  await expect(page.locator(".book-card")).toHaveCount(20);
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page.locator(".book-card")).toHaveCount(5);
});

test("staff catalog honors ISBN-10 and ISBN-13 deep links", async ({ page }) => {
  const api = await installApiFixture(page);
  const noIsbnBook = { ...api.data.books[0], bookId: 999, title: "ISBN 없는 자료", isbn: null };
  api.data.books.push(noIsbnBook);
  api.data.copies.push({ copyId: 9999, bookId: 999, copyCode: "QA-COPY", managementStatus: "ACTIVE" });

  for (const [role, path] of [
    ["LIBRARIAN", "/librarian/books"],
    ["ADMIN", "/admin/books"],
  ] as const) {
    api.setRole(role);
    await page.goto(path + "?by=isbn&q=0-13-235088-2");
    const search = page.getByRole("textbox", { name: "도서 검색" });
    const rows = page.locator("tbody");
    for (const isbn of ["0-13-235088-2", "9780132350884", "978-0-13-235088-4", "978 0 13 235088 4"]) {
      await search.fill(isbn);
      await expect(rows.getByText("Clean Code", { exact: true })).toBeVisible();
      await expect(rows.getByText("ISBN 없는 자료")).toHaveCount(0);
      expect(new URL(page.url()).searchParams.get("by")).toBe("isbn");
      expect(new URL(page.url()).searchParams.get("q")).toBe(isbn);
    }
    await search.fill("9780132350885");
    await expect(page.getByText("ISBN-10/13 형식과 체크디지트를 확인하세요.")).toBeVisible();
    await expect(rows.getByText("Clean Code")).toHaveCount(0);

    await page.goto(path + "?by=title&q=ISBN%20없는");
    await expect(rows.getByText("ISBN 없는 자료")).toBeVisible();
    await page.goto(path + "?by=author&q=Martin");
    await expect(rows.getByText("Clean Code", { exact: true })).toBeVisible();
    await expect(rows.getByText("ISBN 없는 자료")).toHaveCount(0);
  }
});
