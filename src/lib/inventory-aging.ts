import type { Vehicle } from "./types";

export type AgingBucket = "fresh" | "healthy" | "aging" | "critical";

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  fresh: "Fresh (0–30d)",
  healthy: "Healthy (31–60d)",
  aging: "Aging (61–90d)",
  critical: "Critical (90d+)",
};

// Fixed thresholds per Phase 2 spec (Answers §1/Q3) — not configurable in Phase 2.
export function bucketForDaysInStock(daysInStock: number): AgingBucket {
  if (daysInStock <= 30) return "fresh";
  if (daysInStock <= 60) return "healthy";
  if (daysInStock <= 90) return "aging";
  return "critical";
}

export function bucketVehiclesByAging(
  vehicles: Vehicle[]
): Record<AgingBucket, Vehicle[]> {
  const buckets: Record<AgingBucket, Vehicle[]> = {
    fresh: [],
    healthy: [],
    aging: [],
    critical: [],
  };

  for (const vehicle of vehicles) {
    const bucket = bucketForDaysInStock(vehicle.days_in_stock ?? 0);
    buckets[bucket].push(vehicle);
  }

  return buckets;
}
