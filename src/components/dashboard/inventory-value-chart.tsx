import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MiniChart } from "@/components/dashboard/mini-chart";
import { INVENTORY_VALUE_SERIES } from "@/lib/dashboard-static-data";
import { formatCurrency } from "@/lib/utils";

export function InventoryValueChart() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Inventory Value
        </CardTitle>
      </CardHeader>
      <CardContent>
        <MiniChart
          data={INVENTORY_VALUE_SERIES}
          variant="area"
          color="violet"
          formatValue={formatCurrency}
        />
      </CardContent>
    </Card>
  );
}
