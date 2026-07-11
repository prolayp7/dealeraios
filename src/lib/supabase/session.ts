import type { SupabaseClient } from "@supabase/supabase-js";

export interface SessionDealership {
  userId: string;
  dealershipId: string;
  role: "admin" | "staff";
}

/**
 * Resolves the current user's dealership + role from their `profiles` row.
 * Returns null if there's no session or no matching profile — callers should
 * respond 401/403 rather than proceeding, since RLS relies on a valid profile
 * to scope reads and writes to the right tenant.
 */
export async function getSessionDealership(
  supabase: SupabaseClient
): Promise<SessionDealership | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("dealership_id, role")
    .eq("id", user.id)
    .single();

  if (error || !profile) return null;

  return {
    userId: user.id,
    dealershipId: profile.dealership_id,
    role: profile.role,
  };
}
