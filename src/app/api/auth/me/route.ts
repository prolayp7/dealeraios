import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionDealership } from "@/lib/supabase/session";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, role, full_name, created_at")
      .eq("id", session.userId)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/auth/me:", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const allowedFields = ["full_name"];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field];
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", session.userId)
      .select("id, email, role, full_name, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("PATCH /api/auth/me:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
