import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MiniChart } from "@/components/dashboard/mini-chart";
import { computeMonthlyRevenueTrend } from "@/lib/revenue-trend";
import { formatCurrency } from "@/lib/utils";
import type { Vehicle } from "@/lib/types";

export function ProfitTrendChart({ vehicles }: { vehicles: Vehicle[] }) {
  const points = computeMonthlyRevenueTrend(vehicles);
  const data = points.map((p) => ({ label: p.label, value: p.profit }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Profit Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <MiniChart data={data} variant="area" color="success" formatValue={formatCurrency} />
      </CardContent>
    </Card>
  );
}
