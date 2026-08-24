import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cookie } from "playwright-core";
import { decryptSecret } from "./crypto";

export interface RotationAccount {
  id: string;
  provider: "multilogin" | "gologin";
  multiloginProfileId?: string;
  multiloginFolderId?: string;
  gologinProfileId?: string;
  cookies: Cookie[];
}

export interface RotationAccountRow {
  id: string;
  provider: "multilogin" | "gologin";
  encrypted_cookies: string | null;
  multilogin_profile_id: string | null;
  multilogin_folder_id: string | null;
  gologin_profile_id: string | null;
}

export function hasUsableProfile(row: RotationAccountRow): boolean {
  if (!row.encrypted_cookies) return false;
  if (row.provider === "gologin") return !!row.gologin_profile_id;
  return !!row.multilogin_profile_id && !!row.multilogin_folder_id;
}

export function pickNextAccount(
  accounts: { id: string; last_used_at: string | null }[]
): string | null {
  if (accounts.length === 0) return null;

  const sorted = [...accounts].sort((a, b) => {
    if (a.last_used_at === null && b.last_used_at === null) return 0;
    if (a.last_used_at === null) return -1;
    if (b.last_used_at === null) return 1;
    return a.last_used_at.localeCompare(b.last_used_at);
  });

  return sorted[0].id;
}

export async function getNextActiveAccount(
  supabase: SupabaseClient,
  dealershipId: string
): Promise<RotationAccount | null> {
  const { data, error } = await supabase
    .from("marketplace_accounts")
    .select(
      "id, encrypted_cookies, provider, multilogin_profile_id, multilogin_folder_id, gologin_profile_id, last_used_at"
    )
    .eq("dealership_id", dealershipId)
    .eq("status", "active");

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const nextId = pickNextAccount(
    data.map((row) => ({ id: row.id, last_used_at: row.last_used_at }))
  );
  const chosen = data.find((row) => row.id === nextId) as RotationAccountRow | undefined;

  if (!chosen || !hasUsableProfile(chosen)) return null;

  const cookies = JSON.parse(decryptSecret(chosen.encrypted_cookies!, chosen.id)) as Cookie[];

  return {
    id: chosen.id,
    provider: chosen.provider,
    multiloginProfileId: chosen.multilogin_profile_id ?? undefined,
    multiloginFolderId: chosen.multilogin_folder_id ?? undefined,
    gologinProfileId: chosen.gologin_profile_id ?? undefined,
    cookies,
  };
}

export async function markAccountUsed(
  supabase: SupabaseClient,
  accountId: string
): Promise<void> {
  const { error } = await supabase
    .from("marketplace_accounts")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", accountId);
  if (error) throw error;
}
