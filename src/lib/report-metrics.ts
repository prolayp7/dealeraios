import type { CashflowTransaction, CustomerInquiry, Message, Vehicle } from "./types";

export type DateRangeKey = "today" | "7d" | "30d" | "90d" | "ytd" | "custom";

export function resolveDateRange(
  key: DateRangeKey,
  customFrom?: string,
  customTo?: string
): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  if (key === "custom" && customFrom && customTo) {
    return { from: new Date(customFrom), to: new Date(customTo) };
  }

  const from = new Date(now);
  from.setHours(0, 0, 0, 0);

  switch (key) {
    case "today":
      break;
    case "7d":
      from.setDate(from.getDate() - 6);
      break;
    case "30d":
      from.setDate(from.getDate() - 29);
      break;
    case "90d":
      from.setDate(from.getDate() - 89);
      break;
    case "ytd":
      from.setMonth(0, 1);
      break;
  }

  return { from, to };
}

function inRange(dateStr: string, from: Date, to: Date): boolean {
  const t = new Date(dateStr).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

export interface ReportMetrics {
  grossProfit: number;
  netProfit: number;
  portfolioExpectedProfit: number;
  roi: number | null;
  avgProfitPerSale: number | null;
  profitThisMonthSoFar: number;
  messageCount: number;
  avgResponseTimeMinutes: number | null;
  leadConversionPercent: number | null;
  avgDaysToSell: number | null;
  bestPerformingVehicle: { label: string; leadCount: number } | null;
  worstPerformingVehicle: { label: string; leadCount: number } | null;
}

export function computeReportMetrics(
  vehicles: Vehicle[],
  transactions: CashflowTransaction[],
  messages: Message[],
  inquiries: CustomerInquiry[],
  from: Date,
  to: Date
): ReportMetrics {
  const rangeTx = transactions.filter((t) => inRange(t.transaction_date, from, to));
  const cashIn = rangeTx.filter((t) => t.type === "vehicle_sale");
  const cogs = rangeTx.filter((t) => t.type === "vehicle_purchase" || t.type === "repair");
  const allCashOut = rangeTx.filter((t) => t.type !== "vehicle_sale");

  const cashInTotal = cashIn.reduce((s, t) => s + t.amount, 0);
  const cogsTotal = cogs.reduce((s, t) => s + t.amount, 0);
  const cashOutTotal = allCashOut.reduce((s, t) => s + t.amount, 0);

  const grossProfit = cashInTotal - cogsTotal;
  const netProfit = cashInTotal - cashOutTotal;
  const roi = cashOutTotal > 0 ? Math.round((netProfit / cashOutTotal) * 1000) / 10 : null;
  const avgProfitPerSale = cashIn.length > 0 ? Math.round(grossProfit / cashIn.length) : null;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTx = transactions.filter((t) => inRange(t.transaction_date, monthStart, now));
  const profitThisMonthSoFar =
    monthTx.filter((t) => t.type === "vehicle_sale").reduce((s, t) => s + t.amount, 0) -
    monthTx.filter((t) => t.type !== "vehicle_sale").reduce((s, t) => s + t.amount, 0);

  const rangeMessages = messages.filter((m) => inRange(m.timestamp, from, to));
  const messageCount = rangeMessages.length;

  const byCustomer = new Map<string, Message[]>();
  for (const m of rangeMessages) {
    const list = byCustomer.get(m.customer_id) ?? [];
    list.push(m);
    byCustomer.set(m.customer_id, list);
  }
  const responseTimes: number[] = [];
  for (const msgs of byCustomer.values()) {
    const sorted = [...msgs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].direction === "inbound" && sorted[i + 1].direction === "outbound") {
        const minutes =
          (new Date(sorted[i + 1].timestamp).getTime() - new Date(sorted[i].timestamp).getTime()) /
          60000;
        responseTimes.push(minutes);
      }
    }
  }
  const avgResponseTimeMinutes =
    responseTimes.length > 0
      ? Math.round(responseTimes.reduce((s, r) => s + r, 0) / responseTimes.length)
      : null;

  const rangeInquiries = inquiries.filter((i) => inRange(i.created_at, from, to));
  const customersWithInquiries = new Set(rangeInquiries.map((i) => i.customer_id)).size;
  const totalCustomersContacted = byCustomer.size;
  const leadConversionPercent =
    totalCustomersContacted > 0
      ? Math.round((customersWithInquiries / totalCustomersContacted) * 1000) / 10
      : null;

  const soldVehicles = vehicles.filter((v) => (v.status ?? "").toLowerCase() === "sold");
  const avgDaysToSell =
    soldVehicles.length > 0
      ? Math.round(
          soldVehicles.reduce((s, v) => s + (v.days_in_stock ?? 0), 0) / soldVehicles.length
        )
      : null;

  const leadCountByVehicle = new Map<string, number>();
  for (const i of inquiries) {
    if (!i.vehicle_id) continue;
    leadCountByVehicle.set(i.vehicle_id, (leadCountByVehicle.get(i.vehicle_id) ?? 0) + 1);
  }
  const ranked = vehicles
    .map((v) => ({
      label: `${v.year ?? ""} ${v.make ?? ""} ${v.model ?? ""}`.trim() || "Unknown",
      leadCount: leadCountByVehicle.get(v.id) ?? 0,
    }))
    .sort((a, b) => b.leadCount - a.leadCount);

  const portfolioExpectedProfit = vehicles.reduce((s, v) => s + (v.net_profit ?? 0), 0);

  return {
    grossProfit,
    netProfit,
    portfolioExpectedProfit,
    roi,
    avgProfitPerSale,
    profitThisMonthSoFar,
    messageCount,
    avgResponseTimeMinutes,
    leadConversionPercent,
    avgDaysToSell,
    bestPerformingVehicle: ranked[0] ?? null,
    worstPerformingVehicle: ranked.length > 0 ? ranked[ranked.length - 1] : null,
  };
}
