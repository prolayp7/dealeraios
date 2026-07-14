import Link from "next/link";
import { Car } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import type { AcquisitionOpportunity } from "@/lib/types";

export function AcquisitionOpportunitiesPanel({
  opportunities,
}: {
  opportunities: AcquisitionOpportunity[];
}) {
  const top = [...opportunities]
    .filter((o) => o.expected_roi != null)
    .sort((a, b) => (b.expected_roi ?? 0) - (a.expected_roi ?? 0))
    .slice(0, 3);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Acquisition Opportunities
        </CardTitle>
        <Link href="/acquisition" className="text-xs font-medium text-info hover:underline">
          All →
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground">No opportunities discovered yet.</p>
        ) : (
          top.map((opp) => (
            <a
              key={opp.id}
              href={opp.url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg hover:bg-slate-800/40"
            >
              <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md bg-slate-800">
                <Car className="h-5 w-5 text-slate-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {[opp.year, opp.make, opp.model].filter(Boolean).join(" ") || opp.title || "Vehicle"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(opp.expected_roi ?? 0).toFixed(1)}% ROI
                </p>
              </div>
              <p
                className={cn(
                  "shrink-0 text-sm font-semibold",
                  (opp.expected_profit ?? 0) >= 0 ? "text-success" : "text-danger"
                )}
              >
                {formatCurrency(opp.expected_profit)} net
              </p>
            </a>
          ))
        )}
      </CardContent>
    </Card>
  );
}
