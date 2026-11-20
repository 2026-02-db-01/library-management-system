import { expect, test } from '@playwright/test';
import { apiCall, createBookCopy, expectStatus, loginSeed, makeUser, requestId, signup, state } from './helpers';

test('제적 처리된 소장본의 반납 복원(UNDO_RETURN)은 409로 거부되고 이력도 남지 않는다', async ({ page }) => {
  const member = makeUser('liveretired');
  await signup(page, member);
  const me = expectStatus(
    await apiCall(page, 'POST', '/auth/login', { loginId: member.loginId, password: member.password }),
    200,
  );
  await loginSeed(page, 'librarian');

  const { copyId } = await createBookCopy(page, 'LIVE제적');
  const loan = expectStatus(
    await apiCall(page, 'POST', '/loans/checkout', {
      memberUserId: me.userId,
      copyId,
      requestId: requestId(),
    }),
    201,
  );
  expectStatus(await apiCall(page, 'POST', `/loans/${loan.loanId}/return`, {}), 200);

  const correctionsBefore = (await state(page)).corrections.length;
  expectStatus(
    await apiCall(page, 'PATCH', `/books/copies/${copyId}/status`, {
      status: 'RETIRED',
      reason: '실시간 E2E 제적 처리',
    }),
    200,
  );

  const reversal = await apiCall(page, 'POST', `/loans/${loan.loanId}/correct`, {
    type: 'UNDO_RETURN',
    reason: '제적 소장본 복원 시도',
    physicalConfirmed: true,
    requestId: requestId(),
  });
  expect(reversal.status).toBe(409);
  expect(JSON.stringify(reversal.body)).toContain('RETIRED_COPY');

  const after = await state(page);
  expect(after.corrections).toHaveLength(correctionsBefore);
  expect(after.loans.find((item: any) => item.loanId === loan.loanId).returnedAt).toBeTruthy();
  expect(after.copies.find((item: any) => item.copyId === copyId).managementStatus).toBe('RETIRED');
});
