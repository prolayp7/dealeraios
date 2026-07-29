import type { AirtableConfig } from "./types";

export const DEFAULT_AIRTABLE_CONFIG: AirtableConfig = {
  enabled: false,
  personal_access_token: "",
  base_id: "",
  table_name: "",
  last_modified_field: "Last Modified",
  column_mapping: {},
  last_synced_at: null,
  last_sync_error: null,
};

export function maskAirtableToken(token: string): string {
  if (token.length <= 8) return "••••••••";
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

export function maskAirtableConfig(config: AirtableConfig): AirtableConfig {
  return {
    ...config,
    personal_access_token: config.personal_access_token
      ? maskAirtableToken(config.personal_access_token)
      : "",
  };
}

export function isMaskedToken(value: string): boolean {
  return value === "••••••••" || /^.{4}••••.{4}$/.test(value);
}

export function mergeAirtableConfigUpdate(
  existing: AirtableConfig,
  incoming: Partial<AirtableConfig>
): AirtableConfig {
  const merged = { ...existing, ...incoming };

  const incomingToken = incoming.personal_access_token;
  if (!incomingToken || isMaskedToken(incomingToken)) {
    merged.personal_access_token = existing.personal_access_token;
  }

  return merged;
}
