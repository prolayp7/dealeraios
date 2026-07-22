import type { ReportMetrics } from "./report-metrics";

const METRIC_ROWS: [string, keyof ReportMetrics][] = [
  ["Gross Profit", "grossProfit"],
  ["Net Profit", "netProfit"],
  ["Portfolio Expected Profit", "portfolioExpectedProfit"],
  ["ROI (%)", "roi"],
  ["Avg Profit per Sale", "avgProfitPerSale"],
  ["Profit This Month So Far", "profitThisMonthSoFar"],
  ["Messages", "messageCount"],
  ["Avg Response Time (min)", "avgResponseTimeMinutes"],
  ["Lead Conversion (%)", "leadConversionPercent"],
  ["Avg Days to Sell", "avgDaysToSell"],
];

function formatValue(metrics: ReportMetrics, key: keyof ReportMetrics): string {
  const value = metrics[key];
  if (value == null) return "—";
  if (typeof value === "object") {
    return `${value.label} (${value.leadCount} leads)`;
  }
  return String(value);
}

function buildRows(metrics: ReportMetrics): [string, string][] {
  const rows: [string, string][] = METRIC_ROWS.map(([label, key]) => [
    label,
    formatValue(metrics, key),
  ]);
  rows.push([
    "Best Performing Vehicle (leads)",
    metrics.bestPerformingVehicle
      ? `${metrics.bestPerformingVehicle.label} (${metrics.bestPerformingVehicle.leadCount})`
      : "—",
  ]);
  rows.push([
    "Worst Performing Vehicle (leads)",
    metrics.worstPerformingVehicle
      ? `${metrics.worstPerformingVehicle.label} (${metrics.worstPerformingVehicle.leadCount})`
      : "—",
  ]);
  return rows;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportReportCsv(metrics: ReportMetrics, filename = "report.csv") {
  const rows = buildRows(metrics);
  const csv = ["Metric,Value", ...rows.map(([k, v]) => `"${k}","${v}"`)].join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv" }), filename);
}

export async function exportReportExcel(metrics: ReportMetrics, filename = "report.xlsx") {
  const { default: ExcelJS } = await import("exceljs");
  const rows = buildRows(metrics);
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Report");
  worksheet.addRow(["Metric", "Value"]);
  rows.forEach((row) => worksheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename
  );
}

export async function exportReportPdf(
  metrics: ReportMetrics,
  rangeLabel: string,
  filename = "report.pdf"
) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Dealer AI OS — Report", 14, 18);
  doc.setFontSize(10);
  doc.text(`Range: ${rangeLabel}`, 14, 26);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32);

  autoTable(doc, {
    startY: 38,
    head: [["Metric", "Value"]],
    body: buildRows(metrics),
  });

  doc.save(filename);
}
