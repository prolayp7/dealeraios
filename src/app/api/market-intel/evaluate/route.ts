import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionDealership } from "@/lib/supabase/session";
import { MARKET_SOURCES } from "@/lib/market-sources";
import { computeMarketEvaluation } from "@/lib/market-intel";

export async function POST(request: Request) {
  try {
    const { vehicle_id } = await request.json();
    if (!vehicle_id) {
      return NextResponse.json({ error: "vehicle_id is required" }, { status: 400 });
    }

    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: vehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .select("id, make, model, year, my_cost, repair_cost")
      .eq("id", vehicle_id)
      .single();

    if (vehicleError || !vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    // Query every registered source. Only Facebook is actually connected —
    // the other six report "not_connected" without erroring (Answers §3/Q9).
    const sourceResults = await Promise.all(
      MARKET_SOURCES.map(async (source) => {
        const result = await source.search({
          make: vehicle.make ?? "",
          model: vehicle.model ?? "",
          year: vehicle.year,
        });
        return { source, result };
      })
    );

    const newListings = sourceResults.flatMap(({ source, result }) =>
      result.listings.map((listing) => ({ source, listing }))
    );

    if (newListings.length > 0) {
      const rows = newListings.map(({ source, listing }) => ({
        dealership_id: session.dealershipId,
        vehicle_id,
        year: listing.year,
        make: listing.make,
        model: listing.model,
        mileage: listing.mileage,
        source: source.label,
        location: listing.location,
        listing_price: listing.price,
        url: listing.url,
        date_checked: new Date().toISOString().split("T")[0],
      }));

      const { error: insertError } = await supabase.from("market_comps").insert(rows);
      if (insertError) throw insertError;
    }

    const { data: allComps, error: compsError } = await supabase
      .from("market_comps")
      .select("listing_price")
      .eq("vehicle_id", vehicle_id);

    if (compsError) throw compsError;

    const prices = (allComps ?? [])
      .map((c) => c.listing_price)
      .filter((p): p is number => p != null);

    const costBasis =
      vehicle.my_cost != null || vehicle.repair_cost != null
        ? (vehicle.my_cost ?? 0) + (vehicle.repair_cost ?? 0)
        : null;

    const evaluation = computeMarketEvaluation(prices, costBasis);

    if (prices.length > 0) {
      const sorted = [...prices].sort((a, b) => a - b);
      await supabase
        .from("vehicles")
        .update({
          comp_count: prices.length,
          market_low: sorted[0],
          market_avg: Math.round(prices.reduce((s, p) => s + p, 0) / prices.length),
          market_high: sorted[sorted.length - 1],
        })
        .eq("id", vehicle_id);
    }

    return NextResponse.json({
      evaluation,
      compCount: prices.length,
      sources: sourceResults.map(({ source, result }) => ({
        id: source.id,
        label: source.label,
        status: result.status,
        listingCount: result.listings.length,
        error: result.error ?? null,
      })),
    });
  } catch (error) {
    console.error("POST /api/market-intel/evaluate:", error);
    return NextResponse.json({ error: "Failed to evaluate vehicle" }, { status: 500 });
  }
}
