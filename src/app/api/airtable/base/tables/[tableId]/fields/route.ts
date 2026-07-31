import { NextResponse } from "next/server";
import { getSessionDealership } from "@/lib/supabase/session";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_AIRTABLE_CONFIG } from "@/lib/airtable-config";
import {
  createAirtableField,
  isCreatableFieldType,
  AirtableApiError,
} from "@/lib/airtable-metadata";
import type { AirtableConfig } from "@/lib/types";

interface CreateFieldBody {
  name?: string;
  type?: string;
  options?: Record<string, unknown>;
}

// Schema changes are admin-only, unlike the record read/create/update routes
// alongside this one — matches the pattern in /api/auth/invite.
export async function POST(request: Request, props: { params: Promise<{ tableId: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Only admins can add fields" }, { status: 403 });
    }

    const body = (await request.json()) as CreateFieldBody;
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Field name is required" }, { status: 400 });
    }
    if (!body.type || !isCreatableFieldType(body.type)) {
      return NextResponse.json(
        { error: `Unsupported field type: ${body.type ?? "(none)"}` },
        { status: 400 }
      );
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
        { error: "Connect Airtable in Settings before adding fields" },
        { status: 400 }
      );
    }

    const field = await createAirtableField(
      { personalAccessToken: config.personal_access_token, baseId: config.base_id },
      params.tableId,
      { name: body.name.trim(), type: body.type, options: body.options }
    );

    return NextResponse.json({ field });
  } catch (error) {
    console.error("POST /api/airtable/base/tables/[tableId]/fields:", error);
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
    return NextResponse.json({ error: "Failed to create field" }, { status: 500 });
  }
}
