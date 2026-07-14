import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MiniChart } from "@/components/dashboard/mini-chart";
import { computeCashflowForecast } from "@/lib/cashflow-forecast";
import { formatCurrency } from "@/lib/utils";
import type { CashflowTransaction } from "@/lib/types";

const RELABEL = ["Now", "30d", "60d", "90d"];

export function CashflowForecastChart({
  transactions,
}: {
  transactions: CashflowTransaction[];
}) {
  const { points } = computeCashflowForecast(transactions);
  const data = points.map((p, i) => ({
    label: RELABEL[i] ?? p.label,
    value: p.projectedCash,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Cashflow Forecast
        </CardTitle>
      </CardHeader>
      <CardContent>
        <MiniChart data={data} variant="area" color="success" formatValue={formatCurrency} />
      </CardContent>
    </Card>
  );
}
