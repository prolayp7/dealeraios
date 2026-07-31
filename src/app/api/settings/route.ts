import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionDealership } from "@/lib/supabase/session";
import { maskAirtableConfig, mergeAirtableConfigUpdate, DEFAULT_AIRTABLE_CONFIG } from "@/lib/airtable-config";

function withMaskedAirtableConfig(row: Record<string, unknown>) {
  return {
    ...row,
    airtable_config: maskAirtableConfig(
      (row.airtable_config as typeof DEFAULT_AIRTABLE_CONFIG | undefined) ?? DEFAULT_AIRTABLE_CONFIG
    ),
  };
}

export async function GET() {
  try {
    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("dealership_settings")
      .select("*")
      .eq("dealership_id", session.dealershipId)
      .maybeSingle();

    if (error) throw error;

    if (data) return NextResponse.json(withMaskedAirtableConfig(data));

    // First load for this dealership — create the default row.
    const { data: created, error: createError } = await supabase
      .from("dealership_settings")
      .insert({ dealership_id: session.dealershipId })
      .select()
      .single();

    if (createError) throw createError;

    return NextResponse.json(withMaskedAirtableConfig(created));
  } catch (error) {
    console.error("GET /api/settings:", error);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const allowedFields = [
      "company",
      "inactivity_threshold_hours",
      "ai_settings",
      "airtable_config",
    ];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (!(field in body)) continue;

      if (field === "airtable_config") {
        const { data: existingRow, error: existingError } = await supabase
          .from("dealership_settings")
          .select("airtable_config")
          .eq("dealership_id", session.dealershipId)
          .maybeSingle();

        if (existingError) throw existingError;

        const existing = (existingRow?.airtable_config as typeof DEFAULT_AIRTABLE_CONFIG | undefined) ?? DEFAULT_AIRTABLE_CONFIG;
        updates.airtable_config = mergeAirtableConfigUpdate(existing, body.airtable_config);
        continue;
      }

      updates[field] = body[field];
    }

    const { data, error } = await supabase
      .from("dealership_settings")
      .upsert(
        { dealership_id: session.dealershipId, ...updates },
        { onConflict: "dealership_id" }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(withMaskedAirtableConfig(data));
  } catch (error) {
    console.error("PATCH /api/settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
