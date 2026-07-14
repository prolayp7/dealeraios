import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MiniChart } from "@/components/dashboard/mini-chart";
import { LEAD_CONVERSION_SERIES } from "@/lib/dashboard-static-data";

export function LeadConversionChart() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Lead Conversion
        </CardTitle>
      </CardHeader>
      <CardContent>
        <MiniChart
          data={LEAD_CONVERSION_SERIES}
          variant="line"
          color="violet"
          formatValue={(v) => `${v}%`}
        />
      </CardContent>
    </Card>
  );
}
