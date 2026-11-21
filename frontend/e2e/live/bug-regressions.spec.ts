import { expect, test } from "@playwright/test";
import { apiCall, expectStatus, loginSeed, makeUser, requestId, signup, login, logout, state } from "./helpers";

test("BUG-01 & BUG-02: borrowed copy status change is blocked, concurrent copy creation is unique, and damaged-return/repair transitions stay consistent", async ({ page }) => {
  await loginSeed(page, "librarian");
  const stateRes = expectStatus(await apiCall(page, "GET", "/library/state"), 200);
  const scienceBook = stateRes.books.find((b: any) => b.categoryCode === "SCIENCE" && b.bookId === 7);
  expect(scienceBook).toBeTruthy();

  // BUG-02: concurrent copy creation on SCIENCE book #7 (existing SC-0007-01, SC-0007-02)
  const concurrentCopies = await Promise.all([
    apiCall(page, "POST", `/books/${scienceBook.bookId}/copies`),
    apiCall(page, "POST", `/books/${scienceBook.bookId}/copies`),
    apiCall(page, "POST", `/books/${scienceBook.bookId}/copies`),
  ]);
  for (const res of concurrentCopies) {
    expect(res.status).toBe(201);
  }
  const createdCodes = concurrentCopies.map((r) => r.body.copyCode).sort();
  expect(createdCodes).toEqual(["SC-0007-03", "SC-0007-04", "SC-0007-05"]);

  const targetCopyId = concurrentCopies[0].body.copyId;

  // Checkout the new copy to a fresh member
  const member = makeUser("bug01");
  await logout(page);
  await signup(page, member);
  const memberMe = await login(page, member.loginId, member.password);
  await logout(page);
  await loginSeed(page, "librarian");

  const loan = expectStatus(
    await apiCall(page, "POST", "/loans/checkout", {
      memberUserId: memberMe.userId,
      copyId: targetCopyId,
      requestId: requestId(),
    }),
    201,
  );

  // BUG-01: changing borrowed copy to DAMAGED, ACTIVE, or RETIRED must all be rejected with 409
  for (const targetStatus of ["DAMAGED", "ACTIVE", "RETIRED"]) {
    const res = await apiCall(page, "PATCH", `/books/copies/${targetCopyId}/status`, {
      status: targetStatus,
      reason: "대출 중 상태 변경 차단 검증",
    });
    expect(res.status).toBe(409);
  }

  // Damaged return transition (BP-02): return with damaged=true -> copy becomes DAMAGED and unborrowable
  expectStatus(
    await apiCall(page, "POST", `/loans/${loan.loanId}/return`, {
      damaged: true,
      reason: "반납 시 표지 파손 확인",
      requestId: requestId(),
    }),
    200,
  );

  const afterDamagedReturn = await state(page);
  expect(afterDamagedReturn.copies.find((c: any) => c.copyId === targetCopyId).managementStatus).toBe("DAMAGED");
  expect(afterDamagedReturn.occupiedCopyIds).not.toContain(targetCopyId);

  const blockedCheckout = await apiCall(page, "POST", "/loans/checkout", {
    memberUserId: memberMe.userId,
    copyId: targetCopyId,
    requestId: requestId(),
  });
  expect(blockedCheckout.status).toBe(409);

  // Repair transition (BP-06): DAMAGED -> ACTIVE -> borrowable again
  expectStatus(
    await apiCall(page, "PATCH", `/books/copies/${targetCopyId}/status`, {
      status: "ACTIVE",
      reason: "수리 완료",
    }),
    200,
  );
  const recheckout = expectStatus(
    await apiCall(page, "POST", "/loans/checkout", {
      memberUserId: memberMe.userId,
      copyId: targetCopyId,
      requestId: requestId(),
    }),
    201,
  );
  expectStatus(
    await apiCall(page, "POST", `/loans/${recheckout.loanId}/return`, {
      damaged: false,
      requestId: requestId(),
    }),
    200,
  );
  const afterNormalReturn = await state(page);
  expect(afterNormalReturn.copies.find((c: any) => c.copyId === targetCopyId).managementStatus).toBe("ACTIVE");
  expect(afterNormalReturn.occupiedCopyIds).not.toContain(targetCopyId);
});

test("BUG-03 & BUG-04 & BUG-05: UI regressions, logout session termination, and Admin MEMBER PII masking", async ({ page }) => {
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

  // Logout terminates session
  await logout(page);
  expectStatus(await apiCall(page, "GET", "/auth/me"), 401);

  // BUG-05: Admin API masks MEMBER PII and UI renders clear privacy label instead of 이름 없음
  await loginSeed(page, "admin");
  const adminState = await state(page);
  const memberRow = adminState.users.find((u: any) => u.role === "MEMBER");
  expect(memberRow).toBeTruthy();
  expect(memberRow.loginId).toBeNull();
  expect(memberRow.fullName).toBeNull();
  expect(memberRow.contact).toBeNull();

  await page.goto("/admin/members");
  await page.getByLabel("일반 회원(MEMBER) 상태도 함께 보기").check();
  await expect(page.getByText("일반 회원 (개인정보 비공개)").first()).toBeVisible();
  await expect(page.getByText("이름 없음")).toHaveCount(0);
});
