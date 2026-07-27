import { describe, expect, test } from "vitest";
import { decideSyncDirection } from "./airtable-sync";

describe("decideSyncDirection", () => {
  test("no prior sync and Airtable has a modified time -> pull", () => {
    const direction = decideSyncDirection({
      airtableModifiedAt: new Date("2026-01-01"),
      localUpdatedAt: new Date("2025-01-01"),
      syncedAt: null,
    });
    expect(direction).toBe("pull");
  });

  test("only Airtable changed since last sync -> pull", () => {
    const direction = decideSyncDirection({
      airtableModifiedAt: new Date("2026-01-10"),
      localUpdatedAt: new Date("2026-01-01"),
      syncedAt: new Date("2026-01-05"),
    });
    expect(direction).toBe("pull");
  });

  test("only local changed since last sync -> push", () => {
    const direction = decideSyncDirection({
      airtableModifiedAt: new Date("2026-01-01"),
      localUpdatedAt: new Date("2026-01-10"),
      syncedAt: new Date("2026-01-05"),
    });
    expect(direction).toBe("push");
  });

  test("neither changed since last sync -> none", () => {
    const direction = decideSyncDirection({
      airtableModifiedAt: new Date("2026-01-01"),
      localUpdatedAt: new Date("2026-01-01"),
      syncedAt: new Date("2026-01-05"),
    });
    expect(direction).toBe("none");
  });

  test("both changed, Airtable is newer -> pull (last-write-wins)", () => {
    const direction = decideSyncDirection({
      airtableModifiedAt: new Date("2026-01-10"),
      localUpdatedAt: new Date("2026-01-08"),
      syncedAt: new Date("2026-01-05"),
    });
    expect(direction).toBe("pull");
  });

  test("both changed, local is newer -> push (last-write-wins)", () => {
    const direction = decideSyncDirection({
      airtableModifiedAt: new Date("2026-01-08"),
      localUpdatedAt: new Date("2026-01-10"),
      syncedAt: new Date("2026-01-05"),
    });
    expect(direction).toBe("push");
  });
});
