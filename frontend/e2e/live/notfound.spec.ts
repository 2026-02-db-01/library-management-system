import { expect, test } from '@playwright/test';
import { apiCall, expectStatus, makeUser, signup } from './helpers';

test('정상 라우트, 없는 페이지, 없는 리소스, 배포 오류 404를 구분한다', async ({ page }) => {
  const loginResponse = await page.goto('/login');
  expect(loginResponse?.status()).toBe(200);
  await expect(page.getByLabel('로그인 ID')).toBeVisible();

  const missingPage = await page.goto('/live-no-such-page');
  expect(missingPage?.status()).toBe(200);
  await expect(page.getByText('요청한 페이지를 찾을 수 없습니다')).toBeVisible();
  await expect(page.getByText('404 · PAGE NOT FOUND')).toBeVisible();
});

test('리소스 404는 코드를 담고, 정상 리소스는 200을 반환한다', async ({ page }) => {
  const user = makeUser('livenf');
  await signup(page, user);
  expectStatus(
    await apiCall(page, 'POST', '/auth/login', { loginId: user.loginId, password: user.password }),
    200,
  );
  const missing = await apiCall(page, 'GET', '/books/999999999');
  expect(missing.status).toBe(404);
  expect(missing.body.code ?? missing.body.detail?.code).toBeTruthy();
  expectStatus(await apiCall(page, 'GET', '/library/state'), 200);
});

test('정적 호스트의 HTML 404 응답에서도 앱은 종료되지 않고 오류를 표시한다', async ({ page }) => {
  const user = makeUser('livehtml');
  await signup(page, user);
  expectStatus(
    await apiCall(page, 'POST', '/auth/login', { loginId: user.loginId, password: user.password }),
    200,
  );
  await page.goto('/user/books');
  await expect(page.getByText('책담').first()).toBeVisible();

  await page.route('**/api/v1/library/state', (route) =>
    route.fulfill({ status: 404, contentType: 'text/html', body: '<html><body>404 Not Found</body></html>' }),
  );
  await page.reload();
  await expect(page.locator('p[role=alert]')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('책담').first()).toBeVisible();

  await page.unroute('**/api/v1/library/state');
  await page.reload();
  await expect(page.locator('p[role=alert]')).toHaveCount(0, { timeout: 15000 });
});
