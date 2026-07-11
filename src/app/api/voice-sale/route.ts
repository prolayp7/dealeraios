import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionDealership } from "@/lib/supabase/session";
import { parseSaleUtterance, matchVehicle } from "@/lib/voice-sale";
import { markVehicleSold } from "@/lib/vehicle-sold-automation";

export async function POST(request: Request) {
  try {
    const { transcript } = await request.json();
    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json({ error: "transcript is required" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "AI API key not configured" }, { status: 500 });
    }

    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const sale = await parseSaleUtterance(transcript);
    if (!sale.price) {
      return NextResponse.json(
        { error: "Couldn't understand a sale price from that — try again with an amount." },
        { status: 422 }
      );
    }

    const { data: vehicles, error: vehiclesError } = await supabase.from("vehicles").select("*");
    if (vehiclesError) throw vehiclesError;

    const matched = matchVehicle(sale, vehicles ?? []);
    if (!matched) {
      return NextResponse.json(
        {
          error:
            "Couldn't find a unique matching in-stock vehicle. Try including the year, make, and model.",
          parsed: sale,
        },
        { status: 422 }
      );
    }

    const result = await markVehicleSold(supabase, session.dealershipId, matched.id, sale.price);

    return NextResponse.json({ parsed: sale, ...result });
  } catch (error) {
    console.error("POST /api/voice-sale:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process voice sale" },
      { status: 500 }
    );
  }
}
