import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

/** 실제 FastAPI 주소. Vite 개발 프록시(/api)가 아니라 별도 API 오리진을 사용한다. */
export const API_BASE = (process.env.LIVE_API_BASE_URL ?? 'http://127.0.0.1:8001/api/v1').replace(/\/+$/, '');
if (!API_BASE.endsWith('/api/v1')) {
  throw new Error(`LIVE_API_BASE_URL must end with /api/v1, got: ${API_BASE}`);
}
export const WEB_BASE = process.env.LIVE_WEB_BASE_URL ?? 'http://127.0.0.1:5175';
export const SEED_PASSWORD = process.env.LIVE_SEED_PASSWORD ?? 'demo-library-2026';

export type TestUser = {
  loginId: string;
  password: string;
  fullName: string;
  contact: string;
};

let sequence = 0;

export function uid(prefix = 'e2e'): string {
  sequence += 1;
  return `${prefix}_${Date.now().toString(36)}_${sequence}_${Math.random().toString(36).slice(2, 7)}`;
}

/** 멱등성 요청에 사용할 UUID (서버가 UUID 형식을 강제한다). */
export function requestId(): string {
  return randomUUID();
}

export function makeUser(prefix = 'live'): TestUser {
  const stamp = `${Date.now() % 100_000_000}`.padStart(8, '0');
  const contact = `010${stamp.slice(0, 7)}${Math.floor(Math.random() * 10)}`;
  return {
    loginId: uid(prefix),
    password: 'LivePassw0rd!2026',
    fullName: '실시간검증회원',
    contact,
  };
}

export async function apiCall(page: Page, method: string, path: string, body?: unknown) {
  const response = await page.request.fetch(`${API_BASE}${path}`, {
    method,
    data: body === undefined ? undefined : body,
  });
  const text = await response.text();
  let parsed: any;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status(), body: parsed, text };
}

export function expectStatus(result: { status: number; body: any }, status: number) {
  expect(result.status, `expected ${status}, got ${result.status}: ${JSON.stringify(result.body)}`).toBe(status);
  return result.body;
}

export async function signup(page: Page, user: TestUser) {
  return expectStatus(
    await apiCall(page, 'POST', '/auth/signup', {
      loginId: user.loginId,
      password: user.password,
      fullName: user.fullName,
      contact: user.contact,
    }),
    201,
  );
}

export async function login(page: Page, loginId: string, password: string) {
  return expectStatus(await apiCall(page, 'POST', '/auth/login', { loginId, password }), 200);
}

export async function loginSeed(page: Page, role: 'admin' | 'librarian') {
  const loginId = role === 'admin' ? 'admin' : 'librarian1';
  return login(page, loginId, SEED_PASSWORD);
}

export async function loginUi(page: Page, loginId: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('로그인 ID').fill(loginId);
  await page.getByLabel('비밀번호', { exact: true }).fill(password);
  await page.locator('form button').last().click();
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 15000 });
}

export async function logout(page: Page) {
  expectStatus(await apiCall(page, 'POST', '/auth/logout'), 204);
}

export async function state(page: Page): Promise<any> {
  return expectStatus(await apiCall(page, 'GET', '/library/state'), 200);
}

/** 테스트 전용 도서와 소장본을 API로 생성한다. */
export async function createBookCopy(page: Page, label: string) {
  const title = `${label} ${uid('book')}`;
  const book = expectStatus(
    await apiCall(page, 'POST', '/books', {
      title,
      isbn: '',
      publisher: 'Live E2E',
      publicationYear: 2026,
      authorNames: '실시간 테스트 작가',
      categoryCode: 'DEMO_GENERAL',
    }),
    201,
  );
  const copy = expectStatus(await apiCall(page, 'POST', `/books/${book.bookId}/copies`), 201);
  return { bookId: book.bookId, copyId: copy.copyId, copyCode: copy.copyCode, title };
}

export function activeLoanFor(data: any, copyId: number) {
  return (data.loans ?? []).find(
    (loan: any) => loan.copyId === copyId && loan.returnedAt === null && !loan.isCancelled,
  );
}

export function findOverdueMemberId(data: any): number | undefined {
  const today = new Date().toISOString().slice(0, 10);
  return (data.loans ?? []).find(
    (loan: any) =>
      loan.memberUserId &&
      loan.returnedAt === null &&
      !loan.isCancelled &&
      `${loan.currentDueDate}`.slice(0, 10) < today,
  )?.memberUserId;
}
