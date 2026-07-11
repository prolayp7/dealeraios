import type { Vehicle } from "./types";

export interface MonthlyTrendPoint {
  monthKey: string;
  label: string;
  revenue: number;
  profit: number;
}

function isSold(vehicle: Vehicle): boolean {
  return (vehicle.status ?? "").trim().toLowerCase() === "sold";
}

/**
 * Groups sold vehicles by the month their row was created, as a Day 1 proxy
 * for a sale-date trend — there's no dedicated sold_date column yet. Day 3's
 * Cashflow ledger (recorded per transaction) replaces this with a real trend.
 */
export function computeMonthlyRevenueTrend(
  vehicles: Vehicle[],
  months = 6
): MonthlyTrendPoint[] {
  const now = new Date();
  const points: MonthlyTrendPoint[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    points.push({
      monthKey,
      label: d.toLocaleDateString("en-US", { month: "short" }),
      revenue: 0,
      profit: 0,
    });
  }

  const byMonth = new Map(points.map((p) => [p.monthKey, p]));

  for (const vehicle of vehicles.filter(isSold)) {
    const created = new Date(vehicle.created_at);
    const monthKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
    const point = byMonth.get(monthKey);
    if (!point) continue;
    point.revenue += vehicle.retail_price ?? 0;
    point.profit += vehicle.net_profit ?? 0;
  }

  return points;
}
