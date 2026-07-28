import { NextResponse } from "next/server";
import { getSessionDealership } from "@/lib/supabase/session";
import { createServerClient } from "@/lib/supabase/server";
import { listAllAirtableRecords } from "@/lib/airtable-client";
import { mapAirtableFieldsToVehicle } from "@/lib/airtable-field-mapping";
import { enrichVehicle } from "@/lib/vehicle-logic";
import { maskAirtableConfig } from "@/lib/airtable-config";
import type { AirtableConfig } from "@/lib/types";
import { isImportableVehicle, type ColumnMapping } from "@/lib/import-column-mapper";

interface ImportRequestBody {
  personalAccessToken: string;
  baseId: string;
  tableName: string;
  lastModifiedField: string;
  columnMapping: ColumnMapping;
}

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await request.json()) as ImportRequestBody;
    if (!body.personalAccessToken || !body.baseId || !body.tableName) {
      return NextResponse.json(
        { error: "personalAccessToken, baseId, and tableName are required" },
        { status: 400 }
      );
    }

    const clientConfig = {
      personalAccessToken: body.personalAccessToken,
      baseId: body.baseId,
      tableName: body.tableName,
    };

    const records = await listAllAirtableRecords(clientConfig);

    let imported = 0;
    const errors: string[] = [];

    // Per-record error isolation: one bad row must not abort the import, because
    // the settings upsert below (which enables sync) has to run either way —
    // otherwise a partial import leaves the dealer with linked vehicles, no saved
    // config, and a retry that dies on the first duplicate airtable_record_id.
    for (const record of records) {
      try {
        const mapped = await mapAirtableFieldsToVehicle(record.fields, body.columnMapping);
        if (!isImportableVehicle(mapped)) continue;

        const enriched = enrichVehicle({ ...mapped, id: crypto.randomUUID() });
        const { error } = await supabase.from("vehicles").insert({
          ...enriched,
          dealership_id: session.dealershipId,
          airtable_record_id: record.id,
          airtable_synced_at: new Date().toISOString(),
        });

        if (error) throw error;
        imported++;
      } catch (err) {
        errors.push(
          `Airtable record ${record.id}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    const config: AirtableConfig = {
      enabled: true,
      personal_access_token: body.personalAccessToken,
      base_id: body.baseId,
      table_name: body.tableName,
      last_modified_field: body.lastModifiedField || "Last Modified",
      column_mapping: body.columnMapping,
      last_synced_at: new Date().toISOString(),
      last_sync_error: null,
    };

    const { error: settingsError } = await supabase
      .from("dealership_settings")
      .upsert({ dealership_id: session.dealershipId, airtable_config: config }, { onConflict: "dealership_id" });

    if (settingsError) throw settingsError;

    if (errors.length > 0) {
      console.error("POST /api/airtable/import: partial import failures", errors);
    }

    return NextResponse.json({ imported, errors, config: maskAirtableConfig(config) });
  } catch (error) {
    console.error("POST /api/airtable/import:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import from Airtable" },
      { status: 500 }
    );
  }
}
