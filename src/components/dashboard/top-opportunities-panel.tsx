import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { TOP_OPPORTUNITIES } from "@/lib/dashboard-static-data";

export function TopOpportunitiesPanel() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Top Opportunities
        </CardTitle>
        <Link href="/acquisition" className="text-xs font-medium text-info hover:underline">
          All →
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {TOP_OPPORTUNITIES.map((opp) => (
          <div key={opp.label} className="flex items-center gap-3">
            <div className="h-12 w-16 shrink-0 rounded-md bg-slate-800" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{opp.label}</p>
              <p className="truncate text-xs text-muted-foreground">
                {opp.source} · Score {opp.score}
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-success">
              {formatCurrency(opp.value)}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
