import { describe, expect, test } from "vitest";
import { errorMessage } from "./utils";

describe("errorMessage", () => {
  test("returns the message from an Error instance", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  test("returns the message from a Postgrest-style plain object error", () => {
    expect(errorMessage({ message: "duplicate key value", code: "23505" })).toBe(
      "duplicate key value"
    );
  });

  test("falls back to a JSON dump for objects with no message", () => {
    expect(errorMessage({ code: "23505" })).toBe('{"code":"23505"}');
  });

  test("stringifies primitives", () => {
    expect(errorMessage("plain string")).toBe('"plain string"');
    expect(errorMessage(404)).toBe("404");
  });
});
