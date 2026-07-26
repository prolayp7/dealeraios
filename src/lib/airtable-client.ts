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

export async function createAirtableRecord(
  config: AirtableClientConfig,
  fields: Record<string, unknown>
): Promise<AirtableRecord> {
  return (await airtableFetch(tableUrl(config), config, {
    method: "POST",
    body: JSON.stringify({ fields }),
  })) as AirtableRecord;
}

export async function updateAirtableRecord(
  config: AirtableClientConfig,
  recordId: string,
  fields: Record<string, unknown>
): Promise<AirtableRecord> {
  return (await airtableFetch(tableUrl(config, `/${recordId}`), config, {
    method: "PATCH",
    body: JSON.stringify({ fields }),
  })) as AirtableRecord;
}
