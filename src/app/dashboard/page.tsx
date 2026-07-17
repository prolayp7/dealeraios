"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Layers,
  MessageCircle,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { usePageHeader } from "@/components/header";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { InventoryCard } from "@/components/inventory/inventory-card";
import { InventoryFilterTabs } from "@/components/inventory/inventory-filter-tabs";
import { InventoryAgingWidget } from "@/components/inventory-aging-widget";
import { KpiCard } from "@/components/kpi-card";
import { MissionBanner } from "@/components/mission-banner";
import { MoneyTrapWidget } from "@/components/money-trap-widget";
import { RevenueTrendWidget } from "@/components/revenue-trend-widget";
import { StatCard } from "@/components/stat-card";
import { VoiceSaleEntry } from "@/components/voice-sale-entry";
import { Card, CardContent } from "@/components/ui/card";
import { MoneyTrapsPanel } from "@/components/dashboard/money-traps-panel";
import { TopOpportunitiesPanel } from "@/components/dashboard/top-opportunities-panel";
import { AiRecommendationsPanel } from "@/components/dashboard/ai-recommendations-panel";
import { MarketPulsePanel } from "@/components/dashboard/market-pulse-panel";
import { AiGmPanel } from "@/components/dashboard/ai-gm-panel";
import { CriticalAlertsPanel } from "@/components/dashboard/critical-alerts-panel";
import { PricingOpportunitiesPanel } from "@/components/dashboard/pricing-opportunities-panel";
import { AcquisitionOpportunitiesPanel } from "@/components/dashboard/acquisition-opportunities-panel";
import { InventoryAgingChart } from "@/components/dashboard/inventory-aging-chart";
import { ProfitTrendChart } from "@/components/dashboard/profit-trend-chart";
import { RevenueTrendChart } from "@/components/dashboard/revenue-trend-chart";
import { LeadConversionChart } from "@/components/dashboard/lead-conversion-chart";
import { InventoryTurnRateChart } from "@/components/dashboard/inventory-turn-rate-chart";
import { CashflowForecastChart } from "@/components/dashboard/cashflow-forecast-chart";
import { MonthlyRevenueChart } from "@/components/dashboard/monthly-revenue-chart";
import { InventoryValueChart } from "@/components/dashboard/inventory-value-chart";
import { computeAvailableCash } from "@/lib/available-cash";
import {
  computeDashboardTrends,
  formatTrendLabel,
  trendDirection,
} from "@/lib/dashboard-trends";
import { moneyTrapVehicles } from "@/lib/money-trap";
import { buildMissionBrief } from "@/lib/mission-brief";
import {
  countByFilter,
  matchesFilter,
  type FilterTab,
} from "@/lib/inventory-filters";
import type {
  AcquisitionOpportunity,
  AiPriority,
  CashflowTransaction,
  ConversationSummary,
  Profile,
  Vehicle,
} from "@/lib/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

const PRIORITY_ORDER: AiPriority[] = [
  "URGENT",
  "LIST NOW",
  "AUCTION",
  "PASS",
  "PRICE DROP",
  "MONEY TRAP",
  "BUY",
  "HOLD",
];

const PRIORITY_LABELS: Record<AiPriority, string> = {
  "LIST NOW": "🔥 LIST NOW",
  HOLD: "🟢 HOLD",
  "PRICE DROP": "🟡 PRICE DROP",
  AUCTION: "⚫ AUCTION",
  "MONEY TRAP": "💸 MONEY TRAP",
  URGENT: "🚨 URGENT",
  BUY: "✅ BUY",
  PASS: "⛔ PASS",
};

export default function DashboardPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [transactions, setTransactions] = useState<CashflowTransaction[]>([]);
  const [acquisitionOpportunities, setAcquisitionOpportunities] = useState<
    AcquisitionOpportunity[]
  >([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("action");

  usePageHeader({ title: "Command Center", notificationCount: unreadMessages });

  const loadDashboardData = () => {
    fetch("/api/vehicles")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setVehicles(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    fetch("/api/cashflow")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setTransactions(data);
      })
      .catch(console.error);

    fetch("/api/acquisition")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setAcquisitionOpportunities(data);
      })
      .catch(console.error);

    fetch("/api/messenger/conversations")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setConversations(data);
      })
      .catch(console.error);
  };

  useEffect(() => {
    loadDashboardData();

    fetch("/api/messenger/unread")
      .then((r) => r.json())
      .then((data) => setUnreadMessages(data.unread_count ?? 0))
      .catch(() => setUnreadMessages(0));

    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) setProfile(data);
      })
      .catch(console.error);
  }, []);

  const userName = profile?.full_name || profile?.email?.split("@")[0] || "there";

  const totalVehicles = vehicles.length;
  const retailValue = vehicles.reduce(
    (sum, v) => sum + (v.retail_price ?? 0),
    0
  );
  const expectedProfit = vehicles.reduce(
    (sum, v) => sum + (v.net_profit ?? 0),
    0
  );
  const avgRoi =
    vehicles.length > 0
      ? vehicles.reduce((sum, v) => sum + (v.roi ?? 0), 0) / vehicles.length
      : 0;

  const availableCash = useMemo(
    () => computeAvailableCash(transactions),
    [transactions]
  );
  const activeListings = vehicles.filter((v) => v.listed_online).length;
  const inactiveListings = totalVehicles - activeListings;
  const cashTrapped = useMemo(
    () =>
      moneyTrapVehicles(vehicles).reduce(
        (sum, v) => sum + (v.total_invested ?? 0),
        0
      ),
    [vehicles]
  );
  const trends = useMemo(
    () => computeDashboardTrends(vehicles, transactions),
    [vehicles, transactions]
  );
  const avgDaysInStock =
    totalVehicles > 0
      ? Math.round(
          vehicles.reduce((sum, v) => sum + (v.days_in_stock ?? 0), 0) /
            totalVehicles
        )
      : 0;

  const priorityCounts = PRIORITY_ORDER.reduce(
    (acc, p) => {
      acc[p] = vehicles.filter((v) => v.ai_priority === p).length;
      return acc;
    },
    {} as Record<AiPriority, number>
  );

  const filterCounts = useMemo(() => countByFilter(vehicles), [vehicles]);

  const missionBrief = useMemo(
    () => buildMissionBrief(vehicles, conversations, cashTrapped),
    [vehicles, conversations, cashTrapped]
  );

  const filteredVehicles = useMemo(
    () =>
      vehicles
        .filter((v) => matchesFilter(v, activeFilter))
        .sort((a, b) => {
          const aIdx = PRIORITY_ORDER.indexOf(a.ai_priority as AiPriority);
          const bIdx = PRIORITY_ORDER.indexOf(b.ai_priority as AiPriority);
          return aIdx - bIdx;
        }),
    [vehicles, activeFilter]
  );

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-5">
      <MissionBanner
        userName={userName}
        targetAmount={missionBrief.targetAmount}
        missionScore={missionBrief.missionScore}
        movesQueued={missionBrief.movesQueued}
        newLeads={missionBrief.newLeads}
        actions={missionBrief.actions}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-4">
          <MoneyTrapsPanel vehicles={vehicles} />
          <TopOpportunitiesPanel />
          <AiRecommendationsPanel />
          <MarketPulsePanel />
        </div>

        <div className="space-y-4 lg:row-span-2">
          <AiGmPanel missionScore={94} movesQueued={4} newLeads={11} />
          <CriticalAlertsPanel />
          <PricingOpportunitiesPanel vehicles={vehicles} />
          <AcquisitionOpportunitiesPanel opportunities={acquisitionOpportunities} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-4">
          <InventoryAgingChart vehicles={vehicles} />
          <ProfitTrendChart vehicles={vehicles} />
          <RevenueTrendChart vehicles={vehicles} />
          <LeadConversionChart />
          <InventoryTurnRateChart />
          <CashflowForecastChart transactions={transactions} />
          <MonthlyRevenueChart vehicles={vehicles} />
          <InventoryValueChart />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={Wallet}
          iconClassName="bg-success/10 text-success"
          label="Cash Available"
          value={formatCurrency(availableCash)}
          trendLabel={formatTrendLabel(trends.cashAvailable.changePct)}
          trendDirection={trendDirection(trends.cashAvailable.changePct)}
          trendSentiment={trends.cashAvailable.sentiment}
        />
        <StatCard
          icon={TrendingUp}
          iconClassName="bg-info/10 text-info"
          label="Expected Profit"
          value={formatCurrency(expectedProfit)}
          trendLabel={formatTrendLabel(trends.expectedProfit.changePct)}
          trendDirection={trendDirection(trends.expectedProfit.changePct)}
          trendSentiment={trends.expectedProfit.sentiment}
        />
        <StatCard
          icon={Layers}
          iconClassName="bg-violet-500/10 text-violet-400"
          label="Inventory Value"
          value={formatCurrency(retailValue)}
          trendLabel={formatTrendLabel(trends.inventoryValue.changePct)}
          trendDirection={trendDirection(trends.inventoryValue.changePct)}
          trendSentiment={trends.inventoryValue.sentiment}
        />
        <StatCard
          icon={AlertTriangle}
          iconClassName="bg-warning/10 text-warning"
          label="Cash Trapped"
          value={formatCurrency(cashTrapped)}
          trendLabel={formatTrendLabel(trends.cashTrapped.changePct)}
          trendDirection={trendDirection(trends.cashTrapped.changePct)}
          trendSentiment={trends.cashTrapped.sentiment}
        />
        <StatCard
          icon={Users}
          iconClassName="bg-sky-500/10 text-sky-400"
          label="Active Listings"
          value={String(activeListings)}
          trendLabel={
            trends.newActiveListings > 0
              ? `${trends.newActiveListings} new`
              : "No new listings"
          }
          trendDirection={trends.newActiveListings > 0 ? "up" : "flat"}
          trendSentiment={trends.newActiveListings > 0 ? "good" : "neutral"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total Vehicles" value={String(totalVehicles)} />
        <KpiCard title="Average ROI" value={formatPercent(avgRoi)} />
        <KpiCard
          title="Active / Inactive Listings"
          value={`${formatNumber(activeListings)} / ${formatNumber(inactiveListings)}`}
        />
        <KpiCard title="Avg. Days in Stock" value={String(avgDaysInStock)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <InventoryAgingWidget vehicles={vehicles} />
        <MoneyTrapWidget vehicles={vehicles} />
        <RevenueTrendWidget vehicles={vehicles} />
      </div>

      <Link href="/messenger">
        <Card className="border-primary/30 bg-primary/5 transition-colors hover:bg-primary/10">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold text-foreground">Messenger Inbox</p>
                <p className="text-sm text-muted-foreground">
                  {unreadMessages > 0
                    ? `${unreadMessages} unread message${unreadMessages !== 1 ? "s" : ""}`
                    : "All caught up"}
                </p>
              </div>
            </div>
            {unreadMessages > 0 && (
              <span className="rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">
                {unreadMessages}
              </span>
            )}
          </CardContent>
        </Card>
      </Link>

      <VoiceSaleEntry onSold={loadDashboardData} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {PRIORITY_ORDER.map((priority) => (
          <Card key={priority}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                {PRIORITY_LABELS[priority]}
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {priorityCounts[priority]}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Daily Action Board
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {filterCounts.action} vehicle{filterCounts.action !== 1 ? "s" : ""}{" "}
            need attention today
          </p>
        </div>

        <InventoryFilterTabs
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          counts={filterCounts}
        />

        {filteredVehicles.length === 0 ? (
          <div className="flex h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-border px-4 text-center">
            <p className="font-medium text-foreground">No vehicles match this filter</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeFilter === "action"
                ? "All vehicles are on hold — nothing needs action right now."
                : "Try a different filter."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredVehicles.map((vehicle) => (
              <InventoryCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
