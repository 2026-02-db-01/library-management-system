import { afterEach, describe, expect, it, vi } from "vitest";

const STATE_PATH = "/api/v1/library/state";

function jsonResponse(body: unknown, status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
  };
}

async function loadClient() {
  vi.resetModules();
  return import("./client");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("API base URL (dev proxy vs deployed backend)", () => {
  it("keeps the relative /api path when no backend URL is configured", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    const { apiUrl } = await loadClient();
    expect(apiUrl(STATE_PATH)).toBe(STATE_PATH);
  });

  it("prefixes the configured backend URL and normalizes a trailing slash", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com/");
    const { apiUrl } = await loadClient();
    expect(apiUrl(STATE_PATH)).toBe("https://api.example.com/api/v1/library/state");
  });

  it("sends the request to the configured origin with credentials included", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    const { apiRequest } = await loadClient();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, 204));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest(STATE_PATH);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/library/state",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});

describe("404 regression", () => {
  it("surfaces a JSON 404 as ApiError(404) instead of returning success data", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    const { apiRequest, ApiError } = await loadClient();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse({ message: "존재하지 않는 도서입니다.", code: "BOOK_NOT_FOUND" }, 404),
    ));

    await expect(apiRequest(STATE_PATH)).rejects.toMatchObject({
      status: 404,
      code: "BOOK_NOT_FOUND",
      message: "존재하지 않는 도서입니다.",
    });
    await expect(apiRequest(STATE_PATH)).rejects.toBeInstanceOf(ApiError);
  });

  it("surfaces a non-JSON 404 (static host HTML) as ApiError(404), never as data", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    const { apiRequest, ApiError } = await loadClient();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse("<!doctype html><title>404</title>", 404),
    ));

    await expect(apiRequest(STATE_PATH)).rejects.toBeInstanceOf(ApiError);
    await expect(apiRequest(STATE_PATH)).rejects.toMatchObject({
      status: 404,
      message: "서버 요청에 실패했습니다. (404)",
    });
  });
});
