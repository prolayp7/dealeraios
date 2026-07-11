import { computeAvailableCash } from "./available-cash";
import type { CashflowTransaction } from "./types";

export interface ForecastPoint {
  monthKey: string;
  label: string;
  projectedCash: number;
}

function monthKeyFor(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Projects Available Cash forward using the average of the last 3 months'
// net cashflow. Needs at least one full prior month of history — with less
// than that, the trend is too noisy to be worth projecting.
export function computeCashflowForecast(
  transactions: CashflowTransaction[],
  monthsAhead = 3
): { hasEnoughHistory: boolean; monthlyNetAverage: number; points: ForecastPoint[] } {
  const now = new Date();
  const currentCash = computeAvailableCash(transactions);

  const monthlyNet = new Map<string, number>();
  for (const t of transactions) {
    const key = monthKeyFor(new Date(t.transaction_date));
    const sign = t.type === "vehicle_sale" ? 1 : -1;
    monthlyNet.set(key, (monthlyNet.get(key) ?? 0) + sign * t.amount);
  }

  const currentMonthKey = monthKeyFor(now);
  const priorMonthKeys: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    priorMonthKeys.push(monthKeyFor(d));
  }

  const priorMonthsWithData = priorMonthKeys.filter((k) => monthlyNet.has(k));
  const hasEnoughHistory = priorMonthsWithData.length >= 1;

  const monthlyNetAverage = hasEnoughHistory
    ? priorMonthsWithData.reduce((sum, k) => sum + (monthlyNet.get(k) ?? 0), 0) /
      priorMonthsWithData.length
    : 0;

  const points: ForecastPoint[] = [];
  let runningCash = currentCash;

  // Include the current (partial) month as the anchor point.
  points.push({
    monthKey: currentMonthKey,
    label: now.toLocaleDateString("en-US", { month: "short" }),
    projectedCash: runningCash,
  });

  for (let i = 1; i <= monthsAhead; i++) {
    runningCash += monthlyNetAverage;
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    points.push({
      monthKey: monthKeyFor(d),
      label: d.toLocaleDateString("en-US", { month: "short" }),
      projectedCash: Math.round(runningCash),
    });
  }

  return { hasEnoughHistory, monthlyNetAverage: Math.round(monthlyNetAverage), points };
}
