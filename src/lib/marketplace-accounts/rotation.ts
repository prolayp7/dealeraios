import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cookie } from "playwright-core";
import { decryptSecret } from "./crypto";

export interface RotationAccount {
  id: string;
  multiloginProfileId: string;
  multiloginFolderId: string;
  cookies: Cookie[];
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
    .select("id, encrypted_cookies, multilogin_profile_id, multilogin_folder_id, last_used_at")
    .eq("dealership_id", dealershipId)
    .eq("status", "active");

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const nextId = pickNextAccount(
    data.map((row) => ({ id: row.id, last_used_at: row.last_used_at }))
  );
  const chosen = data.find((row) => row.id === nextId);

  if (!chosen || !chosen.encrypted_cookies || !chosen.multilogin_profile_id || !chosen.multilogin_folder_id) {
    return null;
  }

  const cookies = JSON.parse(decryptSecret(chosen.encrypted_cookies, chosen.id)) as Cookie[];

  return {
    id: chosen.id,
    multiloginProfileId: chosen.multilogin_profile_id,
    multiloginFolderId: chosen.multilogin_folder_id,
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
