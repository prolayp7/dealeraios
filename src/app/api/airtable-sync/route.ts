import { NextResponse } from "next/server";
import { getSessionDealership } from "@/lib/supabase/session";
import { createServerClient } from "@/lib/supabase/server";
import { syncDealershipAirtable } from "@/lib/airtable-sync";
import { DEFAULT_AIRTABLE_CONFIG } from "@/lib/airtable-config";
import { errorMessage } from "@/lib/utils";
import type { AirtableConfig } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  try {
    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: settings, error: settingsError } = await supabase
      .from("dealership_settings")
      .select("airtable_config")
      .eq("dealership_id", session.dealershipId)
      .maybeSingle();

    if (settingsError) throw settingsError;

    const config = (settings?.airtable_config as AirtableConfig | undefined) ?? DEFAULT_AIRTABLE_CONFIG;
    if (!config.enabled) {
      return NextResponse.json({ error: "Airtable sync is not enabled for this dealership" }, { status: 400 });
    }

    let result;
    try {
      result = await syncDealershipAirtable(session.dealershipId, config, supabase);
    } catch (syncError) {
      const message = errorMessage(syncError);
      // Persist the error to dealership_settings even though sync failed
      try {
        await supabase
          .from("dealership_settings")
          .update({ airtable_config: { ...config, last_sync_error: message } })
          .eq("dealership_id", session.dealershipId);
      } catch (updateErr) {
        console.error("Failed to persist sync error to dealership_settings:", updateErr);
      }
      throw syncError; // Re-throw to be caught by outer catch
    }

    await supabase
      .from("dealership_settings")
      .update({
        airtable_config: {
          ...config,
          last_synced_at: new Date().toISOString(),
          last_sync_error: result.errors[0] ?? null,
        },
      })
      .eq("dealership_id", session.dealershipId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/airtable-sync:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
