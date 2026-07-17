import type { VehicleFormData } from "./types";

export interface TargetField {
  key: keyof VehicleFormData;
  label: string;
  required?: boolean;
}

// The importable Vehicle fields, in the order shown to the dealer during mapping.
export const TARGET_FIELDS: TargetField[] = [
  { key: "year", label: "Year" },
  { key: "make", label: "Make", required: true },
  { key: "model", label: "Model", required: true },
  { key: "mileage", label: "Mileage" },
  { key: "vin", label: "VIN" },
  { key: "my_cost", label: "Purchase Cost" },
  { key: "repair_cost", label: "Repair Cost" },
  { key: "retail_price", label: "Retail Price" },
  { key: "listed_online", label: "Listed Online" },
  { key: "online_channel", label: "Listing Channel" },
  { key: "status", label: "Status" },
  { key: "bought_date", label: "Bought Date" },
  { key: "days_in_stock", label: "Days In Stock" },
  { key: "notes", label: "Notes" },
  { key: "image_url", label: "Photos" },
];

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Known real-world header variants that don't match a field's key/label
// directly — discovered from an actual Airtable export (see
// docs/superpowers/specs/2026-07-13-airtable-live-sync-design.md).
const HEADER_ALIASES: Partial<Record<keyof VehicleFormData, string[]>> = {
  my_cost: ["I Payed"],
  repair_cost: ["Repair spend"],
  online_channel: ["Online"],
  image_url: ["Photo", "Photo URL", "Image", "Images", "Picture", "Pictures"],
};

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export function parseCsvText(text: string): ParsedCsv {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 1) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);
  return { headers, rows };
}

// Best-guess mapping from detected CSV headers to target Vehicle fields —
// shown to the dealer as a starting point, not committed until confirmed.
export type ColumnMapping = Partial<Record<keyof VehicleFormData, string>>;

export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalizedHeaders = headers.map((h) => ({
    original: h,
    normalized: normalizeHeader(h),
  }));

  for (const field of TARGET_FIELDS) {
    const fieldNormalized = normalizeHeader(field.key).replace(/_/g, "");
    const aliasNormalized = (HEADER_ALIASES[field.key] ?? []).map(normalizeHeader);
    const match = normalizedHeaders.find(
      (h) =>
        h.normalized === fieldNormalized ||
        h.normalized === normalizeHeader(field.label) ||
        aliasNormalized.includes(h.normalized)
    );
    if (match) mapping[field.key] = match.original;
  }

  return mapping;
}

// Extracts photo URLs from a cell. Handles a plain comma-separated URL list
// as well as Airtable's attachment-field CSV export, which squashes each
// photo into "filename.jpg (https://v5.airtableusercontent.com/...)".
function parseImageUrls(value: string): string[] {
  return value.match(/https?:\/\/[^\s(),]+/g) ?? [];
}

function parseValue(key: keyof VehicleFormData, value: string): unknown {
  if (!value) return null;

  switch (key) {
    case "year":
    case "mileage":
    case "days_in_stock": {
      // These are always integers, so any "," or "." is a thousands
      // separator (e.g. "179,000" or "160.000"), never a decimal point.
      const parsed = parseInt(value.replace(/[,.]/g, ""), 10);
      return Number.isNaN(parsed) ? null : parsed;
    }
    case "my_cost":
    case "repair_cost":
    case "retail_price": {
      const parsed = parseFloat(value.replace(/[$,]/g, ""));
      return Number.isNaN(parsed) ? null : parsed;
    }
    case "listed_online":
      return ["true", "yes", "1", "y"].includes(value.toLowerCase());
    default:
      return value;
  }
}

// Applies a dealer-confirmed mapping to raw CSV rows, producing importable
// vehicle rows. Rows missing both make and model are dropped as unusable.
export function applyColumnMapping(
  parsed: ParsedCsv,
  mapping: ColumnMapping
): VehicleFormData[] {
  const headerIndex = new Map(parsed.headers.map((h, i) => [h, i]));

  const vehicles: VehicleFormData[] = [];

  for (const row of parsed.rows) {
    const vehicle: VehicleFormData = {};

    for (const field of TARGET_FIELDS) {
      const header = mapping[field.key];
      if (!header) continue;
      const index = headerIndex.get(header);
      if (index == null || row[index] === undefined) continue;

      if (field.key === "image_url") {
        const urls = parseImageUrls(row[index]);
        if (urls.length === 0) continue;
        vehicle.image_urls = urls;
        vehicle.image_url = urls[0];
        continue;
      }

      (vehicle as Record<string, unknown>)[field.key] = parseValue(
        field.key,
        row[index]
      );
    }

    if (vehicle.make || vehicle.model) {
      vehicles.push(vehicle);
    }
  }

  return vehicles;
}
