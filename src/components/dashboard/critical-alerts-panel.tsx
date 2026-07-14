import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CRITICAL_ALERTS } from "@/lib/dashboard-static-data";

export function CriticalAlertsPanel() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Critical Alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {CRITICAL_ALERTS.map((alert) => (
          <div
            key={alert.title}
            className={cn(
              "rounded-md border-l-2 bg-slate-900/40 p-3",
              alert.severity === "danger" ? "border-danger" : "border-warning"
            )}
          >
            <p className="text-sm font-semibold text-foreground">{alert.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{alert.description}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
