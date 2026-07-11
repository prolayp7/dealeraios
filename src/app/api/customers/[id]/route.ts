import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { Tag } from "@/lib/types";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createServerClient();

    const { data: customerRow, error: customerError } = await supabase
      .from("customers")
      .select("*, customer_tags(tags(*))")
      .eq("id", params.id)
      .single();

    if (customerError || !customerRow) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const { customer_tags, ...customerFields } = customerRow as {
      customer_tags: { tags: Tag }[];
    } & Record<string, unknown>;
    const customer = { ...customerFields, tags: customer_tags.map((ct) => ct.tags) };

    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .eq("customer_id", params.id)
      .order("timestamp", { ascending: true });

    const { data: inquiries } = await supabase
      .from("customer_inquiries")
      .select("*, vehicles(id, year, make, model, retail_price, status)")
      .eq("customer_id", params.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      customer,
      messages: messages ?? [],
      inquiries: inquiries ?? [],
    });
  } catch (error) {
    console.error("GET /api/customers/[id]:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const body = await request.json();
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("customers")
      .update({
        name: body.name,
        phone: body.phone,
        email: body.email,
        notes: body.notes,
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("PATCH /api/customers/[id]:", error);
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 }
    );
  }
}
