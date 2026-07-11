import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { ConversationSummary, Customer, Message, Tag } from "@/lib/types";

export async function GET() {
  try {
    const supabase = await createServerClient();

    const { data: customerRows, error } = await supabase
      .from("customers")
      .select("*, customer_tags(tags(*))")
      .order("created_at", { ascending: false });

    if (error) throw error;

    type Row = { customer_tags: { tags: Tag }[] } & Record<string, unknown>;
    const customers = (customerRows ?? []).map((row) => {
      const { customer_tags, ...customer } = row as Row;
      return { ...customer, tags: customer_tags.map((ct) => ct.tags) } as Customer;
    });

    const summaries: ConversationSummary[] = [];

    for (const customer of customers) {
      const { data: messages } = await supabase
        .from("messages")
        .select("*")
        .eq("customer_id", customer.id)
        .order("timestamp", { ascending: false });

      const msgs = (messages ?? []) as Message[];
      const lastMsg = msgs[0];
      const unreadCount = msgs.filter(
        (m) => m.direction === "inbound" && !m.read
      ).length;

      summaries.push({
        customer,
        last_message: lastMsg?.message ?? null,
        last_message_at: lastMsg?.timestamp ?? null,
        unread_count: unreadCount,
      });
    }

    summaries.sort((a, b) => {
      const aTime = a.last_message_at
        ? new Date(a.last_message_at).getTime()
        : 0;
      const bTime = b.last_message_at
        ? new Date(b.last_message_at).getTime()
        : 0;
      return bTime - aTime;
    });

    return NextResponse.json(summaries);
  } catch (error) {
    console.error("GET /api/messenger/conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}
