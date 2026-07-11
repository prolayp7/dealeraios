import type { CashflowTransaction } from "./types";

const CASH_IN_TYPES = new Set(["vehicle_sale"]);

// Real running total from the Cashflow ledger (Answers §1/Q1): cash in from
// sales minus cash out from every other transaction type. Replaces the Day 1
// proxy that only looked at vehicle purchase/sale fields directly.
export function computeAvailableCash(transactions: CashflowTransaction[]): number {
  return transactions.reduce((sum, t) => {
    const sign = CASH_IN_TYPES.has(t.type) ? 1 : -1;
    return sum + sign * t.amount;
  }, 0);
}
