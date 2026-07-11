import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  getAuctionCandidates,
  getPortfolioPricing,
  getStaleListings,
} from "@/lib/ai-gm-recommendations";
import type { Vehicle } from "@/lib/types";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.from("vehicles").select("*");

    if (error) throw error;

    const vehicles = (data ?? []) as Vehicle[];

    return NextResponse.json({
      auctionCandidates: getAuctionCandidates(vehicles),
      portfolioPricing: getPortfolioPricing(vehicles),
      staleListings: getStaleListings(vehicles),
    });
  } catch (error) {
    console.error("GET /api/ai-gm/portfolio:", error);
    return NextResponse.json(
      { error: "Failed to load AI GM portfolio" },
      { status: 500 }
    );
  }
}
