import { describe, expect, test } from "vitest";
import { suggestColumnMapping, parseValue, parseImageUrls } from "./import-column-mapper";

describe("suggestColumnMapping — new fields", () => {
  test("maps Color, CODE, Where, Sold Date", () => {
    const mapping = suggestColumnMapping(["Color", "CODE", "Where", "Sold Date"]);
    expect(mapping.color).toBe("Color");
    expect(mapping.code).toBe("CODE");
    expect(mapping.lot_location).toBe("Where");
    expect(mapping.sold_date).toBe("Sold Date");
  });
});

describe("parseValue is exported and still correct", () => {
  test("strips thousands separators for mileage", () => {
    expect(parseValue("mileage", "179,000")).toBe(179000);
  });
});

describe("parseImageUrls is exported", () => {
  test("extracts URLs from an Airtable CSV attachment cell", () => {
    const cell = "file.jpg (https://v5.airtableusercontent.com/a/b.jpg)";
    expect(parseImageUrls(cell)).toEqual(["https://v5.airtableusercontent.com/a/b.jpg"]);
  });
});
