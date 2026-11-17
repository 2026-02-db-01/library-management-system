import { test, expect } from "@playwright/test";
test("catalog ISBN normalization, combined filters and twenty-row pagination", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const { useLibraryStore: s } = await import("/src/store/libraryStore.ts");
    s.getState().requestRoleSwitch("MEMBER", "/");
    s.getState().completeRoleSwitch();
  });
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
  await page.evaluate(async () => {
    const { useLibraryStore: s } = await import("/src/store/libraryStore.ts");
    const d = s.getState();
    const books = Array.from({ length: 25 }, (_, i) => ({
      bookId: 600 + i,
      isbn: null,
      title: `테스트 카탈로그 ${String(i).padStart(2, "0")}`,
      publisher: "테스트 출판사",
      publicationYear: 2026,
      categoryCode: "DEMO_GENERAL",
    }));
    s.setState({
      books: [...d.books, ...books],
      copies: [
        ...d.copies,
        ...books.map((b, i) => ({
          copyId: 6000 + i,
          bookId: b.bookId,
          copyCode: `TEST-${i}`,
          managementStatus: "ACTIVE",
        })),
      ],
      bookAuthors: [
        ...d.bookAuthors,
        ...books.map((b) => ({ bookId: b.bookId, authorId: 701 })),
      ],
    });
  });
  await page.reload();
  await page
    .getByRole("textbox", { name: "도서 검색어" })
    .fill("테스트 카탈로그");
  await expect(page.locator(".book-card")).toHaveCount(20);
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page.locator(".book-card")).toHaveCount(5);
});
