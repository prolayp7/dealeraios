import { describe, expect, test } from "vitest";
import { listingMatchesSearch } from "./listing-match";

describe("listingMatchesSearch", () => {
  test("rejects a listing whose title has a different make", () => {
    expect(
      listingMatchesSearch("2017 Honda accord, reduced from $12,000", "mercedes", "glc300")
    ).toBe(false);
  });

  test("accepts a listing that matches make and model", () => {
    expect(
      listingMatchesSearch("2018 Mercedes-Benz GLC 300 4matic", "mercedes", "glc300")
    ).toBe(true);
  });

  test("rejects same make but different model when model is specified", () => {
    expect(
      listingMatchesSearch("2016 Mercedes-Benz c-class", "mercedes", "glc300")
    ).toBe(false);
  });

  test("accepts make-only search regardless of model", () => {
    expect(listingMatchesSearch("2016 Mercedes-Benz c-class", "mercedes", "")).toBe(true);
  });

  test("matches case-insensitively and ignores punctuation/spacing differences", () => {
    expect(listingMatchesSearch("2019 MERCEDES BENZ GLC300", "Mercedes", "GLC 300")).toBe(true);
  });

  test("passes through when no make or model was requested", () => {
    expect(listingMatchesSearch("2018 Mazda mazda3", "", "")).toBe(true);
  });
});
