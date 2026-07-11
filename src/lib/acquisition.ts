import { appraiseVehicle } from "@/lib/ai-appraiser";
import type { MarketSourceListing } from "@/lib/market-sources/types";
import type { AcquisitionOpportunity } from "@/lib/types";

export interface ScoredOpportunity {
  source: string;
  title: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  mileage: number | null;
  asking_price: number | null;
  location: string | null;
  url: string | null;
  recommendation: AcquisitionOpportunity["recommendation"];
  max_buy_price: number | null;
  expected_profit: number | null;
  expected_roi: number | null;
  notes: string | null;
}

/**
 * Scores a passively-discovered marketplace listing using the same
 * BUY/WATCH/PASS/RUN appraisal logic as AI Appraiser Pro, called from a
 * different context: this evaluates opportunities the dealer hasn't engaged
 * with yet, not a vehicle already in hand (Answers §11).
 */
export async function scoreOpportunity(
  sourceLabel: string,
  listing: MarketSourceListing
): Promise<ScoredOpportunity> {
  const appraisal = await appraiseVehicle({
    vin: null,
    photos: [],
    mileage: listing.mileage,
    condition: "Unknown — listing photos not analyzed",
    purchasePrice: listing.price ?? 0,
    repairEstimate: 0,
  });

  return {
    source: sourceLabel,
    title: listing.title,
    year: listing.year,
    make: listing.make,
    model: listing.model,
    mileage: listing.mileage,
    asking_price: listing.price,
    location: listing.location,
    url: listing.url,
    recommendation: appraisal.recommendation,
    max_buy_price: appraisal.maxBuyPrice,
    expected_profit: appraisal.expectedProfit,
    expected_roi: appraisal.expectedRoi,
    notes: appraisal.summary,
  };
}
