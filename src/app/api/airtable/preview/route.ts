import { NextResponse } from "next/server";
import { getSessionDealership } from "@/lib/supabase/session";
import { createServerClient } from "@/lib/supabase/server";
import { listAirtableRecords } from "@/lib/airtable-client";

interface PreviewRequestBody {
  personalAccessToken: string;
  baseId: string;
  tableName: string;
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await request.json()) as PreviewRequestBody;
    if (!body.personalAccessToken || !body.baseId || !body.tableName) {
      return NextResponse.json(
        { error: "personalAccessToken, baseId, and tableName are required" },
        { status: 400 }
      );
    }

    const { records } = await listAirtableRecords(
      {
        personalAccessToken: body.personalAccessToken,
        baseId: body.baseId,
        tableName: body.tableName,
      },
      { pageSize: 20 }
    );

    const fieldNames = Array.from(
      new Set(records.flatMap((record) => Object.keys(record.fields)))
    );

    return NextResponse.json({ fieldNames, sampleCount: records.length });
  } catch (error) {
    console.error("POST /api/airtable/preview:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to preview Airtable base" },
      { status: 500 }
    );
  }
}
