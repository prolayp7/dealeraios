import { computeAvailableCash } from "./available-cash";
import { isMoneyTrap } from "./money-trap";
import type { CashflowTransaction, Vehicle } from "./types";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type TrendSentiment = "good" | "bad" | "neutral";

export interface Trend {
  changePct: number;
  sentiment: TrendSentiment;
}

export function trendDirection(changePct: number): "up" | "down" | "flat" {
  if (changePct > 0) return "up";
  if (changePct < 0) return "down";
  return "flat";
}

export function formatTrendLabel(changePct: number): string {
  const sign = changePct > 0 ? "+" : "";
  return `${sign}${changePct.toFixed(1)}% vs last week`;
}

export interface DashboardTrends {
  cashAvailable: Trend;
  expectedProfit: Trend;
  inventoryValue: Trend;
  cashTrapped: Trend;
  newActiveListings: number;
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : current > 0 ? 100 : -100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function trend(current: number, previous: number, higherIsGood: boolean): Trend {
  const changePct = pctChange(current, previous);
  const sentiment: TrendSentiment =
    changePct === 0 ? "neutral" : changePct > 0 === higherIsGood ? "good" : "bad";
  return { changePct, sentiment };
}

function existedBy(vehicle: Vehicle, cutoff: Date): boolean {
  return new Date(vehicle.created_at) <= cutoff;
}

// There's no snapshot table for vehicle-level fields, so "a week ago" is
// approximated as today's numbers for whichever vehicles already existed by
// the cutoff (real timestamps, current values) — this misses in-week edits
// to price/cost on pre-existing vehicles, but avoids fabricating history.
export function computeDashboardTrends(
  vehicles: Vehicle[],
  transactions: CashflowTransaction[],
  asOf: Date = new Date()
): DashboardTrends {
  const cutoff = new Date(asOf.getTime() - WEEK_MS);

  const cashNow = computeAvailableCash(transactions);
  const cashThen = computeAvailableCash(
    transactions.filter((t) => new Date(t.transaction_date) <= cutoff)
  );

  const priorVehicles = vehicles.filter((v) => existedBy(v, cutoff));

  const profitNow = vehicles.reduce((sum, v) => sum + (v.net_profit ?? 0), 0);
  const profitThen = priorVehicles.reduce((sum, v) => sum + (v.net_profit ?? 0), 0);

  const inventoryValueNow = vehicles.reduce((sum, v) => sum + (v.retail_price ?? 0), 0);
  const inventoryValueThen = priorVehicles.reduce(
    (sum, v) => sum + (v.retail_price ?? 0),
    0
  );

  const cashTrappedNow = vehicles
    .filter((v) => isMoneyTrap({ daysInStock: v.days_in_stock ?? 0, roi: v.roi ?? 0 }))
    .reduce((sum, v) => sum + (v.total_invested ?? 0), 0);
  const cashTrappedThen = priorVehicles
    .filter((v) =>
      isMoneyTrap({ daysInStock: Math.max((v.days_in_stock ?? 0) - 7, 0), roi: v.roi ?? 0 })
    )
    .reduce((sum, v) => sum + (v.total_invested ?? 0), 0);

  const newActiveListings = vehicles.filter((v) => {
    if (!v.listed_online) return false;
    const listedAt = v.fb_listed_at ? new Date(v.fb_listed_at) : new Date(v.created_at);
    return listedAt > cutoff;
  }).length;

  return {
    cashAvailable: trend(cashNow, cashThen, true),
    expectedProfit: trend(profitNow, profitThen, true),
    inventoryValue: trend(inventoryValueNow, inventoryValueThen, true),
    cashTrapped: trend(cashTrappedNow, cashTrappedThen, false),
    newActiveListings,
  };
}
