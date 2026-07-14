import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MiniChart } from "@/components/dashboard/mini-chart";
import type { Vehicle } from "@/lib/types";

const BUCKETS = [
  { label: "0-30", min: 0, max: 30 },
  { label: "31-60", min: 31, max: 60 },
  { label: "61-90", min: 61, max: 90 },
  { label: "91-120", min: 91, max: 120 },
  { label: "120+", min: 121, max: Infinity },
];

export function InventoryAgingChart({ vehicles }: { vehicles: Vehicle[] }) {
  const data = BUCKETS.map((bucket) => ({
    label: bucket.label,
    value: vehicles.filter((v) => {
      const days = v.days_in_stock ?? 0;
      return days >= bucket.min && days <= bucket.max;
    }).length,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Inventory Aging
        </CardTitle>
      </CardHeader>
      <CardContent>
        <MiniChart data={data} variant="bar" color="info" />
      </CardContent>
    </Card>
  );
}
