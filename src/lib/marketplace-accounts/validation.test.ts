import { describe, expect, test } from "vitest";
import { validateCreateAccountBody, validateUpdateAccountBody } from "./validation";

const validCookie = {
  name: "c_user",
  value: "12345",
  domain: ".facebook.com",
  path: "/",
};

describe("validateCreateAccountBody", () => {
  test("accepts a valid label + cookies array", () => {
    const result = validateCreateAccountBody({
      label: "  Main Account  ",
      cookies: [validCookie],
    });
    expect(result).toEqual({
      ok: true,
      value: { label: "Main Account", cookies: [validCookie], provider: "multilogin" },
    });
  });

  test("rejects a missing label", () => {
    const result = validateCreateAccountBody({ cookies: [validCookie] });
    expect(result).toEqual({ ok: false, error: "label is required" });
  });

  test("rejects an empty/whitespace-only label", () => {
    const result = validateCreateAccountBody({ label: "   ", cookies: [validCookie] });
    expect(result.ok).toBe(false);
  });

  test("rejects a missing cookies field", () => {
    const result = validateCreateAccountBody({ label: "x" });
    expect(result).toEqual({
      ok: false,
      error: "cookies must be a non-empty array",
    });
  });

  test("rejects an empty cookies array", () => {
    const result = validateCreateAccountBody({ label: "x", cookies: [] });
    expect(result.ok).toBe(false);
  });

  test("rejects a cookie missing required fields", () => {
    const result = validateCreateAccountBody({
      label: "x",
      cookies: [{ name: "c_user", value: "1" }],
    });
    expect(result).toEqual({
      ok: false,
      error: "each cookie must have name, value, domain, and path",
    });
  });

  test("defaults provider to multilogin when absent", () => {
    const result = validateCreateAccountBody({ label: "x", cookies: [validCookie] });
    expect(result.ok && result.value.provider).toBe("multilogin");
  });

  test("accepts an explicit gologin provider", () => {
    const result = validateCreateAccountBody({
      label: "x",
      cookies: [validCookie],
      provider: "gologin",
    });
    expect(result.ok && result.value.provider).toBe("gologin");
  });

  test("rejects an invalid provider value", () => {
    const result = validateCreateAccountBody({
      label: "x",
      cookies: [validCookie],
      provider: "not-a-provider",
    });
    expect(result).toEqual({
      ok: false,
      error: "provider must be 'multilogin' or 'gologin'",
    });
  });

  test("accepts a gologinProfileId escape hatch", () => {
    const result = validateCreateAccountBody({
      label: "x",
      cookies: [validCookie],
      provider: "gologin",
      gologinProfileId: "  prof_123  ",
    });
    expect(result.ok && result.value.gologinProfileId).toBe("prof_123");
  });

  test("rejects a blank gologinProfileId", () => {
    const result = validateCreateAccountBody({
      label: "x",
      cookies: [validCookie],
      gologinProfileId: "   ",
    });
    expect(result).toEqual({
      ok: false,
      error: "gologinProfileId must be a non-empty string when provided",
    });
  });
});

describe("validateUpdateAccountBody", () => {
  test("accepts label-only update", () => {
    const result = validateUpdateAccountBody({ label: "New Label" });
    expect(result).toEqual({ ok: true, value: { label: "New Label" } });
  });

  test("accepts cookies-only update", () => {
    const result = validateUpdateAccountBody({ cookies: [validCookie] });
    expect(result).toEqual({ ok: true, value: { cookies: [validCookie] } });
  });

  test("rejects an empty body", () => {
    const result = validateUpdateAccountBody({});
    expect(result).toEqual({
      ok: false,
      error: "at least one of label or cookies must be provided",
    });
  });

  test("rejects invalid cookies even when label is also present", () => {
    const result = validateUpdateAccountBody({ label: "x", cookies: [] });
    expect(result.ok).toBe(false);
  });
});
