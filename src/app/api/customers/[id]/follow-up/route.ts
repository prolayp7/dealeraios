import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { generateFollowUpMessage } from "@/lib/lead-follow-up";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { customTemplate } = await request.json().catch(() => ({}));

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "AI API key not configured" }, { status: 500 });
    }

    const supabase = await createServerClient();

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("name")
      .eq("id", params.id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const { data: messages } = await supabase
      .from("messages")
      .select("message, direction")
      .eq("customer_id", params.id)
      .order("timestamp", { ascending: true });

    const message = await generateFollowUpMessage(
      customer,
      messages ?? [],
      customTemplate
    );

    return NextResponse.json({ message });
  } catch (error) {
    console.error("POST /api/customers/[id]/follow-up:", error);
    return NextResponse.json(
      { error: "Failed to generate follow-up message" },
      { status: 500 }
    );
  }
}
