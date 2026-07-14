import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MARKET_PULSE } from "@/lib/dashboard-static-data";

export function MarketPulsePanel() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Market Pulse
        </CardTitle>
        <Link href="/market-intel" className="text-xs font-medium text-info hover:underline">
          Pulse →
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {MARKET_PULSE.map((row) => (
          <div key={row.city} className="flex items-center justify-between">
            <p className="text-sm text-foreground">{row.city}</p>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-foreground">{row.score}</span>
              <span
                className={cn(
                  "text-xs font-medium",
                  row.changePct >= 0 ? "text-success" : "text-danger"
                )}
              >
                {row.changePct >= 0 ? "+" : ""}
                {row.changePct}%
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
