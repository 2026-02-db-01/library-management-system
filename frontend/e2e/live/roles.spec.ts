import { expect, test } from '@playwright/test';
import { apiCall, expectStatus, loginSeed, loginUi, makeUser, signup, WEB_BASE } from './helpers';

test('MEMBER는 사서 화면과 사서 쓰기 API에 접근할 수 없다', async ({ page }) => {
  const user = makeUser('liverole');
  await signup(page, user);
  await loginUi(page, user.loginId, user.password);

  await page.goto('/librarian/books');
  await expect(page).toHaveURL(`${WEB_BASE}/`);
  expectStatus(await apiCall(page, 'POST', '/books', { title: '권한없는 도서' }), 403);
  expectStatus(await apiCall(page, 'POST', '/loans/checkout', { memberUserId: 1, copyId: 1 }), 403);
  expectStatus(await apiCall(page, 'GET', '/users/staff/history'), 403);
});

test('LIBRARIAN은 관리자 화면과 직원 생성 API에 접근할 수 없다', async ({ page }) => {
  await loginSeed(page, 'librarian');
  await page.goto('/admin');
  await expect(page).toHaveURL(`${WEB_BASE}/`);
  expectStatus(
    await apiCall(page, 'POST', '/users/staff', {
      loginId: 'unauthorized_staff',
      fullName: '권한없음',
      contact: '01099998888',
      role: 'ADMIN',
      password: 'SomeLongPassword!1',
    }),
    403,
  );
});

test('ADMIN은 사서 전용 쓰기 권한을 자동으로 갖지 않는다 (BR-10)', async ({ page }) => {
  await loginSeed(page, 'admin');
  await page.goto('/librarian/checkout');
  await expect(page).toHaveURL(`${WEB_BASE}/`);
  expectStatus(await apiCall(page, 'POST', '/books', { title: '관리자 쓰기 시도' }), 403);
  expectStatus(await apiCall(page, 'POST', '/loans/checkout', { memberUserId: 1, copyId: 1 }), 403);
  expectStatus(await apiCall(page, 'GET', '/users/staff/history'), 200);
});
