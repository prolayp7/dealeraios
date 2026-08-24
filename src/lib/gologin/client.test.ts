import { afterEach, describe, expect, test, vi } from "vitest";
import { createGologinProfile, deleteGologinProfile, verifyGologinToken } from "./client";

const ORIGINAL_TOKEN = process.env.GOLOGIN_API_TOKEN;

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL_TOKEN === undefined) delete process.env.GOLOGIN_API_TOKEN;
  else process.env.GOLOGIN_API_TOKEN = ORIGINAL_TOKEN;
});

describe("createGologinProfile", () => {
  test("returns the profile id on success", async () => {
    process.env.GOLOGIN_API_TOKEN = "tok_test";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ id: "prof_123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const id = await createGologinProfile("Test Account");

    expect(id).toBe("prof_123");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.gologin.com/browser",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer tok_test" }),
      })
    );
  });

  test("throws a GOLOGIN ScraperError on a non-ok response", async () => {
    process.env.GOLOGIN_API_TOKEN = "tok_test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "unauthorized" })
    );

    await expect(createGologinProfile("Test Account")).rejects.toMatchObject({ code: "GOLOGIN" });
  });

  test("throws when the response has no usable profile id", async () => {
    process.env.GOLOGIN_API_TOKEN = "tok_test";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => "{}" }));

    await expect(createGologinProfile("Test Account")).rejects.toMatchObject({ code: "GOLOGIN" });
  });

  test("throws a CONFIG error when GOLOGIN_API_TOKEN is missing", async () => {
    delete process.env.GOLOGIN_API_TOKEN;
    await expect(createGologinProfile("Test Account")).rejects.toMatchObject({ code: "CONFIG" });
  });
});

describe("deleteGologinProfile", () => {
  test("resolves on a successful delete", async () => {
    process.env.GOLOGIN_API_TOKEN = "tok_test";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteGologinProfile("prof_123")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.gologin.com/browser/prof_123",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  test("throws a GOLOGIN ScraperError on a non-ok response", async () => {
    process.env.GOLOGIN_API_TOKEN = "tok_test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "not found" })
    );

    await expect(deleteGologinProfile("prof_123")).rejects.toMatchObject({ code: "GOLOGIN" });
  });
});

describe("verifyGologinToken", () => {
  test("returns true when the request succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await expect(verifyGologinToken("tok_test")).resolves.toBe(true);
  });

  test("returns false when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(verifyGologinToken("tok_test")).resolves.toBe(false);
  });
});
