import { expect, test } from '@playwright/test';
import { API_BASE, apiCall, expectStatus, loginUi, makeUser, signup } from './helpers';

test('비밀번호 변경은 기존 세션을 무효화하고 이전 비밀번호 로그인을 거부한다', async ({ page }) => {
  const user = makeUser('livepwd');
  await signup(page, user);
  expectStatus(
    await apiCall(page, 'POST', '/auth/login', { loginId: user.loginId, password: user.password }),
    200,
  );
  const cookies = await page.context().cookies();
  const oldToken = cookies.find((cookie) => cookie.name === 'access_token')?.value;
  expect(oldToken, '로그인 쿠키가 있어야 한다').toBeTruthy();

  await page.goto('/account');
  await page.locator('input[name="currentPassword"]').fill(user.password);
  await page.locator('input[name="newPassword"]').fill('ChangedPassword!2026');
  await page.locator('input[name="confirmPassword"]').fill('ChangedPassword!2026');
  await page.getByRole('button', { name: '비밀번호 변경' }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 15000 });
  await expect(page.getByText('비밀번호를 변경했습니다')).toBeVisible();

  const replay = await page.request.fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${oldToken}` },
  });
  expect(replay.status()).toBe(401);

  const oldLogin = await apiCall(page, 'POST', '/auth/login', { loginId: user.loginId, password: user.password });
  expect(oldLogin.status).toBe(401);
  expectStatus(
    await apiCall(page, 'POST', '/auth/login', { loginId: user.loginId, password: 'ChangedPassword!2026' }),
    200,
  );

  await loginUi(page, user.loginId, 'ChangedPassword!2026');
  await expect(page).toHaveURL(/\/user\/books$/);
});
