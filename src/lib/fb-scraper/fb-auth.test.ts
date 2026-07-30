import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("./cookies", () => ({
  loadFbCookies: vi.fn(),
  saveFbCookies: vi.fn(),
}));

import { loadFbCookies } from "./cookies";
import { resolveCookies } from "./fb-auth";

const envCookie = [
  {
    name: "c_user",
    value: "env-user",
    domain: ".facebook.com",
    path: "/",
  },
];

const savedCookie = [
  {
    name: "c_user",
    value: "saved-user",
    domain: ".facebook.com",
    path: "/",
    expires: -1,
    httpOnly: false,
    secure: true,
    sameSite: "Lax" as const,
  },
];

describe("resolveCookies", () => {
  afterEach(() => {
    delete process.env.FB_COOKIES;
    vi.clearAllMocks();
  });

  test("prefers the saved session file over a stale FB_COOKIES env var", async () => {
    process.env.FB_COOKIES = JSON.stringify(envCookie);
    vi.mocked(loadFbCookies).mockResolvedValue(savedCookie);

    const cookies = await resolveCookies();

    expect(cookies.find((c) => c.name === "c_user")?.value).toBe(
      "saved-user"
    );
  });

  test("falls back to FB_COOKIES env var when no saved session exists", async () => {
    process.env.FB_COOKIES = JSON.stringify(envCookie);
    vi.mocked(loadFbCookies).mockResolvedValue([]);

    const cookies = await resolveCookies();

    expect(cookies.find((c) => c.name === "c_user")?.value).toBe("env-user");
  });

  test("throws when neither a saved session nor FB_COOKIES exist", async () => {
    vi.mocked(loadFbCookies).mockResolvedValue([]);

    await expect(resolveCookies()).rejects.toThrow(
      "Missing FB_COOKIES in environment and no saved session in data/fb-session.json"
    );
  });
});
