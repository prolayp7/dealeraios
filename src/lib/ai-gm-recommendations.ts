import { isMoneyTrap, moneyTrapAction, type MoneyTrapAction } from "@/lib/money-trap";
import { getVehicleLabel } from "@/lib/vehicle-logic";
import type { ConversationSummary, Vehicle } from "@/lib/types";

export interface AuctionCandidate {
  vehicleId: string;
  label: string;
  daysInStock: number;
  roi: number;
  action: MoneyTrapAction;
}

// AI GM's auction/wholesale/price-reduction/hold call — recommend only, never
// auto-posted (Answers §6/Q20). Reuses the same decision function as the
// dashboard's Money Trap widget so the two surfaces never disagree, and adds
// the 90+ day auction-only trigger even for vehicles with healthy ROI.
export function getAuctionCandidates(vehicles: Vehicle[]): AuctionCandidate[] {
  return vehicles
    .filter((v) => (v.days_in_stock ?? 0) > 90 || isMoneyTrap({
      daysInStock: v.days_in_stock ?? 0,
      roi: v.roi ?? 0,
    }))
    .map((v) => ({
      vehicleId: v.id,
      label: getVehicleLabel(v),
      daysInStock: v.days_in_stock ?? 0,
      roi: v.roi ?? 0,
      action: moneyTrapAction({ daysInStock: v.days_in_stock ?? 0, roi: v.roi ?? 0 }),
    }))
    .sort((a, b) => b.daysInStock - a.daysInStock);
}

export interface PortfolioPricingRow {
  vehicleId: string;
  label: string;
  currentPrice: number | null;
  recommendedPrice: number | null;
  changePercent: number | null;
  reason: string;
}

// Portfolio-wide pricing across the whole dealership — distinct from AI
// Appraiser's single-vehicle valuation (Answers §6/Q23). Every vehicle gets
// one row so the dealer can scan pricing posture across all of inventory.
export function getPortfolioPricing(vehicles: Vehicle[]): PortfolioPricingRow[] {
  return vehicles.map((v) => {
    const days = v.days_in_stock ?? 0;
    const roi = v.roi ?? 0;
    const current = v.retail_price;

    let changePercent = 0;
    let reason = "Holding — priced in line with the market";

    if (days > 90) {
      changePercent = -10;
      reason = "90+ days in stock — recommend auction over further discounting";
    } else if (isMoneyTrap({ daysInStock: days, roi })) {
      changePercent = -5;
      reason = "Money Trap — aging with thin margin, reduce to move faster";
    } else if (days > 21 && (v.comp_count ?? 0) < 3) {
      changePercent = -5;
      reason = "Slow-moving with limited comps — reduce price";
    } else if (days <= 14 && roi > 20) {
      changePercent = 3;
      reason = "Fast mover with strong margin — room to raise price";
    }

    const recommendedPrice =
      current != null && changePercent !== 0
        ? Math.round(current * (1 + changePercent / 100))
        : current;

    return {
      vehicleId: v.id,
      label: getVehicleLabel(v),
      currentPrice: current,
      recommendedPrice,
      changePercent: changePercent !== 0 ? changePercent : null,
      reason,
    };
  });
}

export interface StaleListing {
  vehicleId: string;
  label: string;
  daysSinceListed: number;
}

const STALE_LISTING_DAYS = 14;

// Listing refresh always requires explicit dealer approval — never automatic
// (Answers §6/Q22). This only flags candidates; approval happens via a
// separate explicit action.
export function getStaleListings(vehicles: Vehicle[]): StaleListing[] {
  const now = Date.now();

  return vehicles
    .filter((v) => v.listed_online && v.fb_listed_at)
    .map((v) => {
      const listedAt = new Date(v.fb_listed_at!).getTime();
      const daysSinceListed = Math.floor((now - listedAt) / (1000 * 60 * 60 * 24));
      return { vehicleId: v.id, label: getVehicleLabel(v), daysSinceListed };
    })
    .filter((v) => v.daysSinceListed >= STALE_LISTING_DAYS)
    .sort((a, b) => b.daysSinceListed - a.daysSinceListed);
}

export const DEFAULT_INACTIVITY_THRESHOLD_HOURS = 48;
const HOT_LEAD_TAG_NAME = "Hot Lead";

function isHotLead(conversation: ConversationSummary): boolean {
  return (conversation.customer.tags ?? []).some((t) => t.name === HOT_LEAD_TAG_NAME);
}

// Surfaces inactive conversations for AI GM to flag, Hot Lead-tagged ones
// first (Answers §5/Q17 — tags affect AI prioritization). The inactivity
// threshold is dealer-editable in Settings (Answers §5/Q19), defaulting to
// 48h. The AI-drafted follow-up message itself lives on the Lead CRM detail
// page, not here.
export function getInactiveConversations(
  conversations: ConversationSummary[],
  thresholdHours: number = DEFAULT_INACTIVITY_THRESHOLD_HOURS
): ConversationSummary[] {
  const now = Date.now();

  return conversations
    .filter((c) => {
      if (c.unread_count === 0 || !c.last_message_at) return false;
      const hoursSince = (now - new Date(c.last_message_at).getTime()) / (1000 * 60 * 60);
      return hoursSince >= thresholdHours;
    })
    .sort((a, b) => {
      const aHot = isHotLead(a) ? 1 : 0;
      const bHot = isHotLead(b) ? 1 : 0;
      return bHot - aHot;
    });
}
