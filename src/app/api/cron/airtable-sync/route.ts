import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncDealershipAirtable, type SyncResult } from "@/lib/airtable-sync";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { DEFAULT_AIRTABLE_CONFIG } from "@/lib/airtable-config";
import type { AirtableConfig } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role client unavailable" }, { status: 500 });
  }

  const { data: rows, error } = await admin
    .from("dealership_settings")
    .select("dealership_id, airtable_config");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enabledRows = (rows ?? []).filter(
    (row) => ((row.airtable_config as AirtableConfig | undefined) ?? DEFAULT_AIRTABLE_CONFIG).enabled
  );

  const results: SyncResult[] = [];

  for (const row of enabledRows) {
    const config = row.airtable_config as AirtableConfig;

    // Try to sync
    let result;
    try {
      result = await syncDealershipAirtable(row.dealership_id, config, admin);
      results.push(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ created: 0, updated: 0, pushedToAirtable: 0, errors: [message] });
      // Update dealership_settings with error
      try {
        await admin
          .from("dealership_settings")
          .update({ airtable_config: { ...config, last_sync_error: message } })
          .eq("dealership_id", row.dealership_id);
      } catch (updateErr) {
        console.error(`Failed to update sync error for dealership ${row.dealership_id}:`, updateErr);
      }
      continue; // Skip bookkeeping update since sync failed
    }

    // Bookkeeping update (only if sync succeeded)
    try {
      await admin
        .from("dealership_settings")
        .update({
          airtable_config: {
            ...config,
            last_synced_at: new Date().toISOString(),
            last_sync_error: result.errors[0] ?? null,
          },
        })
        .eq("dealership_id", row.dealership_id);
    } catch (updateErr) {
      console.error(`Failed to update sync bookkeeping for dealership ${row.dealership_id}:`, updateErr);
      // Silently continue - result already in results array
    }
  }

  return NextResponse.json({ dealerships: enabledRows.length, results });
}
