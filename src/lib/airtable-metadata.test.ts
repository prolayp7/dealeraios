import { afterEach, describe, expect, test, vi } from "vitest";
import {
  listAirtableTables,
  createAirtableField,
  renameAirtableField,
  isCreatableFieldType,
  AirtableApiError,
} from "./airtable-metadata";

const config = { personalAccessToken: "patTEST", baseId: "appTEST" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isCreatableFieldType", () => {
  test("accepts the V1 supported types", () => {
    expect(isCreatableFieldType("singleLineText")).toBe(true);
    expect(isCreatableFieldType("multipleSelects")).toBe(true);
    expect(isCreatableFieldType("checkbox")).toBe(true);
  });

  test("rejects types Airtable's API refuses to create", () => {
    expect(isCreatableFieldType("formula")).toBe(false);
    expect(isCreatableFieldType("multipleAttachments")).toBe(false);
    expect(isCreatableFieldType("lastModifiedTime")).toBe(false);
  });
});

describe("listAirtableTables", () => {
  test("returns the tables array from the meta endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tables: [{ id: "tbl1", name: "Inventory", fields: [{ id: "fld1", name: "Make", type: "singleLineText" }] }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const tables = await listAirtableTables(config);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.airtable.com/v0/meta/bases/appTEST/tables",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer patTEST" }),
      })
    );
    expect(tables).toEqual([
      { id: "tbl1", name: "Inventory", fields: [{ id: "fld1", name: "Make", type: "singleLineText" }] },
    ]);
  });

  test("returns an empty array when the response has no tables", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );
    expect(await listAirtableTables(config)).toEqual([]);
  });
});

describe("createAirtableField", () => {
  test("POSTs the field definition to the table's fields endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "fldNEW", name: "Trim", type: "singleLineText" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const field = await createAirtableField(config, "tbl1", {
      name: "Trim",
      type: "singleLineText",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.airtable.com/v0/meta/bases/appTEST/tables/tbl1/fields",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Trim", type: "singleLineText" }),
      })
    );
    expect(field.id).toBe("fldNEW");
  });

  test("throws an AirtableApiError with status 403 when the PAT lacks schema write scope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: "Not authorized" } }),
      })
    );

    await expect(
      createAirtableField(config, "tbl1", { name: "Trim", type: "singleLineText" })
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("renameAirtableField", () => {
  test("PATCHes only the name at the specific field endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "fld1", name: "Trim Level", type: "singleLineText" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await renameAirtableField(config, "tbl1", "fld1", "Trim Level");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.airtable.com/v0/meta/bases/appTEST/tables/tbl1/fields/fld1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ name: "Trim Level" }),
      })
    );
  });
});

describe("AirtableApiError", () => {
  test("is an instance of Error and carries the HTTP status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: { message: "Table not found" } }),
      })
    );

    try {
      await listAirtableTables(config);
      throw new Error("expected listAirtableTables to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AirtableApiError);
      expect(err).toBeInstanceOf(Error);
      expect((err as AirtableApiError).status).toBe(404);
      expect((err as AirtableApiError).message).toBe("Table not found");
    }
  });
});
