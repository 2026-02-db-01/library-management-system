import { installApiFixture } from "./api-fixture";
import { test, expect } from "@playwright/test";
test("checkout, renewal conflict, successful renewal and return through controls", async ({
  page,
}) => {
  const api = await installApiFixture(page);
  api.setRole("LIBRARIAN");
  await page.goto("/librarian/checkout");
  await page
    .getByRole("combobox", { name: "대출 회원", exact: true })
    .selectOption("1003");
  await page.getByRole("button", { name: "대출 처리", exact: true }).click();
  await expect(
    page.getByText("대출 완료 · 반납예정일", { exact: false }),
  ).toBeVisible();
  api.setRole("MEMBER", 1003);
  await page.goto("/user/loans");
  api.failRenewal(true);
  await page
    .getByRole("button", { name: "7일 연장", exact: true })
    .click();
  await expect(
    page.getByText("연장 처리 충돌", { exact: false }),
  ).toBeVisible();
  expect(api.data.renewals.some((item) => item.loanId === 9999)).toBe(false);
  api.failRenewal(false);
  await page.getByRole("button", { name: "7일 연장", exact: true }).click();
  await expect(
    page.getByText("7일 연장 완료 ·", { exact: false }),
  ).toBeVisible();
  api.setRole("LIBRARIAN");
  await page.goto("/librarian/returns");
  const row = page.getByRole("row").filter({ hasText: "이서윤" });
  await row.getByRole("button", { name: "반납 처리", exact: true }).click();
  await page.getByRole("button", { name: "일반 반납 확정" }).click();
  await expect(
    page.getByText("반납 완료 · 신규 대출 정지를 재계산했습니다.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(row).toHaveCount(0);
});


test("retry reuses request ID after lost response", async ({ page }) => {
  const api = await installApiFixture(page);
  api.setRole("LIBRARIAN");
  api.loseNextCheckoutResponse();
  await page.goto("/librarian/checkout");
  await page.getByRole("combobox", { name: "대출 회원", exact: true }).selectOption("1003");
  await page.getByRole("button", { name: "대출 처리", exact: true }).click();
  await expect(page.getByText(/처리 결과를 확인하지 못했습니다/)).toBeVisible();
  await expect(page.getByRole("button", { name: "기존 대출 요청 다시 시도" })).toBeEnabled();
  expect(api.data.loans.filter((loan) => loan.loanId === 9999)).toHaveLength(1);
  await page.getByRole("button", { name: "기존 대출 요청 다시 시도" }).click();
  await expect(page.getByText(/대출 완료 · 반납예정일/)).toBeVisible();
  const attempts = api.requests.filter(({ path }) => path === "/loans/checkout");
  expect(attempts).toHaveLength(2);
  expect(attempts[0].body.requestId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(attempts[1].body).toEqual(attempts[0].body);
  expect(api.data.loans.filter((loan) => loan.loanId === 9999)).toHaveLength(1);
});
