import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listAllAirtableRecords,
  createAirtableRecord,
  updateAirtableRecord,
  type AirtableClientConfig,
  type AirtableRecord,
} from "@/lib/airtable-client";
import { mapAirtableFieldsToVehicle, mapVehicleToAirtableFields } from "@/lib/airtable-field-mapping";
import { enrichVehicle } from "@/lib/vehicle-logic";
import type { AirtableConfig, Vehicle } from "@/lib/types";

export type SyncDirection = "pull" | "push" | "none";

export function decideSyncDirection(params: {
  airtableModifiedAt: Date | null;
  localUpdatedAt: Date;
  syncedAt: Date | null;
}): SyncDirection {
  const { airtableModifiedAt, localUpdatedAt, syncedAt } = params;

  const airtableChanged = !syncedAt || (airtableModifiedAt != null && airtableModifiedAt > syncedAt);
  const localChanged = !syncedAt || localUpdatedAt > syncedAt;

  if (!airtableChanged && !localChanged) return "none";
  if (airtableChanged && localChanged) {
    if (airtableModifiedAt != null && airtableModifiedAt > localUpdatedAt) return "pull";
    return "push";
  }
  return airtableChanged ? "pull" : "push";
}

export interface SyncResult {
  created: number;
  updated: number;
  pushedToAirtable: number;
  errors: string[];
}

function toClientConfig(config: AirtableConfig): AirtableClientConfig {
  return {
    personalAccessToken: config.personal_access_token,
    baseId: config.base_id,
    tableName: config.table_name,
  };
}

async function pullIntoVehicle(
  supabase: SupabaseClient,
  vehicle: Vehicle,
  record: AirtableRecord,
  config: AirtableConfig
): Promise<void> {
  const mapped = await mapAirtableFieldsToVehicle(record.fields, config.column_mapping);
  // Merge onto the full existing row so unmapped, app-only columns (market data,
  // FB listing state, photos, ...) survive a pull. Airtable's mapped fields win
  // where present; a field cleared in Airtable is absent from `mapped` and keeps
  // its local value (documented trade-off — no field-level clear propagation).
  const enriched = enrichVehicle({ ...vehicle, ...mapped, id: vehicle.id });

  const { error } = await supabase
    .from("vehicles")
    .update({ ...enriched, airtable_synced_at: new Date().toISOString() })
    .eq("id", vehicle.id);

  if (error) throw error;
}

async function pushFromVehicle(
  clientConfig: AirtableClientConfig,
  supabase: SupabaseClient,
  vehicle: Vehicle,
  config: AirtableConfig
): Promise<void> {
  const fields = mapVehicleToAirtableFields(vehicle, config.column_mapping);
  await updateAirtableRecord(clientConfig, vehicle.airtable_record_id as string, fields);

  const { error } = await supabase
    .from("vehicles")
    .update({ airtable_synced_at: new Date().toISOString() })
    .eq("id", vehicle.id);

  if (error) throw error;
}

async function createVehicleFromAirtableRecord(
  supabase: SupabaseClient,
  dealershipId: string,
  record: AirtableRecord,
  config: AirtableConfig
): Promise<void> {
  const mapped = await mapAirtableFieldsToVehicle(record.fields, config.column_mapping);
  const enriched = enrichVehicle({ ...mapped, id: crypto.randomUUID() });

  const { error } = await supabase.from("vehicles").insert({
    ...enriched,
    dealership_id: dealershipId,
    airtable_record_id: record.id,
    airtable_synced_at: new Date().toISOString(),
  });

  if (error) throw error;
}

export async function syncDealershipAirtable(
  dealershipId: string,
  config: AirtableConfig,
  supabase: SupabaseClient
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, pushedToAirtable: 0, errors: [] };
  const clientConfig = toClientConfig(config);

  const airtableRecords = await listAllAirtableRecords(clientConfig);
  const airtableById = new Map(airtableRecords.map((record) => [record.id, record]));

  const { data: linkedVehicles, error: linkedError } = await supabase
    .from("vehicles")
    .select("*")
    .eq("dealership_id", dealershipId)
    .not("airtable_record_id", "is", null);

  if (linkedError) throw linkedError;

  const linkedRecordIds = new Set(((linkedVehicles ?? []) as Vehicle[]).map((v) => v.airtable_record_id));

  for (const vehicle of (linkedVehicles ?? []) as Vehicle[]) {
    const record = airtableById.get(vehicle.airtable_record_id as string);
    if (!record) continue; // no deletion propagation — explicit non-goal

    const airtableModifiedRaw = record.fields[config.last_modified_field];
    const direction = decideSyncDirection({
      airtableModifiedAt: airtableModifiedRaw ? new Date(String(airtableModifiedRaw)) : null,
      localUpdatedAt: new Date(vehicle.updated_at),
      syncedAt: vehicle.airtable_synced_at ? new Date(vehicle.airtable_synced_at) : null,
    });

    if (direction === "none") continue;

    try {
      if (direction === "pull") {
        await pullIntoVehicle(supabase, vehicle, record, config);
      } else {
        await pushFromVehicle(clientConfig, supabase, vehicle, config);
      }
      result.updated++;
    } catch (err) {
      result.errors.push(`Vehicle ${vehicle.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  for (const record of airtableRecords) {
    if (linkedRecordIds.has(record.id)) continue;
    try {
      await createVehicleFromAirtableRecord(supabase, dealershipId, record, config);
      result.created++;
    } catch (err) {
      result.errors.push(`Airtable record ${record.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const { data: unlinkedVehicles, error: unlinkedError } = await supabase
    .from("vehicles")
    .select("*")
    .eq("dealership_id", dealershipId)
    .is("airtable_record_id", null);

  if (unlinkedError) throw unlinkedError;

  for (const vehicle of (unlinkedVehicles ?? []) as Vehicle[]) {
    try {
      const fields = mapVehicleToAirtableFields(vehicle, config.column_mapping);
      const record = await createAirtableRecord(clientConfig, fields);
      const { error } = await supabase
        .from("vehicles")
        .update({ airtable_record_id: record.id, airtable_synced_at: new Date().toISOString() })
        .eq("id", vehicle.id);
      if (error) throw error;
      result.pushedToAirtable++;
    } catch (err) {
      result.errors.push(`Vehicle ${vehicle.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
