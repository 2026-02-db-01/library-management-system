import { expect, test } from '@playwright/test';
import {
  apiCall,
  createBookCopy,
  expectStatus,
  findOverdueMemberId,
  loginSeed,
  makeUser,
  signup,
  requestId,
  state,
} from './helpers';

test('회원당 대출 5권 제한과 동일 소장본 중복 대출이 차단된다', async ({ page }) => {
  const member = makeUser('livelimit');
  await signup(page, member);
  const me = expectStatus(
    await apiCall(page, 'POST', '/auth/login', { loginId: member.loginId, password: member.password }),
    200,
  );
  await loginSeed(page, 'librarian');

  const copies: number[] = [];
  for (let i = 0; i < 6; i += 1) {
    const created = await createBookCopy(page, `LIVE한도${i}`);
    copies.push(created.copyId);
  }

  for (const copyId of copies.slice(0, 5)) {
    expectStatus(
      await apiCall(page, 'POST', '/loans/checkout', {
        memberUserId: me.userId,
        copyId,
        requestId: requestId(),
      }),
      201,
    );
  }
  const sixth = await apiCall(page, 'POST', '/loans/checkout', {
    memberUserId: me.userId,
    copyId: copies[5],
    requestId: requestId(),
  });
  expect(sixth.status).toBe(409);
  expect(JSON.stringify(sixth.body)).toContain('MAX_LOANS_EXCEEDED');

  const active = (await state(page)).loans.filter(
    (loan: any) => loan.memberUserId === me.userId && loan.returnedAt === null && !loan.isCancelled,
  );
  expect(active).toHaveLength(5);

  const other = makeUser('livedup');
  await signup(page, other);
  const otherMe = expectStatus(
    await apiCall(page, 'POST', '/auth/login', { loginId: other.loginId, password: other.password }),
    200,
  );
  await loginSeed(page, 'librarian');
  const duplicate = await apiCall(page, 'POST', '/loans/checkout', {
    memberUserId: otherMe.userId,
    copyId: copies[0],
    requestId: requestId(),
  });
  expect(duplicate.status).toBe(409);
  expect(JSON.stringify(duplicate.body)).toMatch(/COPY_UNAVAILABLE|DUPLICATE_RECORD/);
});

test('연체 회원은 새 대출이 거부된다', async ({ page }) => {
  await loginSeed(page, 'librarian');
  const data = await state(page);
  const overdueMemberId = findOverdueMemberId(data);
  expect(overdueMemberId, '격리 테스트 DB의 시드 데이터에 연체 회원이 있어야 한다').toBeDefined();

  const { copyId } = await createBookCopy(page, 'LIVE연체');
  const result = await apiCall(page, 'POST', '/loans/checkout', {
    memberUserId: overdueMemberId,
    copyId,
    requestId: requestId(),
  });
  expect(result.status).toBe(403);
  expect(JSON.stringify(result.body)).toContain('OVERDUE_BLOCKED');
});
