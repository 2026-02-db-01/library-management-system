import { test, expect } from "@playwright/test";
test("checkout, renewal rollback, successful renewal and return through controls", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const { useLibraryStore: s } = await import("/src/store/libraryStore.ts");
    s.getState().resetDemo();
    s.getState().requestRoleSwitch("LIBRARIAN", "/");
    s.getState().completeRoleSwitch();
  });
  await page.goto("/librarian/checkout");
  await page
    .getByRole("combobox", { name: "대출 회원", exact: true })
    .selectOption("1003");
  await page.getByRole("button", { name: "대출 처리", exact: true }).click();
  await expect(
    page.getByText("대출 완료 · 반납예정일", { exact: false }),
  ).toBeVisible();
  await page.evaluate(async () => {
    const { useLibraryStore: s } = await import("/src/store/libraryStore.ts");
    s.getState().requestRoleSwitch("MEMBER", "/");
    s.getState().completeRoleSwitch();
  });
  await page.goto("/user/loans");
  await page.getByLabel("데모 회원 선택", { exact: true }).selectOption("1003");
  await page
    .getByRole("button", { name: "오류 상황 시연", exact: true })
    .click();
  await expect(
    page.getByText("전체 Mock 변경을 롤백했습니다.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "7일 연장", exact: true }).click();
  await expect(
    page.getByText("7일 연장 완료 ·", { exact: false }),
  ).toBeVisible();
  await page.evaluate(async () => {
    const { useLibraryStore: s } = await import("/src/store/libraryStore.ts");
    s.getState().requestRoleSwitch("LIBRARIAN", "/");
    s.getState().completeRoleSwitch();
  });
  await page.goto("/librarian/returns");
  const row = page.getByRole("row").filter({ hasText: "이서윤" });
  await row.getByRole("button", { name: "반납 처리", exact: true }).click();
  await expect(
    page.getByText("반납 완료 · 신규 대출 정지를 재계산했습니다.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(row).toHaveCount(0);
});
