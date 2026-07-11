import type { SupabaseClient } from "@supabase/supabase-js";
import type { Vehicle } from "@/lib/types";

export interface MarkSoldResult {
  vehicle: Vehicle;
  soldPrice: number;
  netProfit: number;
  roi: number | null;
}

/**
 * The six-step post-sale chain (Answers §8/Q28): archive the vehicle, remove
 * active marketplace listings, log the sale in the Cashflow ledger, update
 * realized profit, and leave the vehicle in a state where the dashboard and
 * AI GM pick up the change on their next fetch — both already read live from
 * the same tables, so no separate "notify" step is needed.
 */
export async function markVehicleSold(
  supabase: SupabaseClient,
  dealershipId: string,
  vehicleId: string,
  soldPrice: number
): Promise<MarkSoldResult> {
  const { data: vehicle, error: fetchError } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", vehicleId)
    .single();

  if (fetchError || !vehicle) {
    throw new Error("Vehicle not found");
  }

  const totalInvested = (vehicle.my_cost ?? 0) + (vehicle.repair_cost ?? 0);
  const netProfit = soldPrice - totalInvested;
  const roi = totalInvested > 0 ? Math.round((netProfit / totalInvested) * 1000) / 10 : null;

  const { data: updated, error: updateError } = await supabase
    .from("vehicles")
    .update({
      status: "Sold",
      listed_online: false,
      fb_listing_status: vehicle.fb_listing_status ? "sold" : vehicle.fb_listing_status,
      gross_profit: netProfit,
      net_profit: netProfit,
      roi,
      action_required: "Sold — archived",
    })
    .eq("id", vehicleId)
    .select()
    .single();

  if (updateError || !updated) {
    throw new Error("Failed to update vehicle after sale");
  }

  const { error: cashflowError } = await supabase.from("cashflow_transactions").insert({
    dealership_id: dealershipId,
    vehicle_id: vehicleId,
    type: "vehicle_sale",
    amount: soldPrice,
    description: `${vehicle.year ?? ""} ${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim() + " sale",
    transaction_date: new Date().toISOString().split("T")[0],
  });

  if (cashflowError) {
    throw new Error("Vehicle marked sold, but failed to log the cashflow transaction");
  }

  return { vehicle: updated, soldPrice, netProfit, roi };
}
