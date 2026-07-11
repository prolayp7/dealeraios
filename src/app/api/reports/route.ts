import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { computeReportMetrics, resolveDateRange, type DateRangeKey } from "@/lib/report-metrics";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get("range") ?? "30d") as DateRangeKey;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;

    const { from: fromDate, to: toDate } = resolveDateRange(range, from, to);

    const supabase = await createServerClient();

    const [{ data: vehicles }, { data: transactions }, { data: messages }, { data: inquiries }] =
      await Promise.all([
        supabase.from("vehicles").select("*"),
        supabase.from("cashflow_transactions").select("*"),
        supabase.from("messages").select("*"),
        supabase.from("customer_inquiries").select("*"),
      ]);

    const metrics = computeReportMetrics(
      vehicles ?? [],
      transactions ?? [],
      messages ?? [],
      inquiries ?? [],
      fromDate,
      toDate
    );

    return NextResponse.json({
      range,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      metrics,
    });
  } catch (error) {
    console.error("GET /api/reports:", error);
    return NextResponse.json({ error: "Failed to load report metrics" }, { status: 500 });
  }
}
