import type { Vehicle } from "./types";

function isSold(vehicle: Vehicle): boolean {
  return (vehicle.status ?? "").trim().toLowerCase() === "sold";
}

/**
 * Day 1 proxy for Available Cash (Answers §1/Q1): cash in from sold vehicles'
 * retail price, minus cash out from every vehicle's purchase + repair cost —
 * sold or still in stock, since that capital has already left the register.
 * This is wired against vehicle purchase/sale events only; Day 3's Cashflow
 * ledger replaces it with the real running transaction total (repairs,
 * transport, insurance, rent, payroll, etc.).
 */
export function computeAvailableCash(vehicles: Vehicle[]): number {
  const cashIn = vehicles
    .filter(isSold)
    .reduce((sum, v) => sum + (v.retail_price ?? 0), 0);

  const cashOut = vehicles.reduce(
    (sum, v) => sum + (v.my_cost ?? 0) + (v.repair_cost ?? 0),
    0
  );

  return cashIn - cashOut;
}
