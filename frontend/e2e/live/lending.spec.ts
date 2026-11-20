import { expect, test } from '@playwright/test';
import {
  activeLoanFor,
  apiCall,
  createBookCopy,
  expectStatus,
  loginSeed,
  loginUi,
  makeUser,
  requestId,
  signup,
  state,
} from './helpers';

test('사서 대출 → 회원 대출 현황 → 연장 → 반납이 실제 DB에 반영된다', async ({ page }) => {
  const member = makeUser('livelend');
  await signup(page, member);
  const memberSession = expectStatus(
    await apiCall(page, 'POST', '/auth/login', { loginId: member.loginId, password: member.password }),
    200,
  );

  await loginSeed(page, 'librarian');
  const { copyId, copyCode } = await createBookCopy(page, 'LIVE대출');
  const checkoutRequestId = requestId();
  const checkout = expectStatus(
    await apiCall(page, 'POST', '/loans/checkout', {
      memberUserId: memberSession.userId,
      copyId,
      requestId: checkoutRequestId,
    }),
    201,
  );
  expect(checkout.ok).toBe(true);
  expect(typeof checkout.loanId).toBe('number');
  const loanId = checkout.loanId;

  await loginUi(page, member.loginId, member.password);
  await page.goto('/user/loans');
  await expect(page.getByText(copyCode, { exact: false }).first()).toBeVisible({ timeout: 15000 });

  const before = activeLoanFor(await state(page), copyId);
  expect(before.loanId).toBe(loanId);
  const renew = expectStatus(
    await apiCall(page, 'POST', `/loans/${loanId}/renew`, { requestId: requestId() }),
    200,
  );
  expect(renew.ok).toBe(true);
  const renewed = activeLoanFor(await state(page), copyId);
  expect(renewed.currentDueDate.slice(0, 10) > before.currentDueDate.slice(0, 10)).toBe(true);

  await loginSeed(page, 'librarian');
  expectStatus(
    await apiCall(page, 'POST', `/loans/${loanId}/return`, { damaged: false, reason: '실시간 E2E 반납' }),
    200,
  );
  const after = await state(page);
  expect(activeLoanFor(after, copyId)).toBeUndefined();
  expect(after.loans.find((loan: any) => loan.loanId === loanId).returnedAt).toBeTruthy();
});
