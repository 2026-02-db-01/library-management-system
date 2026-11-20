import { defineConfig } from '@playwright/test';

/**
 * 실제 React → FastAPI → PostgreSQL 16 E2E 전용 설정.
 * e2e/ 의 Mock fixture(config: playwright.config.ts)와 완전히 분리되어 있다.
 * 반드시 `npm run test:e2e:live` 로 실행한다 (DB 스택 기동/정리 포함).
 */
const apiUrl = process.env.LIVE_API_ORIGIN ?? 'http://127.0.0.1:8001';
const webUrl = process.env.LIVE_WEB_BASE_URL ?? 'http://127.0.0.1:5175';
const python = process.env.LIVE_PYTHON ?? 'python';

export default defineConfig({
  testDir: './e2e/live',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: webUrl,
    browserName: 'chromium',
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    actionTimeout: 10_000,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `"${python}" -m uvicorn src.main:app --host 127.0.0.1 --port 8001`,
      cwd: '../backend',
      url: `${apiUrl}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        DATABASE_URL: process.env.DATABASE_URL ?? '',
        SECRET_KEY: process.env.SECRET_KEY ?? '',
        DEBUG: 'true',
        CORS_ORIGINS: JSON.stringify([webUrl]),
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5175 --strictPort',
      url: webUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { VITE_API_BASE_URL: apiUrl },
    },
  ],
});
