import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPortfolioPricing } from "@/lib/ai-gm-recommendations";
import { cn, formatCurrency } from "@/lib/utils";
import type { Vehicle } from "@/lib/types";

export function PricingOpportunitiesPanel({ vehicles }: { vehicles: Vehicle[] }) {
  const byId = new Map(vehicles.map((v) => [v.id, v]));
  const rows = getPortfolioPricing(vehicles)
    .filter((row) => row.changePercent != null && row.currentPrice != null && row.recommendedPrice != null)
    .sort(
      (a, b) =>
        Math.abs((b.recommendedPrice ?? 0) - (b.currentPrice ?? 0)) -
        Math.abs((a.recommendedPrice ?? 0) - (a.currentPrice ?? 0))
    )
    .slice(0, 3);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Pricing Opportunities
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pricing changes recommended.</p>
        ) : (
          rows.map((row) => {
            const vehicle = byId.get(row.vehicleId);
            const delta = (row.recommendedPrice ?? 0) - (row.currentPrice ?? 0);
            return (
              <Link
                key={row.vehicleId}
                href={`/inventory/${row.vehicleId}`}
                className="flex items-center gap-3 rounded-lg hover:bg-slate-800/40"
              >
                <div className="h-10 w-14 shrink-0 overflow-hidden rounded-md bg-slate-800">
                  {vehicle?.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={vehicle.image_url}
                      alt={row.label}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{row.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(row.currentPrice)} → {formatCurrency(row.recommendedPrice)}
                  </p>
                </div>
                <p
                  className={cn(
                    "shrink-0 text-sm font-semibold",
                    delta >= 0 ? "text-success" : "text-danger"
                  )}
                >
                  {delta >= 0 ? "↗" : "↘"}
                  {formatCurrency(Math.abs(delta))}
                </p>
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
