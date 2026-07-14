import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MiniChart } from "@/components/dashboard/mini-chart";
import { INVENTORY_TURN_RATE_SERIES } from "@/lib/dashboard-static-data";

export function InventoryTurnRateChart() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Inventory Turn Rate
        </CardTitle>
      </CardHeader>
      <CardContent>
        <MiniChart data={INVENTORY_TURN_RATE_SERIES} variant="line" color="info" />
      </CardContent>
    </Card>
  );
}
