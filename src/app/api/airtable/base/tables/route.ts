import { NextResponse } from "next/server";
import { getSessionDealership } from "@/lib/supabase/session";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_AIRTABLE_CONFIG } from "@/lib/airtable-config";
import { listAirtableTables, AirtableApiError } from "@/lib/airtable-metadata";
import type { AirtableConfig } from "@/lib/types";

// Separate from the vehicle sync's Integration panel: any authenticated
// staff user can browse tables/records here (same permission level as
// editing a vehicle today); only schema changes are admin-gated, in the
// [tableId]/fields routes.
export async function GET() {
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
    if (!config.personal_access_token || !config.base_id) {
      return NextResponse.json(
        { error: "Connect Airtable in Settings before browsing tables" },
        { status: 400 }
      );
    }

    const tables = await listAirtableTables({
      personalAccessToken: config.personal_access_token,
      baseId: config.base_id,
    });

    return NextResponse.json({ tables });
  } catch (error) {
    console.error("GET /api/airtable/base/tables:", error);
    if (error instanceof AirtableApiError && error.status === 403) {
      return NextResponse.json(
        {
          error:
            "Your Airtable token needs additional permissions — regenerate it with schema read/write access in Airtable and re-save it in Settings.",
        },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: "Failed to load Airtable tables" }, { status: 500 });
  }
}
