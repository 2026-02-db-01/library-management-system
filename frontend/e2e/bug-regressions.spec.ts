import { expect, test } from "@playwright/test";
import { installApiFixture } from "./api-fixture";

test("BUG-03: member empty loans page links to book search instead of librarian checkout", async ({ page }) => {
  const api = await installApiFixture(page);
  api.setRole("MEMBER");
  api.data.loans = [];
  await page.goto("/user/loans");
  await expect(page.getByText("현재 대출 중인 도서가 없습니다")).toBeVisible();
  await expect(page.getByRole("link", { name: "사서 화면 보기" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "도서 검색하기" })).toHaveAttribute("href", "/user/books");
  await page.goto("/user/books");
  await expect(page.getByRole("link", { name: "사서 대출 화면 보기" })).toHaveCount(0);
});

test("BUG-04: navigation has no duplicate search/history links and admin sidebar uses Korean read-only labels", async ({ page }) => {
  const api = await installApiFixture(page);
  api.setRole("MEMBER");
  await page.goto("/user/books");
  const nav = page.getByRole("navigation", { name: "주요 메뉴" });
  await nav.getByRole("button", { name: "도서 검색" }).hover();
  await expect(nav.getByRole("link", { name: "상세 검색" })).toHaveCount(0);
  await nav.getByRole("button", { name: "내 서재" }).hover();
  await expect(nav.getByRole("link", { name: "이용 이력" })).toHaveCount(0);

  api.setRole("ADMIN");
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: "도서 조회" })).toBeVisible();
  await expect(page.getByRole("link", { name: "저자 조회" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Authors" })).toHaveCount(0);
});

test("BUG-05: admin member list clearly labels masked member PII instead of 이름 없음", async ({ page }) => {
  const api = await installApiFixture(page);
  api.setRole("ADMIN");
  api.data.users.push({
    userId: 99,
    loginId: null,
    fullName: null,
    contact: null,
    role: "MEMBER",
    accountStatus: "ACTIVE",
    createdAt: "2026-01-01T00:00:00Z",
    borrowingSuspendedUntil: null,
  });
  await page.goto("/admin/members");
  await page.getByLabel("일반 회원(MEMBER) 상태도 함께 보기").check();
  await expect(page.getByText("일반 회원 (개인정보 비공개)")).toBeVisible();
  await expect(page.getByText("회원 #99")).toBeVisible();
  await expect(page.getByText("이름 없음")).toHaveCount(0);
});

test("BUG-01: librarian copy status page disables status changes for actively borrowed copies", async ({ page }) => {
  const api = await installApiFixture(page);
  api.setRole("LIBRARIAN");
  await page.goto("/librarian/copies");
  const borrowedRow = page.locator("tr", { hasText: "대출 중" }).first();
  await expect(borrowedRow).toBeVisible();
  await expect(borrowedRow.getByRole("button", { name: /대출 중 \(변경 불가\)/ })).toBeDisabled();
});
