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
import { isImportableVehicle } from "@/lib/import-column-mapper";
import { errorMessage } from "@/lib/utils";
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
  /** Pre-existing local vehicles matched to an Airtable record by VIN instead of duplicated. */
  linked: number;
  errors: string[];
}

// Airtable VINs arrive as free text and local ones came from a CSV import, so
// compare them case- and whitespace-insensitively. Anything that isn't a
// non-empty string/number can't be matched and is treated as "no VIN".
function normalizeVin(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const vin = String(value).trim().toUpperCase();
  return vin.length > 0 ? vin : null;
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
  const mapped = await mapAirtableFieldsToVehicle(record.fields, config.column_mapping, supabase);
  // Merge onto the full existing row so unmapped, app-only columns (market data,
  // FB listing state, photos, ...) survive a pull. Airtable's mapped fields win
  // where present; a field cleared in Airtable is absent from `mapped` and keeps
  // its local value (documented trade-off — no field-level clear propagation).
  const enriched = enrichVehicle({ ...vehicle, ...mapped, id: vehicle.id });

  // Two-step so airtable_synced_at is the *server* updated_at, not an earlier
  // client clock reading: the trigger bumps updated_at to NOW() on this data
  // write, which would otherwise land after our JS timestamp and make the next
  // decideSyncDirection see a spurious local change (=> pointless push).
  // The follow-up update touches only airtable_synced_at, which the trigger
  // excludes from its change comparison, so updated_at is not bumped again.
  const { data, error } = await supabase
    .from("vehicles")
    .update(enriched)
    .eq("id", vehicle.id)
    .select("updated_at")
    .single();

  if (error) throw error;

  // A pull is frequently a genuine no-op: because the merge above starts from
  // the full existing row, an Airtable edit that only touched a column outside
  // column_mapping produces an `enriched` identical to what's already stored.
  // The trigger's IS DISTINCT FROM check is then false, updated_at is NOT
  // bumped, and the value just read back is the stale pre-write timestamp —
  // which predates the Airtable edit that triggered this pull. Writing that
  // into airtable_synced_at would leave the record looking perpetually
  // Airtable-modified and re-pull it every cron cycle forever.
  //
  // "Did the trigger fire" is exactly "is the returned updated_at newer than
  // the one we read before the write", so compare against vehicle.updated_at.
  // On a no-op nothing was written, so there is no server timestamp to be
  // skewed against and the client clock is safe (and always converges).
  const triggerFired = new Date(data.updated_at) > new Date(vehicle.updated_at);
  const syncedAt = triggerFired ? data.updated_at : new Date().toISOString();

  const { error: syncedError } = await supabase
    .from("vehicles")
    .update({ airtable_synced_at: syncedAt })
    .eq("id", vehicle.id);

  if (syncedError) throw syncedError;
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
): Promise<boolean> {
  const mapped = await mapAirtableFieldsToVehicle(record.fields, config.column_mapping, supabase);
  // Same guard the import route applies: spacer/notes/header rows carry no make
  // or model, and creating them yields blank "LIST NOW" phantom inventory.
  if (!isImportableVehicle(mapped)) return false;

  const enriched = enrichVehicle({ ...mapped, id: crypto.randomUUID() });

  // Same two-step as pullIntoVehicle: updated_at gets its column DEFAULT NOW()
  // server-side, strictly after any client timestamp we could compute here.
  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      ...enriched,
      dealership_id: dealershipId,
      airtable_record_id: record.id,
    })
    .select("id, updated_at")
    .single();

  if (error) throw error;

  const { error: syncedError } = await supabase
    .from("vehicles")
    .update({ airtable_synced_at: data.updated_at })
    .eq("id", data.id);

  if (syncedError) throw syncedError;
  return true;
}

export async function syncDealershipAirtable(
  dealershipId: string,
  config: AirtableConfig,
  supabase: SupabaseClient
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, pushedToAirtable: 0, linked: 0, errors: [] };
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
      result.errors.push(`Vehicle ${vehicle.id}: ${errorMessage(err)}`);
    }
  }

  // Fetched once, up front: unlinked local vehicles feed both the VIN linking
  // pass below and (whatever is left over) the final push loop.
  const { data: unlinkedData, error: unlinkedError } = await supabase
    .from("vehicles")
    .select("*")
    .eq("dealership_id", dealershipId)
    .is("airtable_record_id", null);

  if (unlinkedError) throw unlinkedError;

  const unlinkedVehicles = (unlinkedData ?? []) as Vehicle[];

  // VIN linking pass. Dealerships that used the Day-1 CSV/Airtable-export
  // importer already have local copies of their Airtable rows with a null
  // airtable_record_id. Without this pass the two loops below would treat them
  // as unknown on both sides and duplicate every car in *both* systems, with no
  // deletion propagation to undo it. Match on VIN first and just link the pair.
  const unlinkedByVin = new Map<string, Vehicle>();
  for (const vehicle of unlinkedVehicles) {
    const vin = normalizeVin(vehicle.vin);
    // First writer wins on duplicate local VINs; the rest fall through to push.
    if (vin && !unlinkedByVin.has(vin)) unlinkedByVin.set(vin, vehicle);
  }

  const vinFieldName = config.column_mapping.vin;
  const newlyLinkedVehicleIds = new Set<string>();
  const unmatchedRecords: AirtableRecord[] = [];

  for (const record of airtableRecords) {
    if (linkedRecordIds.has(record.id)) continue;

    if (!vinFieldName || unlinkedByVin.size === 0) {
      unmatchedRecords.push(record);
      continue;
    }

    try {
      const vin = normalizeVin(record.fields[vinFieldName]);
      const match = vin ? unlinkedByVin.get(vin) : undefined;
      if (!vin || !match) {
        unmatchedRecords.push(record);
        continue;
      }

      // Linking only sets airtable_record_id, which the updated_at trigger
      // ignores, and leaves airtable_synced_at null so the next run's linked
      // pass reconciles the two copies by whole-record last-write-wins.
      const { error } = await supabase
        .from("vehicles")
        .update({ airtable_record_id: record.id })
        .eq("id", match.id);

      if (error) throw error;

      unlinkedByVin.delete(vin);
      newlyLinkedVehicleIds.add(match.id);
      result.linked++;
    } catch (err) {
      // Deliberately NOT falling through to create: a failed link would
      // otherwise duplicate the vehicle. Skip it and retry next sync.
      result.errors.push(`Airtable record ${record.id}: ${errorMessage(err)}`);
    }
  }

  for (const record of unmatchedRecords) {
    try {
      const created = await createVehicleFromAirtableRecord(supabase, dealershipId, record, config);
      if (created) result.created++;
    } catch (err) {
      result.errors.push(`Airtable record ${record.id}: ${errorMessage(err)}`);
    }
  }

  for (const vehicle of unlinkedVehicles) {
    if (newlyLinkedVehicleIds.has(vehicle.id)) continue;
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
      result.errors.push(`Vehicle ${vehicle.id}: ${errorMessage(err)}`);
    }
  }

  return result;
}
