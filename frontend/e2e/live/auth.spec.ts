import { expect, test } from '@playwright/test';
import { apiCall, expectStatus, loginUi, makeUser, signup } from './helpers';

test('회원가입 → 로그인 → 새로고침 세션 유지 → 로그아웃 → 재로그인', async ({ page }) => {
  const user = makeUser('liveauth');
  await page.goto('/signup');
  await page.getByLabel('로그인 ID').fill(user.loginId);
  await page.getByLabel('비밀번호', { exact: true }).fill(user.password);
  await page.getByLabel('비밀번호 확인').fill(user.password);
  await page.getByLabel('이름').fill(user.fullName);
  await page.getByLabel('휴대전화번호').fill(user.contact);
  await page.getByRole('button', { name: '회원가입' }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 15000 });

  await loginUi(page, user.loginId, user.password);
  await expect(page).toHaveURL(/\/user\/books$/);
  expectStatus(await apiCall(page, 'GET', '/auth/me'), 200);

  await page.reload();
  await expect(page).toHaveURL(/\/user\/books$/);
  expectStatus(await apiCall(page, 'GET', '/auth/me'), 200);

  expectStatus(await apiCall(page, 'POST', '/auth/logout'), 204);
  expectStatus(await apiCall(page, 'GET', '/auth/me'), 401);

  await loginUi(page, user.loginId, user.password);
  await expect(page).toHaveURL(/\/user\/books$/);
});

test('잘못된 비밀번호는 인증되지 않고 세션이 생성되지 않는다', async ({ page }) => {
  const user = makeUser('livebad');
  await signup(page, user);
  await page.goto('/login');
  await page.getByLabel('로그인 ID').fill(user.loginId);
  await page.getByLabel('비밀번호', { exact: true }).fill('WrongPassword!2026');
  await page.locator('form button').last().click();
  await expect(page).toHaveURL(/\/login$/);
  expectStatus(await apiCall(page, 'GET', '/auth/me'), 401);
});
