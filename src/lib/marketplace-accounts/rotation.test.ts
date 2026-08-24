import { describe, expect, test } from "vitest";
import { hasUsableProfile, pickNextAccount } from "./rotation";

describe("pickNextAccount", () => {
  test("returns null for an empty pool", () => {
    expect(pickNextAccount([])).toBeNull();
  });

  test("prefers a never-used account over any used account", () => {
    const result = pickNextAccount([
      { id: "used", last_used_at: "2026-07-31T10:00:00Z" },
      { id: "never-used", last_used_at: null },
    ]);
    expect(result).toBe("never-used");
  });

  test("picks the least-recently-used account when all have been used", () => {
    const result = pickNextAccount([
      { id: "recent", last_used_at: "2026-07-31T12:00:00Z" },
      { id: "oldest", last_used_at: "2026-07-30T08:00:00Z" },
      { id: "middle", last_used_at: "2026-07-31T00:00:00Z" },
    ]);
    expect(result).toBe("oldest");
  });

  test("picks the first never-used account when multiple are null", () => {
    const result = pickNextAccount([
      { id: "a", last_used_at: null },
      { id: "b", last_used_at: null },
    ]);
    expect(result).toBe("a");
  });
});

describe("hasUsableProfile", () => {
  const base = {
    id: "test-id",
    encrypted_cookies: "iv:tag:ciphertext",
    multilogin_profile_id: null as string | null,
    multilogin_folder_id: null as string | null,
    gologin_profile_id: null as string | null,
  };

  test("multilogin row is usable only with both profile and folder id", () => {
    expect(
      hasUsableProfile({ ...base, provider: "multilogin", multilogin_profile_id: "p1", multilogin_folder_id: "f1" })
    ).toBe(true);
    expect(
      hasUsableProfile({ ...base, provider: "multilogin", multilogin_profile_id: "p1" })
    ).toBe(false);
  });

  test("gologin row is usable with only gologin_profile_id", () => {
    expect(hasUsableProfile({ ...base, provider: "gologin", gologin_profile_id: "g1" })).toBe(true);
    expect(hasUsableProfile({ ...base, provider: "gologin" })).toBe(false);
  });

  test("missing cookies makes any provider ineligible", () => {
    expect(
      hasUsableProfile({
        ...base,
        encrypted_cookies: null,
        provider: "gologin",
        gologin_profile_id: "g1",
      })
    ).toBe(false);
  });
});
