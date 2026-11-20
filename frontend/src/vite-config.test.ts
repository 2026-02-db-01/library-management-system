import { afterEach, describe, expect, it, vi } from "vitest";

async function loadViteConfig() {
  vi.resetModules();
  return import("../vite.config");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GitHub Pages Vite build (asset 404 regression)", () => {
  it("uses the repository base path and keeps the Tailwind plugin", async () => {
    vi.stubEnv("VITE_GITHUB_PAGES", "true");
    const { default: config } = await loadViteConfig();

    // c9fcac6 dropped the base path, so Pages requested /assets/... instead of
    // /library-management-system/assets/... and every asset returned 404.
    expect(config.base).toBe("/library-management-system/");
    expect(config.plugins).toHaveLength(2);
  });

  it("keeps the root base and a dev-only /api proxy for local builds", async () => {
    vi.stubEnv("VITE_GITHUB_PAGES", "false");
    const { default: config } = await loadViteConfig();

    expect(config.base).toBe("/");
    expect(config.server?.proxy).toMatchObject({
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
    });
  });
});
