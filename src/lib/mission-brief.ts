import { getAuctionCandidates, getPortfolioPricing } from "@/lib/ai-gm-recommendations";
import { countByFilter } from "@/lib/inventory-filters";
import { getVehicleLabel } from "@/lib/vehicle-logic";
import { formatCurrency } from "@/lib/utils";
import type { ConversationSummary, Vehicle } from "@/lib/types";

export interface MissionAction {
  label: string;
  sublabel: string;
}

export interface MissionBrief {
  targetAmount: number;
  missionScore: number;
  movesQueued: number;
  newLeads: number;
  actions: MissionAction[];
}

const HOT_LEAD_TAG_NAME = "Hot Lead";

function isHotLead(conversation: ConversationSummary): boolean {
  return (conversation.customer.tags ?? []).some((t) => t.name === HOT_LEAD_TAG_NAME);
}

// Drives the dashboard's "Today's mission" hero — everything here is derived
// from the same vehicle/conversation data as the rest of the Command Center
// (Money Trap, AI GM pricing, Daily Action Board) so the headline numbers
// never disagree with the widgets below them.
export function buildMissionBrief(
  vehicles: Vehicle[],
  conversations: ConversationSummary[],
  cashTrapped: number
): MissionBrief {
  const actions: MissionAction[] = [];

  const unlisted = [...vehicles]
    .filter((v) => !v.listed_online)
    .sort((a, b) => (b.net_profit ?? 0) - (a.net_profit ?? 0));
  if (unlisted[0]) {
    const v = unlisted[0];
    actions.push({
      label: `List ${getVehicleLabel(v)} online`,
      sublabel: `${v.days_in_stock ?? 0}d in stock — not listed yet`,
    });
  }

  const priceDrops = getPortfolioPricing(vehicles)
    .filter(
      (row) =>
        (row.changePercent ?? 0) < 0 && row.currentPrice != null && row.recommendedPrice != null
    )
    .sort(
      (a, b) =>
        b.currentPrice! - b.recommendedPrice! - (a.currentPrice! - a.recommendedPrice!)
    );
  if (priceDrops[0]) {
    const row = priceDrops[0];
    const delta = row.currentPrice! - row.recommendedPrice!;
    actions.push({
      label: `Reduce ${row.label} by ${formatCurrency(delta)}`,
      sublabel: row.reason,
    });
  }

  const openLeads = conversations
    .filter((c) => c.unread_count > 0)
    .sort((a, b) => {
      const hotDiff = (isHotLead(b) ? 1 : 0) - (isHotLead(a) ? 1 : 0);
      return hotDiff !== 0 ? hotDiff : b.unread_count - a.unread_count;
    });
  if (openLeads[0]) {
    const c = openLeads[0];
    actions.push({
      label: `Follow up ${c.customer.name ?? "Unknown lead"}`,
      sublabel: `${c.unread_count} unread message${c.unread_count !== 1 ? "s" : ""}`,
    });
  }

  const auctionable = getAuctionCandidates(vehicles).filter((c) => c.action !== "Hold");
  if (auctionable[0]) {
    const candidate = auctionable[0];
    const vehicle = vehicles.find((v) => v.id === candidate.vehicleId);
    const label =
      candidate.action === "Send to Auction"
        ? `Send ${candidate.label} to auction`
        : candidate.action === "Wholesale"
          ? `Wholesale ${candidate.label}`
          : `Reduce price on ${candidate.label}`;
    actions.push({
      label,
      sublabel: `Recover ${formatCurrency(vehicle?.total_invested ?? 0)} cash`,
    });
  }

  const totalVehicles = vehicles.length;
  const avgRoi =
    totalVehicles > 0
      ? vehicles.reduce((sum, v) => sum + (v.roi ?? 0), 0) / totalVehicles
      : 0;

  const movesQueued = countByFilter(vehicles).action + openLeads.length;

  let missionScore = 100;
  if (totalVehicles > 0) {
    missionScore -= Math.min(45, movesQueued * 4);
    if (avgRoi < 8) missionScore -= 10;
    else if (avgRoi > 20) missionScore += 5;
  }
  missionScore = Math.max(35, Math.min(99, Math.round(missionScore)));

  return {
    targetAmount: Math.round(cashTrapped),
    missionScore,
    movesQueued,
    newLeads: openLeads.length,
    actions: actions.slice(0, 4),
  };
}
