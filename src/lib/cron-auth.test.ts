import { describe, expect, test } from "vitest";
import { isAuthorizedCronRequest } from "./cron-auth";

describe("isAuthorizedCronRequest", () => {
  test("accepts a matching bearer token", () => {
    expect(isAuthorizedCronRequest("Bearer secret123", "secret123")).toBe(true);
  });

  test("rejects a mismatched token", () => {
    expect(isAuthorizedCronRequest("Bearer wrong", "secret123")).toBe(false);
  });

  test("rejects a missing header", () => {
    expect(isAuthorizedCronRequest(null, "secret123")).toBe(false);
  });

  test("rejects when no secret is configured", () => {
    expect(isAuthorizedCronRequest("Bearer secret123", undefined)).toBe(false);
  });

  test("rejects a header without the Bearer prefix", () => {
    expect(isAuthorizedCronRequest("secret123", "secret123")).toBe(false);
  });
});
