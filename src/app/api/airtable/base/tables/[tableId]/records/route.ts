import { NextResponse } from "next/server";
import { getSessionDealership } from "@/lib/supabase/session";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_AIRTABLE_CONFIG } from "@/lib/airtable-config";
import { listAirtableRecords, createAirtableRecord, AirtableApiError } from "@/lib/airtable-client";
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
        { error: "That table no longer exists — refresh and try again." },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export async function GET(request: Request, props: { params: Promise<{ tableId: string }> }) {
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
        { error: "Connect Airtable in Settings before browsing records" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const offset = searchParams.get("offset") ?? undefined;

    const { records, offset: nextOffset } = await listAirtableRecords(
      { ...clientConfig, tableName: params.tableId },
      { pageSize: 50, offset }
    );

    return NextResponse.json({ records, offset: nextOffset ?? null });
  } catch (error) {
    return airtableErrorResponse(error, "Failed to load records");
  }
}

export async function POST(request: Request, props: { params: Promise<{ tableId: string }> }) {
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
        { error: "Connect Airtable in Settings before adding records" },
        { status: 400 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as { fields?: Record<string, unknown> };

    const record = await createAirtableRecord(
      { ...clientConfig, tableName: params.tableId },
      body.fields ?? {}
    );

    return NextResponse.json({ record });
  } catch (error) {
    return airtableErrorResponse(error, "Failed to create record");
  }
}
