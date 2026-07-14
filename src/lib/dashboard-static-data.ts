export interface TopOpportunity {
  label: string;
  source: string;
  score: number;
  value: number;
}

export const TOP_OPPORTUNITIES: TopOpportunity[] = [
  { label: "2015 Toyota Corolla LE", source: "Facebook Marketplace", score: 92, value: 1700 },
  { label: "2016 BMW X3 xDrive28i", source: "Manheim Auction", score: 88, value: 4100 },
  { label: "2013 Lexus IS 250", source: "Craigslist", score: 79, value: 2700 },
  { label: "2018 Honda Accord Sport", source: "OfferUp", score: 85, value: 3200 },
];

export const AI_RECOMMENDATIONS: string[] = [
  "Call Hannah Liu — brand-new inbound (15 min window closing)",
  "Confirm financing for Marcus Greene — lender response due today",
  "Send walkaround video to Sarah Kim before tomorrow's test drive",
  "Counter Jay Rodriguez at $37,800 with free DFW delivery",
];

export interface MarketPulseRow {
  city: string;
  score: number;
  changePct: number;
}

export const MARKET_PULSE: MarketPulseRow[] = [
  { city: "Florida", score: 86, changePct: 4.2 },
  { city: "Tampa", score: 91, changePct: 6.8 },
  { city: "Orlando", score: 82, changePct: 3.1 },
  { city: "Miami", score: 78, changePct: -1.4 },
];

export interface CriticalAlert {
  title: string;
  description: string;
  severity: "warning" | "danger";
}

export const CRITICAL_ALERTS: CriticalAlert[] = [
  {
    title: "Luxury sedans cooling",
    description: "BMW 5 Series demand down 7% WoW — discount or move to auction.",
    severity: "warning",
  },
  {
    title: "Truck supply tightening",
    description: "F-150 inventory down 18% in DFW — opportunity to raise prices.",
    severity: "warning",
  },
  {
    title: "Tiguan aging risk",
    description: "67 days in stock; expected loss grows ~$80/day. Auction recommended.",
    severity: "danger",
  },
];

export const AI_GM_SUMMARY =
  "Two pricing levers + one auction move can release $14,200 in 7 days. Execute mission queue to clear aging risk and lock $6,800 net.";

export interface StaticSeriesPoint {
  label: string;
  value: number;
}

export const LEAD_CONVERSION_SERIES: StaticSeriesPoint[] = [
  { label: "Feb", value: 6 },
  { label: "Mar", value: 11 },
  { label: "Apr", value: 15 },
  { label: "May", value: 13 },
  { label: "Jun", value: 12 },
];

export const INVENTORY_TURN_RATE_SERIES: StaticSeriesPoint[] = [
  { label: "Feb", value: 38 },
  { label: "Mar", value: 55 },
  { label: "Apr", value: 68 },
  { label: "May", value: 72 },
  { label: "Jun", value: 74 },
];

export const INVENTORY_VALUE_SERIES: StaticSeriesPoint[] = [
  { label: "Feb", value: 168000 },
  { label: "Mar", value: 190000 },
  { label: "Apr", value: 210000 },
  { label: "May", value: 175000 },
  { label: "Jun", value: 160000 },
];
