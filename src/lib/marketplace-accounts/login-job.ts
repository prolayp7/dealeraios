// src/lib/marketplace-accounts/login-job.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Browser } from "playwright-core";
import {
  connectMultiloginBrowser,
} from "../fb-scraper/browser-connect";
import {
  exportCookies,
  injectCookies,
  isBlockedPage,
  isLoggedIn,
  isTwoFactorPage,
  mapExtensionCookies,
} from "../fb-scraper/fb-auth";
import {
  getMultiloginConfigForProfile,
  startMultiloginProfile,
  stopMultiloginProfile,
} from "../fb-scraper/multilogin";
import { decryptSecret, encryptSecret } from "./crypto";
import type { MarketplaceAccountRow } from "./types";

export async function runLoginJob(
  supabase: SupabaseClient,
  accountId: string
): Promise<void> {
  const { data: row, error: loadError } = await supabase
    .from("marketplace_accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  if (loadError || !row) {
    throw new Error(`Failed to load marketplace account ${accountId}: ${loadError?.message}`);
  }

  const account = row as MarketplaceAccountRow;

  if (!account.encrypted_cookies || !account.multilogin_profile_id || !account.multilogin_folder_id) {
    await supabase
      .from("marketplace_accounts")
      .update({
        status: "error",
        status_message: "Account is missing cookies or a Multilogin profile",
      })
      .eq("id", accountId);
    return;
  }

  const cookies = mapExtensionCookies(
    JSON.parse(decryptSecret(account.encrypted_cookies, account.id))
  );

  const config = await getMultiloginConfigForProfile(
    account.multilogin_profile_id,
    account.multilogin_folder_id
  );

  let browser: Browser | null = null;

  try {
    const session = await startMultiloginProfile(config);
    browser = await connectMultiloginBrowser(session);
    const context = browser.contexts()[0];
    if (!context) {
      throw new Error("No browser context from Multilogin");
    }
    const page = context.pages()[0] ?? (await context.newPage());

    await injectCookies(page, cookies);

    await page.goto("https://www.facebook.com/marketplace", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForLoadState("networkidle").catch(() => {});

    if (await isLoggedIn(page)) {
      const freshCookies = await exportCookies(page);
      await supabase
        .from("marketplace_accounts")
        .update({
          status: "active",
          status_message: null,
          last_login_at: new Date().toISOString(),
          encrypted_cookies: encryptSecret(JSON.stringify(freshCookies), account.id),
        })
        .eq("id", accountId);
      return;
    }

    if (await isBlockedPage(page)) {
      await supabase
        .from("marketplace_accounts")
        .update({
          status: "blocked",
          status_message: "Facebook flagged this login as unusual activity",
        })
        .eq("id", accountId);
      return;
    }

    if (await isTwoFactorPage(page)) {
      await supabase
        .from("marketplace_accounts")
        .update({
          status: "error",
          status_message:
            "Pasted cookies require 2FA approval — export a fresh session and re-add",
        })
        .eq("id", accountId);
      return;
    }

    await supabase
      .from("marketplace_accounts")
      .update({
        status: "error",
        status_message: `Cookie injection failed — Facebook served an unrecognized page (${page.url()})`,
      })
      .eq("id", accountId);
  } finally {
    if (browser) {
      await browser.close().catch((err) => console.error("Error closing browser:", err));
    }
    await stopMultiloginProfile(config);
  }
}
