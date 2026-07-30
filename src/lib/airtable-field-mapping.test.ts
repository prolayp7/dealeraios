import { describe, expect, test, vi } from "vitest";
import {
  mapAirtableFieldsToVehicle,
  mapVehicleToAirtableFields,
  coerceFieldsForAirtableSchema,
} from "./airtable-field-mapping";

vi.mock("@/lib/vehicle-upload", () => ({
  uploadVehicleImage: vi.fn(async (_buffer: Buffer, _contentType: string, ext: string) => ({
    url: `https://supabase.example/vehicle-images/rehosted.${ext}`,
    storage: "supabase" as const,
  })),
}));

global.fetch = vi.fn(async () => {
  return {
    ok: true,
    headers: new Map([["content-type", "image/jpeg"]]),
    arrayBuffer: async () => new ArrayBuffer(0),
  } as unknown as Response;
}) as typeof global.fetch;

const mapping = {
  make: "Make",
  model: "Model",
  mileage: "Mileage",
  retail_price: "Retail Price",
  listed_online: "Listed Online",
  image_url: "Photos",
  color: "Color",
};

describe("mapAirtableFieldsToVehicle", () => {
  test("parses numeric and text fields using parseValue's rules", async () => {
    const vehicle = await mapAirtableFieldsToVehicle(
      { Make: "BMW", Model: "M3", Mileage: "179,000", "Retail Price": "$45,000", "Listed Online": "yes", Color: "Black" },
      mapping
    );
    expect(vehicle.make).toBe("BMW");
    expect(vehicle.mileage).toBe(179000);
    expect(vehicle.retail_price).toBe(45000);
    expect(vehicle.listed_online).toBe(true);
    expect(vehicle.color).toBe("Black");
  });

  test("passes through native Airtable number and boolean field types directly", async () => {
    const vehicle = await mapAirtableFieldsToVehicle(
      { Make: "Honda", Mileage: 88000 },
      mapping
    );
    expect(vehicle.mileage).toBe(88000);
  });

  test("re-hosts an Airtable attachment array into Supabase Storage", async () => {
    const vehicle = await mapAirtableFieldsToVehicle(
      {
        Photos: [
          { url: "https://v5.airtableusercontent.com/a.jpg", filename: "a.jpg" },
          { url: "https://v5.airtableusercontent.com/b.png", filename: "b.png" },
        ],
      },
      mapping
    );
    expect(vehicle.image_urls).toEqual([
      "https://supabase.example/vehicle-images/rehosted.jpg",
      "https://supabase.example/vehicle-images/rehosted.png",
    ]);
    expect(vehicle.image_url).toBe("https://supabase.example/vehicle-images/rehosted.jpg");
  });

  test("skips a mapped field with no value in the record", async () => {
    const vehicle = await mapAirtableFieldsToVehicle({ Make: "BMW" }, mapping);
    expect(vehicle.model).toBeUndefined();
  });

  test("skips a failed attachment but preserves successful ones", async () => {
    const mockFetch = vi.mocked(global.fetch);
    mockFetch.mockImplementation(async (input: string | URL | Request) => {
      const urlStr = typeof input === "string" ? input : input.toString();
      if (urlStr.includes("bad")) {
        throw new Error("Network error: Failed to fetch");
      }
      return {
        ok: true,
        headers: new Map([["content-type", "image/jpeg"]]),
        arrayBuffer: async () => new ArrayBuffer(0),
      } as unknown as Response;
    });

    const vehicle = await mapAirtableFieldsToVehicle(
      {
        Photos: [
          { url: "https://v5.airtableusercontent.com/bad.jpg", filename: "bad.jpg" },
          { url: "https://v5.airtableusercontent.com/good.jpg", filename: "good.jpg" },
        ],
      },
      mapping
    );
    expect(vehicle.image_urls).toEqual([
      "https://supabase.example/vehicle-images/rehosted.jpg",
    ]);
    expect(vehicle.image_url).toBe("https://supabase.example/vehicle-images/rehosted.jpg");
    mockFetch.mockRestore();
  });
});

describe("mapVehicleToAirtableFields", () => {
  test("maps vehicle fields back to Airtable field names", () => {
    const fields = mapVehicleToAirtableFields(
      { make: "BMW", model: "M3", retail_price: 45000 },
      mapping
    );
    expect(fields).toEqual({ Make: "BMW", Model: "M3", "Retail Price": 45000 });
  });

  test("never pushes photos back to Airtable", () => {
    const fields = mapVehicleToAirtableFields(
      { image_url: "https://supabase.example/x.jpg", image_urls: ["https://supabase.example/x.jpg"] },
      mapping
    );
    expect(fields).toEqual({});
  });
});

describe("coerceFieldsForAirtableSchema", () => {
  const schema = [
    { id: "fld1", name: "Listed Online", type: "multipleSelects", choices: ["Yes", "NO"] },
    { id: "fld2", name: "Make", type: "singleLineText" },
  ];

  test("converts a true boolean into a single-item choice array for multipleSelects", () => {
    const result = coerceFieldsForAirtableSchema({ "Listed Online": true, Make: "BMW" }, schema);
    expect(result).toEqual({ "Listed Online": ["Yes"], Make: "BMW" });
  });

  test("converts a false boolean by matching the No-style choice, case-insensitively", () => {
    const result = coerceFieldsForAirtableSchema({ "Listed Online": false }, schema);
    expect(result).toEqual({ "Listed Online": ["NO"] });
  });

  test("passes booleans through unchanged when the field has no schema entry", () => {
    const result = coerceFieldsForAirtableSchema({ Unknown: true }, schema);
    expect(result).toEqual({ Unknown: true });
  });

  test("passes non-boolean values through unchanged", () => {
    const result = coerceFieldsForAirtableSchema({ Make: "Honda" }, schema);
    expect(result).toEqual({ Make: "Honda" });
  });
});
