import { afterEach, describe, expect, test, vi } from "vitest";
import {
  listAirtableRecords,
  listAllAirtableRecords,
  createAirtableRecord,
  updateAirtableRecord,
  getAirtableTableFieldNames,
} from "./airtable-client";

const config = { personalAccessToken: "patTEST", baseId: "appTEST", tableName: "Command Center" };

afterEach(() => {
  vi.unstubAllGlobals();
});

test("listAirtableRecords calls the correct URL with auth header", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ records: [{ id: "rec1", fields: { Make: "BMW" }, createdTime: "2026-01-01T00:00:00.000Z" }] }),
  });
  vi.stubGlobal("fetch", fetchMock);

  const result = await listAirtableRecords(config);

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("https://api.airtable.com/v0/appTEST/Command%20Center"),
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer patTEST" }),
    })
  );
  expect(result.records).toHaveLength(1);
  expect(result.records[0]?.fields.Make).toBe("BMW");
});

test("listAllAirtableRecords pages until no offset is returned", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        records: [{ id: "rec1", fields: {}, createdTime: "2026-01-01T00:00:00.000Z" }],
        offset: "page2",
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        records: [{ id: "rec2", fields: {}, createdTime: "2026-01-01T00:00:00.000Z" }],
      }),
    });
  vi.stubGlobal("fetch", fetchMock);

  const records = await listAllAirtableRecords(config);

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(records.map((r) => r.id)).toEqual(["rec1", "rec2"]);
});

test("createAirtableRecord POSTs fields and returns the created record", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: "recNEW", fields: { Make: "Honda" }, createdTime: "2026-01-01T00:00:00.000Z" }),
  });
  vi.stubGlobal("fetch", fetchMock);

  const record = await createAirtableRecord(config, { Make: "Honda" });

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("https://api.airtable.com/v0/appTEST/Command%20Center"),
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ fields: { Make: "Honda" }, typecast: true }),
    })
  );
  expect(record.id).toBe("recNEW");
});

test("updateAirtableRecord PATCHes the specific record", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: "rec1", fields: { Make: "Honda" }, createdTime: "2026-01-01T00:00:00.000Z" }),
  });
  vi.stubGlobal("fetch", fetchMock);

  await updateAirtableRecord(config, "rec1", { Make: "Honda" });

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("/v0/appTEST/Command%20Center/rec1"),
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ fields: { Make: "Honda" }, typecast: true }),
    })
  );
});

test("throws with the Airtable error body when a call fails", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ error: { message: "Invalid API key" } }),
  });
  vi.stubGlobal("fetch", fetchMock);

  await expect(listAirtableRecords(config)).rejects.toThrow("Invalid API key");
});

test("throws when a successful response has invalid JSON", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => {
      throw new Error("Unexpected token");
    },
  });
  vi.stubGlobal("fetch", fetchMock);

  await expect(listAirtableRecords(config)).rejects.toThrow("Unexpected token");
});

test("getAirtableTableFieldNames returns every schema field, including ones with no data yet", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      tables: [
        {
          id: "tblOther",
          name: "Parts",
          fields: [{ id: "fld1", name: "Part Name", type: "singleLineText" }],
        },
        {
          id: "tblTEST",
          name: "Command Center",
          fields: [
            { id: "fld2", name: "Make", type: "singleLineText" },
            { id: "fld3", name: "Last Modified", type: "lastModifiedTime" },
          ],
        },
      ],
    }),
  });
  vi.stubGlobal("fetch", fetchMock);

  const fieldNames = await getAirtableTableFieldNames(config);

  expect(fetchMock).toHaveBeenCalledWith(
    "https://api.airtable.com/v0/meta/bases/appTEST/tables",
    expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer patTEST" }) })
  );
  expect(fieldNames).toEqual(["Make", "Last Modified"]);
});

test("getAirtableTableFieldNames throws when the configured table isn't in the base schema", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ tables: [{ id: "tblOther", name: "Parts", fields: [] }] }),
  });
  vi.stubGlobal("fetch", fetchMock);

  await expect(getAirtableTableFieldNames(config)).rejects.toThrow(
    'Table "Command Center" not found in base schema'
  );
});
