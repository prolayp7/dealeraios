// src/app/api/marketplace-accounts/[id]/login/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionDealership } from "@/lib/supabase/session";
import { toSafeAccount, type MarketplaceAccountRow } from "@/lib/marketplace-accounts/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: existing, error: fetchError } = await supabase
      .from("marketplace_accounts")
      .select("id")
      .eq("id", params.id)
      .eq("dealership_id", session.dealershipId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const { runLoginJob } = await import("@/lib/marketplace-accounts/login-job");

    try {
      await runLoginJob(supabase, params.id);
    } catch (err) {
      // Same reasoning as PATCH: a throw here (before runLoginJob reaches
      // its own status-write) would otherwise leave the row silently
      // showing its previous (now stale) status/status_message.
      await supabase
        .from("marketplace_accounts")
        .update({
          status: "error",
          status_message: err instanceof Error ? err.message : "Login attempt failed unexpectedly",
        })
        .eq("id", params.id);
      throw err;
    }

    const { data: final, error: finalError } = await supabase
      .from("marketplace_accounts")
      .select("*")
      .eq("id", params.id)
      .single();

    if (finalError || !final) {
      return NextResponse.json({ error: "Account not found after retry" }, { status: 404 });
    }

    return NextResponse.json(toSafeAccount(final as MarketplaceAccountRow));
  } catch (error) {
    console.error("POST /api/marketplace-accounts/[id]/login:", error);
    return NextResponse.json({ error: "Failed to retry login" }, { status: 500 });
  }
}
