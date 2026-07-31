import type { SupabaseClient } from "@supabase/supabase-js";
import type { VehicleFormData } from "@/lib/types";
import {
  TARGET_FIELDS,
  parseValue,
  parseImageUrls,
  type ColumnMapping,
} from "@/lib/import-column-mapper";
import { uploadVehicleImage } from "@/lib/vehicle-upload";
import type { AirtableFieldSchema } from "@/lib/airtable-client";

interface AirtableAttachment {
  url: string;
  filename: string;
  type?: string;
}

function isAttachmentArray(value: unknown): value is AirtableAttachment[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        item != null &&
        typeof item === "object" &&
        typeof (item as { url?: unknown }).url === "string"
    )
  );
}

function extFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext && /^[a-z0-9]+$/.test(ext) ? ext : "jpg";
}

async function rehostAttachments(
  attachments: AirtableAttachment[],
  client?: SupabaseClient
): Promise<string[]> {
  const urls: string[] = [];

  for (const attachment of attachments) {
    try {
      const response = await fetch(attachment.url);
      if (!response.ok) continue;

      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType =
        attachment.type || response.headers.get("content-type") || "image/jpeg";
      const { url } = await uploadVehicleImage(
        buffer,
        contentType,
        extFromFilename(attachment.filename),
        client
      );
      urls.push(url);
    } catch (error) {
      console.warn(`Failed to rehost attachment: ${attachment.url}`, error);
      continue;
    }
  }

  return urls;
}

function parseAirtableFieldValue(key: keyof VehicleFormData, raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw === "number" || typeof raw === "boolean") return raw;
  return parseValue(key, String(raw));
}

export async function mapAirtableFieldsToVehicle(
  fields: Record<string, unknown>,
  mapping: ColumnMapping,
  // Passed through to photo re-hosting so uploads use the caller's already
  // authenticated client (session client on import, admin client on cron).
  client?: SupabaseClient
): Promise<VehicleFormData> {
  const vehicle: Record<string, unknown> = {};

  for (const field of TARGET_FIELDS) {
    const airtableFieldName = mapping[field.key];
    if (!airtableFieldName) continue;

    const raw = fields[airtableFieldName];
    if (raw === undefined) continue;

    if (field.key === "image_url") {
      const urls = isAttachmentArray(raw)
        ? await rehostAttachments(raw, client)
        : typeof raw === "string"
          ? parseImageUrls(raw)
          : [];
      if (urls.length > 0) {
        vehicle.image_urls = urls;
        vehicle.image_url = urls[0];
      }
      continue;
    }

    vehicle[field.key] = parseAirtableFieldValue(field.key, raw);
  }

  return vehicle as VehicleFormData;
}

// Photos are one-directional (Airtable -> Supabase Storage on import/sync);
// pushing a re-hosted Supabase URL back as an Airtable attachment isn't
// supported here, so image_url/image_urls are always skipped on the way out.
export function mapVehicleToAirtableFields(
  vehicle: VehicleFormData,
  mapping: ColumnMapping
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  for (const field of TARGET_FIELDS) {
    if (field.key === "image_url") continue;

    const airtableFieldName = mapping[field.key];
    if (!airtableFieldName) continue;

    const value = (vehicle as Record<string, unknown>)[field.key];
    if (value !== undefined) fields[airtableFieldName] = value;
  }

  return fields;
}

function findChoice(choices: string[], pattern: RegExp): string | undefined {
  return choices.find((choice) => pattern.test(choice.trim()));
}

// Airtable never accepts a write to these field types regardless of value
// shape or typecast — they're computed server-side (formula/rollup/count),
// system-managed (created/modified time or user), or UI-only (button). A
// dealer mapping this app's own "days_in_stock" (a real, writable column
// here) onto a same-named Airtable formula column is a totally reasonable
// thing to do by accident, so drop these silently rather than erroring the
// whole sync over a field that was never going to sync anyway.
const AIRTABLE_READONLY_FIELD_TYPES = new Set([
  "formula",
  "rollup",
  "count",
  "autoNumber",
  "createdTime",
  "lastModifiedTime",
  "createdBy",
  "lastModifiedBy",
  "button",
  "multipleLookupValues",
]);

// Airtable's text field types want an actual string, not a JSON number or
// boolean — typecast covers string -> number/select but not this direction,
// so e.g. this app's numeric "mileage" pushed at a dealer's singleLineText
// "Mileage" column ("cannot accept the provided value") needs an explicit
// String() here rather than relying on the API to coerce it.
const AIRTABLE_TEXT_FIELD_TYPES = new Set([
  "singleLineText",
  "multilineText",
  "email",
  "url",
  "phoneNumber",
]);

// mapVehicleToAirtableFields sends this app's own types (e.g. a plain
// boolean for listed_online, a plain string for status) verbatim. A dealer
// is free to map any app field onto any Airtable column regardless of type,
// and Airtable's API rejects shape mismatches against select fields
// ("Cannot parse value for field ...") instead of coercing them — a bare
// boolean, or a bare string against a *multipleSelects* field, which always
// wants an array even for a single choice. Booleans get translated into a
// matching Yes/No-style choice using the base's real schema; strings just
// get array-wrapped for multipleSelects (createAirtableRecord/
// updateAirtableRecord pass typecast: true, so a string that doesn't
// exactly match an existing option becomes a new one instead of erroring).
// Fields the base doesn't expose via schema.bases:read (or that aren't a
// select-type mismatch) pass through unchanged, preserving today's behavior.
export function coerceFieldsForAirtableSchema(
  fields: Record<string, unknown>,
  schema: AirtableFieldSchema[]
): Record<string, unknown> {
  const schemaByName = new Map(schema.map((field) => [field.name, field]));
  const result: Record<string, unknown> = {};

  for (const [name, value] of Object.entries(fields)) {
    const fieldSchema = schemaByName.get(name);

    if (fieldSchema && AIRTABLE_READONLY_FIELD_TYPES.has(fieldSchema.type)) {
      continue;
    }

    if (typeof value === "boolean" && fieldSchema?.choices?.length) {
      const truthy = findChoice(fieldSchema.choices, /^(yes|true|y)$/i);
      const falsy = findChoice(fieldSchema.choices, /^(no|false|n)$/i);
      const match = value ? truthy : falsy;

      result[name] = fieldSchema.type === "multipleSelects" ? (match ? [match] : []) : (match ?? value);
      continue;
    }

    if (typeof value === "string" && fieldSchema?.type === "multipleSelects") {
      result[name] = value ? [value] : [];
      continue;
    }

    if (
      (typeof value === "number" || typeof value === "boolean") &&
      fieldSchema &&
      AIRTABLE_TEXT_FIELD_TYPES.has(fieldSchema.type)
    ) {
      result[name] = String(value);
      continue;
    }

    result[name] = value;
  }

  return result;
}
