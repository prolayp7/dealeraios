import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  AGING_BUCKET_LABELS,
  bucketVehiclesByAging,
  type AgingBucket,
} from "@/lib/inventory-aging";
import type { Vehicle } from "@/lib/types";

const BUCKET_ORDER: AgingBucket[] = ["fresh", "healthy", "aging", "critical"];

const BUCKET_STYLES: Record<AgingBucket, string> = {
  fresh: "bg-success/15 text-success",
  healthy: "bg-info/15 text-info",
  aging: "bg-warning/15 text-warning",
  critical: "bg-danger/15 text-danger",
};

export function InventoryAgingWidget({ vehicles }: { vehicles: Vehicle[] }) {
  const buckets = bucketVehiclesByAging(vehicles);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Inventory Aging
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {BUCKET_ORDER.map((bucket) => (
          <div
            key={bucket}
            className={cn("rounded-lg p-3", BUCKET_STYLES[bucket])}
          >
            <p className="text-2xl font-bold">{buckets[bucket].length}</p>
            <p className="mt-0.5 text-xs font-medium opacity-90">
              {AGING_BUCKET_LABELS[bucket]}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
