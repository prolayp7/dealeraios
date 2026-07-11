export interface MarketEvaluation {
  quickSalePrice: number;
  marketPrice: number;
  premiumPrice: number;
  maxBuyPrice: number;
  expectedProfit: number | null;
  expectedRoi: number | null;
  expectedDaysToSell: number;
  confidenceScore: number;
}

// Quick/Market/Premium are sale-speed tradeoffs derived from the comp spread,
// not the raw low/avg/high stats already stored on the vehicle row (Answers
// §3/Q10). Max Buy Price backs out a price that still leaves a healthy margin
// off Market Price.
export function computeMarketEvaluation(
  prices: number[],
  costBasis: number | null
): MarketEvaluation {
  if (prices.length === 0) {
    return {
      quickSalePrice: 0,
      marketPrice: 0,
      premiumPrice: 0,
      maxBuyPrice: 0,
      expectedProfit: null,
      expectedRoi: null,
      expectedDaysToSell: 45,
      confidenceScore: 0,
    };
  }

  const sorted = [...prices].sort((a, b) => a - b);
  const avg = sorted.reduce((sum, p) => sum + p, 0) / sorted.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  const quickSalePrice = Math.round(Math.min(avg * 0.92, min * 1.02));
  const marketPrice = Math.round(avg);
  const premiumPrice = Math.round(Math.max(avg * 1.08, max * 0.98));
  const maxBuyPrice = Math.round(marketPrice * 0.7);

  const expectedProfit = costBasis != null ? Math.round(marketPrice - costBasis) : null;
  const expectedRoi =
    expectedProfit != null && costBasis && costBasis > 0
      ? Math.round((expectedProfit / costBasis) * 1000) / 10
      : null;

  // More comps = a more liquid market = faster expected sale.
  const expectedDaysToSell = Math.max(7, Math.min(90, 45 - prices.length * 4));
  const confidenceScore = Math.min(100, prices.length * 15);

  return {
    quickSalePrice,
    marketPrice,
    premiumPrice,
    maxBuyPrice,
    expectedProfit,
    expectedRoi,
    expectedDaysToSell,
    confidenceScore,
  };
}
