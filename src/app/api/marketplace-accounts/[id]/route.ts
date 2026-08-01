// src/app/api/marketplace-accounts/[id]/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionDealership } from "@/lib/supabase/session";
import { encryptSecret } from "@/lib/marketplace-accounts/crypto";
import { runLoginJob } from "@/lib/marketplace-accounts/login-job";
import { toSafeAccount, type MarketplaceAccountRow } from "@/lib/marketplace-accounts/types";
import { validateUpdateAccountBody } from "@/lib/marketplace-accounts/validation";
import { deleteMultiloginProfile } from "@/lib/fb-scraper/multilogin";
import { ScraperError } from "@/lib/fb-scraper/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const body = await request.json();
    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const validation = validateUpdateAccountBody(body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { label, cookies } = validation.value;

    const updates: Record<string, unknown> = {};
    if (label !== undefined) updates.label = label;
    if (cookies !== undefined) {
      updates.encrypted_cookies = encryptSecret(JSON.stringify(cookies), params.id);
      updates.status = "pending";
    }

    const { error: updateError } = await supabase
      .from("marketplace_accounts")
      .update(updates)
      .eq("id", params.id)
      .eq("dealership_id", session.dealershipId);

    if (updateError) throw updateError;

    if (cookies !== undefined) {
      try {
        await runLoginJob(supabase, params.id);
      } catch (err) {
        // Mirrors Task 9's POST fix: without this, a runLoginJob failure
        // here would leave the row stuck at status "pending" forever, since
        // runLoginJob only writes active/blocked/error from inside its own
        // try/finally — never on a throw before reaching those writes.
        await supabase
          .from("marketplace_accounts")
          .update({
            status: "error",
            status_message: err instanceof Error ? err.message : "Login attempt failed unexpectedly",
          })
          .eq("id", params.id);
        throw err;
      }
    }

    const { data: final, error: finalError } = await supabase
      .from("marketplace_accounts")
      .select("*")
      .eq("id", params.id)
      .eq("dealership_id", session.dealershipId)
      .single();

    if (finalError || !final) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    return NextResponse.json(toSafeAccount(final as MarketplaceAccountRow));
  } catch (error) {
    console.error("PATCH /api/marketplace-accounts/[id]:", error);
    if (error instanceof ScraperError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Failed to update marketplace account" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: existing, error: fetchError } = await supabase
      .from("marketplace_accounts")
      .select("multilogin_profile_id")
      .eq("id", params.id)
      .eq("dealership_id", session.dealershipId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (existing.multilogin_profile_id) {
      await deleteMultiloginProfile(existing.multilogin_profile_id).catch((err) =>
        console.error("Failed to delete Multilogin profile (continuing):", err)
      );
    }

    const { error: deleteError } = await supabase
      .from("marketplace_accounts")
      .delete()
      .eq("id", params.id)
      .eq("dealership_id", session.dealershipId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/marketplace-accounts/[id]:", error);
    return NextResponse.json({ error: "Failed to delete marketplace account" }, { status: 500 });
  }
}
