import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionDealership } from "@/lib/supabase/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (body.customer_id) {
      const { data, error } = await supabase
        .from("customers")
        .update({ source: "manual", notes: body.notes ?? undefined })
        .eq("id", body.customer_id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data, { status: 200 });
    }

    const { data, error } = await supabase
      .from("customers")
      .insert({
        dealership_id: session.dealershipId,
        name: body.name ?? "Unknown",
        phone: body.phone ?? null,
        email: body.email ?? null,
        fb_profile_url: body.fb_profile_url ?? null,
        fb_messenger_id: body.fb_messenger_id ?? null,
        fb_conversation_id: body.fb_conversation_id ?? null,
        source: body.source ?? "manual",
        notes: body.notes ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/customers:", error);
    return NextResponse.json(
      { error: "Failed to save customer" },
      { status: 500 }
    );
  }
}
