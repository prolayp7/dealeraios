import type { SupabaseClient } from "@supabase/supabase-js";
import type { VehicleFormData } from "@/lib/types";
import {
  TARGET_FIELDS,
  parseValue,
  parseImageUrls,
  type ColumnMapping,
} from "@/lib/import-column-mapper";
import { uploadVehicleImage } from "@/lib/vehicle-upload";

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
