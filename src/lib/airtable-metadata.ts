import { airtableFetch, AirtableApiError } from "@/lib/airtable-client";

export interface AirtableBaseConfig {
  personalAccessToken: string;
  baseId: string;
}

export interface AirtableTableField {
  id: string;
  name: string;
  type: string;
  options?: Record<string, unknown>;
}

export interface AirtableTable {
  id: string;
  name: string;
  fields: AirtableTableField[];
}

// Airtable's Metadata API only lets you *create* these types — the rest
// (attachments, linked records, formula/rollup/lookup/autoNumber/button/
// created-or-modified time) are either UI-only or need meaningfully more
// product surface (upload flow, cross-table picker) than a V1 warrants.
export const CREATABLE_FIELD_TYPES = [
  "singleLineText",
  "multilineText",
  "number",
  "singleSelect",
  "multipleSelects",
  "checkbox",
  "date",
  "currency",
  "email",
  "url",
  "phoneNumber",
] as const;

export type CreatableFieldType = (typeof CREATABLE_FIELD_TYPES)[number];

export function isCreatableFieldType(type: string): type is CreatableFieldType {
  return (CREATABLE_FIELD_TYPES as readonly string[]).includes(type);
}

function metaTablesUrl(config: AirtableBaseConfig): string {
  return `https://api.airtable.com/v0/meta/bases/${config.baseId}/tables`;
}

export async function listAirtableTables(
  config: AirtableBaseConfig
): Promise<AirtableTable[]> {
  const body = (await airtableFetch(metaTablesUrl(config), config)) as {
    tables: AirtableTable[];
  };
  return body.tables ?? [];
}

export async function createAirtableField(
  config: AirtableBaseConfig,
  tableId: string,
  field: { name: string; type: CreatableFieldType; options?: Record<string, unknown> }
): Promise<AirtableTableField> {
  return (await airtableFetch(`${metaTablesUrl(config)}/${tableId}/fields`, config, {
    method: "POST",
    body: JSON.stringify(field),
  })) as AirtableTableField;
}

// Airtable's API only supports renaming an existing field, not retyping it —
// pick wrong at creation, recreate the field.
export async function renameAirtableField(
  config: AirtableBaseConfig,
  tableId: string,
  fieldId: string,
  name: string
): Promise<AirtableTableField> {
  return (await airtableFetch(
    `${metaTablesUrl(config)}/${tableId}/fields/${fieldId}`,
    config,
    { method: "PATCH", body: JSON.stringify({ name }) }
  )) as AirtableTableField;
}

export { AirtableApiError };
