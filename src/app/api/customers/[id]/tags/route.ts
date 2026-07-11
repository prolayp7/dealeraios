import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionDealership } from "@/lib/supabase/session";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { tag_id } = await request.json();
    if (!tag_id) {
      return NextResponse.json({ error: "tag_id is required" }, { status: 400 });
    }

    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { error } = await supabase.from("customer_tags").insert({
      customer_id: params.id,
      tag_id,
      dealership_id: session.dealershipId,
    });

    // Already-tagged is not an error — treat it as a no-op success.
    if (error && error.code !== "23505") throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/customers/[id]/tags:", error);
    return NextResponse.json({ error: "Failed to tag customer" }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get("tag_id");
    if (!tagId) {
      return NextResponse.json({ error: "tag_id is required" }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { error } = await supabase
      .from("customer_tags")
      .delete()
      .eq("customer_id", params.id)
      .eq("tag_id", tagId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/customers/[id]/tags:", error);
    return NextResponse.json({ error: "Failed to remove tag" }, { status: 500 });
  }
}
