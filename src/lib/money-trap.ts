import type { Vehicle } from "./types";

export type MoneyTrapAction = "Reduce Price" | "Send to Auction" | "Wholesale" | "Hold";

export interface MoneyTrapInput {
  daysInStock: number;
  roi: number;
}

// Answers §1/Q4 — supersedes the earlier Phase 1 threshold (Days > 65 AND Profit < $1,000).
export const MONEY_TRAP_MIN_DAYS = 60;
export const MONEY_TRAP_MAX_ROI = 10;

function toInput(vehicle: Vehicle): MoneyTrapInput {
  return { daysInStock: vehicle.days_in_stock ?? 0, roi: vehicle.roi ?? 0 };
}

export function isMoneyTrap(input: MoneyTrapInput): boolean {
  return input.daysInStock > MONEY_TRAP_MIN_DAYS && input.roi < MONEY_TRAP_MAX_ROI;
}

// Money Trap vehicles get exactly one recommended action, based on how bad the
// position is: past the 90-day auction threshold, underwater, marginally
// profitable (worth waiting out), or otherwise just needs a price cut.
export function moneyTrapAction(input: MoneyTrapInput): MoneyTrapAction {
  if (input.daysInStock > 90) return "Send to Auction";
  if (input.roi < 0) return "Wholesale";
  if (input.roi >= 5) return "Hold";
  return "Reduce Price";
}

export function isVehicleMoneyTrap(vehicle: Vehicle): boolean {
  return isMoneyTrap(toInput(vehicle));
}

export function vehicleMoneyTrapAction(vehicle: Vehicle): MoneyTrapAction {
  return moneyTrapAction(toInput(vehicle));
}

export function moneyTrapVehicles(vehicles: Vehicle[]): Vehicle[] {
  return vehicles.filter(isVehicleMoneyTrap);
}
