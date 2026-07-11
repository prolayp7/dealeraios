import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionDealership } from "@/lib/supabase/session";
import { MARKET_SOURCES } from "@/lib/market-sources";
import { scoreOpportunity } from "@/lib/acquisition";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("acquisition_opportunities")
      .select("*")
      .order("discovered_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("GET /api/acquisition:", error);
    return NextResponse.json({ error: "Failed to load opportunities" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { make, model } = await request.json();
    if (!make && !model) {
      return NextResponse.json({ error: "make or model is required" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "AI API key not configured" }, { status: 500 });
    }

    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const sourceResults = await Promise.all(
      MARKET_SOURCES.map(async (source) => {
        const result = await source.search({ make: make ?? "", model: model ?? "" });
        return { source, result };
      })
    );

    const scored = [];
    for (const { source, result } of sourceResults) {
      for (const listing of result.listings) {
        scored.push(await scoreOpportunity(source.label, listing));
      }
    }

    if (scored.length > 0) {
      const { error: insertError } = await supabase.from("acquisition_opportunities").insert(
        scored.map((o) => ({ ...o, dealership_id: session.dealershipId }))
      );
      if (insertError) throw insertError;
    }

    return NextResponse.json({
      found: scored.length,
      opportunities: scored,
      sources: sourceResults.map(({ source, result }) => ({
        id: source.id,
        label: source.label,
        status: result.status,
        listingCount: result.listings.length,
        error: result.error ?? null,
      })),
    });
  } catch (error) {
    console.error("POST /api/acquisition:", error);
    return NextResponse.json({ error: "Failed to scan for opportunities" }, { status: 500 });
  }
}
