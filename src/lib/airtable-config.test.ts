import { describe, expect, test } from "vitest";
import {
  DEFAULT_AIRTABLE_CONFIG,
  isMaskedToken,
  maskAirtableConfig,
  maskAirtableToken,
  mergeAirtableConfigUpdate,
} from "./airtable-config";

describe("maskAirtableToken", () => {
  test("keeps first 4 and last 4 characters", () => {
    expect(maskAirtableToken("patABC123XYZ789")).toBe("patA••••Z789");
  });

  test("fully masks short tokens", () => {
    expect(maskAirtableToken("short")).toBe("••••••••");
  });
});

describe("maskAirtableConfig", () => {
  test("masks a set token and leaves other fields alone", () => {
    const config = { ...DEFAULT_AIRTABLE_CONFIG, personal_access_token: "patABC123XYZ789", base_id: "appXYZ" };
    const masked = maskAirtableConfig(config);
    expect(masked.personal_access_token).toBe("patA••••Z789");
    expect(masked.base_id).toBe("appXYZ");
  });

  test("leaves an empty token empty", () => {
    const masked = maskAirtableConfig(DEFAULT_AIRTABLE_CONFIG);
    expect(masked.personal_access_token).toBe("");
  });
});

describe("isMaskedToken", () => {
  test("recognizes the masked format", () => {
    expect(isMaskedToken("patA••••Z789")).toBe(true);
    expect(isMaskedToken("••••••••")).toBe(true);
  });

  test("rejects a real token", () => {
    expect(isMaskedToken("patABC123XYZ789")).toBe(false);
  });
});

describe("mergeAirtableConfigUpdate", () => {
  const existing = { ...DEFAULT_AIRTABLE_CONFIG, personal_access_token: "patREAL123TOKEN", base_id: "appOLD" };

  test("keeps the existing token when incoming is the masked placeholder", () => {
    const merged = mergeAirtableConfigUpdate(existing, {
      personal_access_token: "patR••••OKEN",
      base_id: "appNEW",
    });
    expect(merged.personal_access_token).toBe("patREAL123TOKEN");
    expect(merged.base_id).toBe("appNEW");
  });

  test("keeps the existing token when incoming omits it", () => {
    const merged = mergeAirtableConfigUpdate(existing, { base_id: "appNEW" });
    expect(merged.personal_access_token).toBe("patREAL123TOKEN");
  });

  test("keeps the existing token when incoming is empty string", () => {
    const merged = mergeAirtableConfigUpdate(existing, { personal_access_token: "" });
    expect(merged.personal_access_token).toBe("patREAL123TOKEN");
  });

  test("replaces the token when incoming is a real new value", () => {
    const merged = mergeAirtableConfigUpdate(existing, { personal_access_token: "patBRANDNEWTOKEN" });
    expect(merged.personal_access_token).toBe("patBRANDNEWTOKEN");
  });
});
