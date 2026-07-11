"use client";

import { useEffect, useState } from "react";
import { BarChart3, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi-card";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { exportReportCsv, exportReportExcel, exportReportPdf } from "@/lib/report-export";
import type { DateRangeKey, ReportMetrics } from "@/lib/report-metrics";

const RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "90d", label: "Last 90 Days" },
  { key: "ytd", label: "Year to Date" },
];

export default function ReportsPage() {
  const [range, setRange] = useState<DateRangeKey>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (range === "custom" && (!customFrom || !customTo)) return;

    setLoading(true);
    const params = new URLSearchParams({ range });
    if (range === "custom") {
      params.set("from", customFrom);
      params.set("to", customTo);
    }

    fetch(`/api/reports?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setMetrics(data.metrics))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [range, customFrom, customTo]);

  const rangeLabel =
    range === "custom"
      ? `${customFrom} to ${customTo}`
      : RANGE_OPTIONS.find((r) => r.key === range)?.label ?? range;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-white">
          <BarChart3 className="h-8 w-8 text-orange-500" />
          Reports
        </h1>
        <p className="mt-1 text-slate-400">
          Profit, leads, messaging, and inventory performance for the selected period.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          {RANGE_OPTIONS.map((opt) => (
            <Button
              key={opt.key}
              size="sm"
              variant={range === opt.key ? "default" : "outline"}
              onClick={() => setRange(opt.key)}
            >
              {opt.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant={range === "custom" ? "default" : "outline"}
            onClick={() => setRange("custom")}
          >
            Custom Range
          </Button>
          {range === "custom" && (
            <>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100"
              />
            </>
          )}

          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!metrics}
              onClick={() => metrics && exportReportCsv(metrics)}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!metrics}
              onClick={() => metrics && exportReportExcel(metrics)}
            >
              <Download className="h-4 w-4" /> Excel
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!metrics}
              onClick={() => metrics && exportReportPdf(metrics, rangeLabel)}
            >
              <Download className="h-4 w-4" /> PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading || !metrics ? (
        <p className="text-sm text-slate-500">Loading report...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard title="Gross Profit" value={formatCurrency(metrics.grossProfit)} />
            <KpiCard title="Net Profit" value={formatCurrency(metrics.netProfit)} />
            <KpiCard
              title="Portfolio Expected Profit"
              value={formatCurrency(metrics.portfolioExpectedProfit)}
            />
            <KpiCard title="ROI" value={formatPercent(metrics.roi)} />
            <KpiCard
              title="Avg Profit per Sale"
              value={formatCurrency(metrics.avgProfitPerSale)}
            />
            <KpiCard
              title="Profit This Month So Far"
              value={formatCurrency(metrics.profitThisMonthSoFar)}
            />
            <KpiCard title="Messages" value={String(metrics.messageCount)} />
            <KpiCard
              title="Avg Response Time"
              value={metrics.avgResponseTimeMinutes != null ? `${metrics.avgResponseTimeMinutes} min` : "—"}
            />
            <KpiCard
              title="Lead Conversion"
              value={formatPercent(metrics.leadConversionPercent)}
            />
            <KpiCard
              title="Avg Days to Sell"
              value={metrics.avgDaysToSell != null ? String(metrics.avgDaysToSell) : "—"}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Best Performing Vehicle (by leads)</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.bestPerformingVehicle ? (
                  <p className="text-slate-200">
                    {metrics.bestPerformingVehicle.label} —{" "}
                    {metrics.bestPerformingVehicle.leadCount} leads
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">No data yet.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Worst Performing Vehicle (by leads)</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.worstPerformingVehicle ? (
                  <p className="text-slate-200">
                    {metrics.worstPerformingVehicle.label} —{" "}
                    {metrics.worstPerformingVehicle.leadCount} leads
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">No data yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
