import { expect, test } from '@playwright/test';
import { apiCall, createBookCopy, expectStatus, loginSeed, state } from './helpers';

test('사서가 등록한 도서가 검색·상세에 표시되고 소장본 관리가 DB에 반영된다', async ({ page }) => {
  await loginSeed(page, 'librarian');
  const { bookId, copyId, title } = await createBookCopy(page, 'LIVE카탈로그');

  await page.goto('/librarian/books');
  await page.locator('input[placeholder*="ISBN"]').fill(title);
  await expect(page.getByText(title, { exact: false }).first()).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveURL(/q=/);

  const detail = expectStatus(await apiCall(page, 'GET', `/books/${bookId}`), 200);
  expect(detail.bookId).toBe(bookId);
  expect(detail.copies.map((copy: any) => copy.copyId)).toContain(copyId);

  const damaged = expectStatus(
    await apiCall(page, 'PATCH', `/books/copies/${copyId}/status`, { status: 'DAMAGED', reason: '실시간 E2E 손상 처리' }),
    200,
  );
  expect(damaged.managementStatus).toBe('DAMAGED');
  expectStatus(
    await apiCall(page, 'PATCH', `/books/copies/${copyId}/status`, { status: 'ACTIVE', reason: '실시간 E2E 복구' }),
    200,
  );

  const snapshot = await state(page);
  expect(snapshot.books.some((book: any) => book.bookId === bookId)).toBe(true);
  expect(snapshot.copies.find((copy: any) => copy.copyId === copyId).managementStatus).toBe('ACTIVE');
});

test('없는 도서 조회는 404 코드를 반환하고 존재하는 도서와 구분된다', async ({ page }) => {
  await loginSeed(page, 'librarian');
  const missing = await apiCall(page, 'GET', '/books/999999999');
  expect(missing.status).toBe(404);
  expect(missing.body.code ?? missing.body.detail?.code).toBeTruthy();
});
