import { describe, expect, test } from "vitest";
import { pickNextAccount } from "./rotation";

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
