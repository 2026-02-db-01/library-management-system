import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
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
