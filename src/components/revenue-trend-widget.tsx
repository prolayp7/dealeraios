import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeMonthlyRevenueTrend } from "@/lib/revenue-trend";
import { formatCurrency } from "@/lib/utils";
import type { Vehicle } from "@/lib/types";

export function RevenueTrendWidget({ vehicles }: { vehicles: Vehicle[] }) {
  const points = computeMonthlyRevenueTrend(vehicles);
  const hasSales = points.some((p) => p.revenue > 0);
  const maxRevenue = Math.max(1, ...points.map((p) => p.revenue));
  const monthlyRevenue = points[points.length - 1]?.revenue ?? 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Revenue &amp; Profit Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-foreground">
          {formatCurrency(monthlyRevenue)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Monthly revenue</p>

        {hasSales ? (
          <div className="mt-4 flex h-20 items-end gap-2">
            {points.map((p) => (
              <div key={p.monthKey} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-primary/70"
                  style={{ height: `${Math.max(4, (p.revenue / maxRevenue) * 64)}px` }}
                  title={`${p.label}: ${formatCurrency(p.revenue)}`}
                />
                <span className="text-[10px] text-muted-foreground">{p.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">
            No sold vehicles yet — this trend populates once vehicles are
            marked sold and connects to the full Cashflow ledger.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
