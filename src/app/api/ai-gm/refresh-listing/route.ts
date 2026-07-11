import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// Refreshing a listing always requires this explicit, dealer-initiated call —
// nothing in the app triggers it automatically (Answers §6/Q22).
export async function POST(request: Request) {
  try {
    const { vehicle_id } = await request.json();
    if (!vehicle_id) {
      return NextResponse.json({ error: "vehicle_id is required" }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("vehicles")
      .update({ fb_listed_at: new Date().toISOString() })
      .eq("id", vehicle_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, vehicle: data });
  } catch (error) {
    console.error("POST /api/ai-gm/refresh-listing:", error);
    return NextResponse.json(
      { error: "Failed to refresh listing" },
      { status: 500 }
    );
  }
}
