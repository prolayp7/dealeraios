export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime: string;
}

export interface AirtableClientConfig {
  personalAccessToken: string;
  baseId: string;
  tableName: string;
}

function tableUrl(config: AirtableClientConfig, suffix = ""): string {
  return `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(config.tableName)}${suffix}`;
}

export interface AirtableFieldSchema {
  id: string;
  name: string;
  type: string;
  // Only present for singleSelect/multipleSelects fields.
  choices?: string[];
}

interface AirtableTableSchema {
  id: string;
  name: string;
  fields: {
    id: string;
    name: string;
    type: string;
    options?: { choices?: { id: string; name: string }[] };
  }[];
}

async function airtableFetch(
  url: string,
  config: AirtableClientConfig,
  init?: RequestInit
): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.personalAccessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message =
      (body as { error?: { message?: string } })?.error?.message ??
      `Airtable request failed with status ${response.status}`;
    throw new Error(message);
  }

  const body = await response.json();
  return body;
}

// Record-sampling (listAirtableRecords) only surfaces fields that have a
// non-empty value on at least one sampled row, so a freshly-added field
// (e.g. a Last Modified Time column no existing row has triggered yet)
// silently doesn't show up. The base schema is authoritative and complete
// regardless of data, so prefer it; callers fall back to sampling if the
// PAT lacks the `schema.bases:read` scope this endpoint requires.
export async function getAirtableTableSchema(
  config: AirtableClientConfig
): Promise<AirtableFieldSchema[]> {
  const body = (await airtableFetch(
    `https://api.airtable.com/v0/meta/bases/${config.baseId}/tables`,
    config
  )) as { tables: AirtableTableSchema[] };

  const table = (body.tables ?? []).find((t) => t.name === config.tableName);
  if (!table) throw new Error(`Table "${config.tableName}" not found in base schema`);

  return table.fields.map((field) => ({
    id: field.id,
    name: field.name,
    type: field.type,
    choices: field.options?.choices?.map((choice) => choice.name),
  }));
}

export async function getAirtableTableFieldNames(
  config: AirtableClientConfig
): Promise<string[]> {
  const fields = await getAirtableTableSchema(config);
  return fields.map((field) => field.name);
}

export async function listAirtableRecords(
  config: AirtableClientConfig,
  options?: { pageSize?: number; offset?: string }
): Promise<{ records: AirtableRecord[]; offset?: string }> {
  const params = new URLSearchParams();
  if (options?.pageSize) params.set("pageSize", String(options.pageSize));
  if (options?.offset) params.set("offset", options.offset);
  const query = params.toString() ? `?${params.toString()}` : "";

  const body = (await airtableFetch(tableUrl(config, query), config)) as {
    records: AirtableRecord[];
    offset?: string;
  };

  return { records: body.records ?? [], offset: body.offset };
}

export async function listAllAirtableRecords(
  config: AirtableClientConfig
): Promise<AirtableRecord[]> {
  const all: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const page = await listAirtableRecords(config, { pageSize: 100, offset });
    all.push(...page.records);
    offset = page.offset;
  } while (offset);

  return all;
}

// typecast lets Airtable auto-create a missing select option (e.g. this
// app's "In Stock" status has no matching choice yet in the dealer's base)
// instead of hard-rejecting the write — the same server-side coercion the
// Airtable web UI relies on when you type a new option into a select cell.
export async function createAirtableRecord(
  config: AirtableClientConfig,
  fields: Record<string, unknown>
): Promise<AirtableRecord> {
  return (await airtableFetch(tableUrl(config), config, {
    method: "POST",
    body: JSON.stringify({ fields, typecast: true }),
  })) as AirtableRecord;
}

export async function updateAirtableRecord(
  config: AirtableClientConfig,
  recordId: string,
  fields: Record<string, unknown>
): Promise<AirtableRecord> {
  return (await airtableFetch(tableUrl(config, `/${recordId}`), config, {
    method: "PATCH",
    body: JSON.stringify({ fields, typecast: true }),
  })) as AirtableRecord;
}
