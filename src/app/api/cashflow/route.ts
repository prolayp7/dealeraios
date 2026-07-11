import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionDealership } from "@/lib/supabase/session";
import type { CashflowType } from "@/lib/types";

const VALID_TYPES: CashflowType[] = [
  "vehicle_purchase",
  "vehicle_sale",
  "repair",
  "transport",
  "insurance",
  "rent",
  "payroll",
  "advertising",
  "auction_fee",
  "misc",
];

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("cashflow_transactions")
      .select("*")
      .order("transaction_date", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("GET /api/cashflow:", error);
    return NextResponse.json({ error: "Failed to load cashflow" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!VALID_TYPES.includes(body.type)) {
      return NextResponse.json(
        { error: `type must be one of: ${VALID_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    if (body.amount == null || body.amount < 0) {
      return NextResponse.json({ error: "amount is required and must be >= 0" }, { status: 400 });
    }

    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("cashflow_transactions")
      .insert({
        dealership_id: session.dealershipId,
        vehicle_id: body.vehicle_id ?? null,
        type: body.type,
        amount: body.amount,
        description: body.description ?? null,
        transaction_date: body.transaction_date ?? new Date().toISOString().split("T")[0],
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/cashflow:", error);
    return NextResponse.json({ error: "Failed to save transaction" }, { status: 500 });
  }
}
