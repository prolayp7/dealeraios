import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { computeMarketEvaluation } from "@/lib/market-intel";

// Groups comp rows into evaluation "events" — every batch of comps saved
// within the same minute (one "Evaluate Again" click) becomes one history
// entry, computed cumulatively from every comp known up to that point.
const GROUP_WINDOW_MS = 60_000;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const vehicleId = searchParams.get("vehicle_id");
    if (!vehicleId) {
      return NextResponse.json({ error: "vehicle_id is required" }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: comps, error } = await supabase
      .from("market_comps")
      .select("listing_price, created_at")
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const rows = (comps ?? []).filter(
      (c): c is { listing_price: number; created_at: string } =>
        c.listing_price != null && c.created_at != null
    );

    const groupKeys: number[] = [];
    for (const row of rows) {
      const t = new Date(row.created_at).getTime();
      const bucket = Math.floor(t / GROUP_WINDOW_MS);
      if (!groupKeys.includes(bucket)) groupKeys.push(bucket);
    }
    groupKeys.sort((a, b) => a - b);

    const history = groupKeys.map((bucket) => {
      const cutoff = (bucket + 1) * GROUP_WINDOW_MS;
      const cumulativePrices = rows
        .filter((r) => new Date(r.created_at).getTime() < cutoff)
        .map((r) => r.listing_price);

      return {
        timestamp: new Date(bucket * GROUP_WINDOW_MS).toISOString(),
        compCount: cumulativePrices.length,
        evaluation: computeMarketEvaluation(cumulativePrices, null),
      };
    });

    return NextResponse.json({ history });
  } catch (error) {
    console.error("GET /api/market-intel/history:", error);
    return NextResponse.json({ error: "Failed to load evaluation history" }, { status: 500 });
  }
}
