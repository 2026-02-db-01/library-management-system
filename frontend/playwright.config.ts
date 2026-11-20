import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  // 실제 API·DB를 쓰는 e2e/live/ 는 playwright.live.config.ts 에서만 실행한다.
  testIgnore: "e2e/live/**",
  timeout: 120000,
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5174 --strictPort",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: true,
  },
  use: {
    actionTimeout: 10000,
    baseURL: "http://127.0.0.1:5174",
    browserName: "chromium",
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
  },
  reporter: "list",
  workers: 1,
});
