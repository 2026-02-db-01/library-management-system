import { expect, test } from '@playwright/test';
import {
  activeLoanFor,
  apiCall,
  createBookCopy,
  expectStatus,
  loginSeed,
  makeUser,
  requestId,
  signup,
  state,
} from './helpers';

test('네트워크 실패 시 오류를 표시하고 재시도하면 실제 데이터를 복원한다', async ({ page }) => {
  const user = makeUser('livenet');
  await signup(page, user);
  expectStatus(
    await apiCall(page, 'POST', '/auth/login', { loginId: user.loginId, password: user.password }),
    200,
  );

  await page.route('**/api/v1/library/state', (route) => route.abort('failed'));
  await page.goto('/user/books');
  await expect(page.locator('p[role=alert]')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('책담').first()).toBeVisible();

  await page.unroute('**/api/v1/library/state');
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.locator('p[role=alert]')).toHaveCount(0, { timeout: 15000 });
  expectStatus(await apiCall(page, 'GET', '/library/state'), 200);
});

test('타임아웃도 성공으로 위장하지 않고 오류를 표시한다', async ({ page }) => {
  const user = makeUser('livetimeout');
  await signup(page, user);
  expectStatus(
    await apiCall(page, 'POST', '/auth/login', { loginId: user.loginId, password: user.password }),
    200,
  );

  await page.route('**/api/v1/library/state', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 17_000));
    await route.continue();
  });
  await page.goto('/user/books');
  await expect(page.locator('p[role=alert]')).toBeVisible({ timeout: 30_000 });
});

test('같은 요청 UUID 재전송은 새 대출을 만들지 않고 기존 결과를 반환한다', async ({ page }) => {
  const member = makeUser('liveidem');
  await signup(page, member);
  const me = expectStatus(
    await apiCall(page, 'POST', '/auth/login', { loginId: member.loginId, password: member.password }),
    200,
  );
  await loginSeed(page, 'librarian');
  const { copyId } = await createBookCopy(page, 'LIVE멱등');
  const idemRequestId = requestId();

  const first = expectStatus(
    await apiCall(page, 'POST', '/loans/checkout', { memberUserId: me.userId, copyId, requestId: idemRequestId }),
    201,
  );
  const replay = expectStatus(
    await apiCall(page, 'POST', '/loans/checkout', { memberUserId: me.userId, copyId, requestId: idemRequestId }),
    201,
  );
  expect(replay.loanId).toBe(first.loanId);
  expect((await state(page)).loans.filter((loan: any) => loan.copyId === copyId && loan.returnedAt === null)).toHaveLength(1);
  expect(activeLoanFor(await state(page), copyId).loanId).toBe(first.loanId);
});
