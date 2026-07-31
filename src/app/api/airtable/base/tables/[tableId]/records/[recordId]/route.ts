import { NextResponse } from "next/server";
import { getSessionDealership } from "@/lib/supabase/session";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_AIRTABLE_CONFIG } from "@/lib/airtable-config";
import { updateAirtableRecord, AirtableApiError } from "@/lib/airtable-client";
import type { AirtableConfig } from "@/lib/types";

async function resolveClientConfig(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  dealershipId: string
) {
  const { data: settings, error } = await supabase
    .from("dealership_settings")
    .select("airtable_config")
    .eq("dealership_id", dealershipId)
    .maybeSingle();

  if (error) throw error;

  const config = (settings?.airtable_config as AirtableConfig | undefined) ?? DEFAULT_AIRTABLE_CONFIG;
  if (!config.personal_access_token || !config.base_id) return null;
  return { personalAccessToken: config.personal_access_token, baseId: config.base_id };
}

function airtableErrorResponse(error: unknown, fallbackMessage: string) {
  console.error(fallbackMessage, error);
  if (error instanceof AirtableApiError) {
    if (error.status === 403) {
      return NextResponse.json(
        {
          error:
            "Your Airtable token needs additional permissions — regenerate it with schema read/write access in Airtable and re-save it in Settings.",
        },
        { status: 403 }
      );
    }
    if (error.status === 404) {
      return NextResponse.json(
        { error: "That record no longer exists — refresh and try again." },
        { status: 404 }
      );
    }
    if (error.status === 422) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ tableId: string; recordId: string }> }
) {
  const params = await props.params;
  try {
    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const clientConfig = await resolveClientConfig(supabase, session.dealershipId);
    if (!clientConfig) {
      return NextResponse.json(
        { error: "Connect Airtable in Settings before editing records" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as { fields?: Record<string, unknown> };
    if (!body.fields || Object.keys(body.fields).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const record = await updateAirtableRecord(
      { ...clientConfig, tableName: params.tableId },
      params.recordId,
      body.fields
    );

    return NextResponse.json({ record });
  } catch (error) {
    return airtableErrorResponse(error, "Failed to update record");
  }
}
