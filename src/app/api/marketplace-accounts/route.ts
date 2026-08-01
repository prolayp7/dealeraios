// src/app/api/marketplace-accounts/route.ts
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionDealership } from "@/lib/supabase/session";
import { encryptSecret } from "@/lib/marketplace-accounts/crypto";
import { toSafeAccount, type MarketplaceAccountRow } from "@/lib/marketplace-accounts/types";
import { validateCreateAccountBody } from "@/lib/marketplace-accounts/validation";
import { ScraperError } from "@/lib/fb-scraper/types";
import { mapExtensionCookies } from "@/lib/fb-scraper/fb-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  try {
    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("marketplace_accounts")
      .select("*")
      .eq("dealership_id", session.dealershipId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json(
      (data as MarketplaceAccountRow[]).map(toSafeAccount)
    );
  } catch (error) {
    console.error("GET /api/marketplace-accounts:", error);
    return NextResponse.json({ error: "Failed to load marketplace accounts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const validation = validateCreateAccountBody(body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { label, cookies } = validation.value;

    const folderId = process.env.MULTILOGIN_FOLDER_ID;
    if (!folderId) {
      return NextResponse.json(
        { error: "Server is missing MULTILOGIN_FOLDER_ID" },
        { status: 500 }
      );
    }

    const { createMultiloginProfile, deleteMultiloginProfile } = await import(
      "@/lib/fb-scraper/multilogin"
    );
    const { runLoginJob } = await import("@/lib/marketplace-accounts/login-job");

    const profileId = await createMultiloginProfile(folderId, label);

    // Generated here (rather than left to the table's DEFAULT) because
    // encryptSecret's AAD context must be the row's id, and that id has to
    // exist before the row does — a client-generated UUID is a normal
    // Postgres insert pattern and overrides the DEFAULT cleanly.
    const accountId = randomUUID();

    let inserted: { id: string };
    try {
      const { data, error: insertError } = await supabase
        .from("marketplace_accounts")
        .insert({
          id: accountId,
          dealership_id: session.dealershipId,
          label,
          auth_method: "cookies",
          encrypted_cookies: encryptSecret(JSON.stringify(mapExtensionCookies(cookies)), accountId),
          multilogin_profile_id: profileId,
          multilogin_folder_id: folderId,
          status: "pending",
        })
        .select()
        .single();

      if (insertError) throw insertError;
      inserted = data;
    } catch (err) {
      await deleteMultiloginProfile(profileId).catch((cleanupErr) =>
        console.error("Failed to clean up orphaned Multilogin profile:", cleanupErr)
      );
      throw err;
    }

    try {
      await runLoginJob(supabase, inserted.id);
    } catch (err) {
      await supabase
        .from("marketplace_accounts")
        .update({
          status: "error",
          status_message: err instanceof Error ? err.message : "Login attempt failed unexpectedly",
        })
        .eq("id", inserted.id);
      throw err;
    }

    const { data: final, error: finalError } = await supabase
      .from("marketplace_accounts")
      .select("*")
      .eq("id", inserted.id)
      .single();

    if (finalError) throw finalError;

    return NextResponse.json(toSafeAccount(final as MarketplaceAccountRow));
  } catch (error) {
    console.error("POST /api/marketplace-accounts:", error);
    if (error instanceof ScraperError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Failed to create marketplace account" }, { status: 500 });
  }
}
