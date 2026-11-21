import { expect, test } from "@playwright/test";
import { apiCall, expectStatus, loginSeed, makeUser, signup, login, logout } from "./helpers";

test("BUG-01 & BUG-02: borrowed copy status change is blocked (including DAMAGED) and copy_code follows category-book-seq", async ({ page }) => {
  await loginSeed(page, "librarian");
  const stateRes = expectStatus(await apiCall(page, "GET", "/library/state"), 200);
  const scienceBook = stateRes.books.find((b: any) => b.categoryCode === "SCIENCE" && b.bookId === 7);
  expect(scienceBook).toBeTruthy();

  // BUG-02: adding a copy to SCIENCE book #7 (which has SC-0007-01, SC-0007-02) must produce SC-0007-03
  const newCopy = expectStatus(await apiCall(page, "POST", `/books/${scienceBook.bookId}/copies`), 201);
  expect(newCopy.copyCode).toBe("SC-0007-03");

  // Checkout the new copy to a fresh member
  const member = makeUser("bug01");
  await logout(page);
  await signup(page, member);
  const memberMe = await login(page, member.loginId, member.password);
  await logout(page);
  await loginSeed(page, "librarian");

  expectStatus(
    await apiCall(page, "POST", "/loans/checkout", {
      memberUserId: memberMe.userId,
      copyId: newCopy.copyId,
      requestId: crypto.randomUUID(),
    }),
    201,
  );

  // BUG-01: changing borrowed copy to DAMAGED, ACTIVE, or RETIRED must all be rejected with 409
  for (const targetStatus of ["DAMAGED", "ACTIVE", "RETIRED"]) {
    const res = await apiCall(page, "PATCH", `/books/copies/${newCopy.copyId}/status`, {
      status: targetStatus,
      reason: "대출 중 상태 변경 차단 검증",
    });
    expect(res.status).toBe(409);
  }
});

test("BUG-03 & BUG-04 & BUG-05: UI regressions against live backend", async ({ page }) => {
  const member = makeUser("bug03");
  await signup(page, member);
  await page.goto("/login");
  await page.getByLabel("로그인 ID").fill(member.loginId);
  await page.getByLabel("비밀번호", { exact: true }).fill(member.password);
  await page.locator("form button").last().click();
  await expect(page).toHaveURL(/\/user\/books/);

  // BUG-04: no duplicate 상세 검색 / 이용 이력
  const nav = page.getByRole("navigation", { name: "주요 메뉴" });
  await nav.getByRole("button", { name: "도서 검색" }).hover();
  await expect(nav.getByRole("link", { name: "상세 검색" })).toHaveCount(0);

  // BUG-03: empty loans links to /user/books
  await page.goto("/user/loans");
  await expect(page.getByRole("link", { name: "사서 화면 보기" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "도서 검색하기" })).toHaveAttribute("href", "/user/books");

  // BUG-05: Admin sees masked label instead of 이름 없음
  await logout(page);
  await loginSeed(page, "admin");
  await page.goto("/admin/members");
  await page.getByLabel("일반 회원(MEMBER) 상태도 함께 보기").check();
  await expect(page.getByText("일반 회원 (개인정보 비공개)").first()).toBeVisible();
  await expect(page.getByText("이름 없음")).toHaveCount(0);
});
