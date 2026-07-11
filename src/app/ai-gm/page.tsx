"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Gavel, MessageCircleWarning, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import {
  DEFAULT_INACTIVITY_THRESHOLD_HOURS,
  getInactiveConversations,
} from "@/lib/ai-gm-recommendations";
import type {
  AuctionCandidate,
  PortfolioPricingRow,
  StaleListing,
} from "@/lib/ai-gm-recommendations";
import type { ConversationSummary } from "@/lib/types";

interface Portfolio {
  auctionCandidates: AuctionCandidate[];
  portfolioPricing: PortfolioPricingRow[];
  staleListings: StaleListing[];
}

export default function AiGmPage() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [inactivityThreshold, setInactivityThreshold] = useState(
    DEFAULT_INACTIVITY_THRESHOLD_HOURS
  );
  const [loading, setLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [refreshedIds, setRefreshedIds] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/ai-gm/portfolio").then((r) => r.json()),
      fetch("/api/messenger/conversations").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ])
      .then(([portfolioData, conversationData, settingsData]) => {
        setPortfolio(portfolioData);
        if (Array.isArray(conversationData)) setConversations(conversationData);
        if (settingsData?.inactivity_threshold_hours) {
          setInactivityThreshold(settingsData.inactivity_threshold_hours);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const approveRefresh = async (vehicleId: string) => {
    setRefreshingId(vehicleId);
    try {
      const res = await fetch("/api/ai-gm/refresh-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle_id: vehicleId }),
      });
      if (!res.ok) throw new Error("Refresh failed");
      setRefreshedIds((prev) => new Set(prev).add(vehicleId));
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshingId(null);
    }
  };

  const inactiveConversations = getInactiveConversations(conversations, inactivityThreshold);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-slate-400">Loading AI GM...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-white">
          <Bot className="h-8 w-8 text-orange-500" />
          AI General Manager
        </h1>
        <p className="mt-1 text-slate-400">
          Portfolio-wide calls across your whole inventory — distinct from AI
          Appraiser&apos;s per-vehicle valuation. Recommendations only: nothing here
          posts a listing or refreshes one without your explicit approval.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-orange-500" />
            Auction / Wholesale / Price Reduction Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {portfolio?.auctionCandidates.length === 0 ? (
            <p className="text-sm text-slate-500">No vehicles need action right now.</p>
          ) : (
            <div className="space-y-2">
              {portfolio?.auctionCandidates.map((c) => (
                <div
                  key={c.vehicleId}
                  className="flex items-center justify-between rounded-md border border-slate-800 px-3 py-2"
                >
                  <div>
                    <Link href={`/inventory/${c.vehicleId}`} className="text-sm font-medium text-slate-100 hover:underline">
                      {c.label}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {c.daysInStock} days in stock · {c.roi.toFixed(1)}% ROI
                    </p>
                  </div>
                  <Badge variant="moneyTrap">{c.action}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-orange-500" />
            Listing Refresh — Approval Needed
          </CardTitle>
        </CardHeader>
        <CardContent>
          {portfolio?.staleListings.length === 0 ? (
            <p className="text-sm text-slate-500">No stale listings detected.</p>
          ) : (
            <div className="space-y-2">
              {portfolio?.staleListings.map((s) => {
                const refreshed = refreshedIds.has(s.vehicleId);
                return (
                  <div
                    key={s.vehicleId}
                    className="flex items-center justify-between rounded-md border border-slate-800 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-100">{s.label}</p>
                      <p className="text-xs text-slate-500">
                        Listed {s.daysSinceListed} days ago without a refresh
                      </p>
                    </div>
                    {refreshed ? (
                      <Badge variant="hold">Refreshed — dealer approved</Badge>
                    ) : (
                      <Button
                        size="sm"
                        disabled={refreshingId === s.vehicleId}
                        onClick={() => approveRefresh(s.vehicleId)}
                      >
                        {refreshingId === s.vehicleId ? "Refreshing..." : "Approve Refresh"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI GM Pricing — Portfolio-Wide</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Current Price</TableHead>
                <TableHead>Recommended</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {portfolio?.portfolioPricing.map((row) => (
                <TableRow key={row.vehicleId}>
                  <TableCell>
                    <Link href={`/inventory/${row.vehicleId}`} className="hover:underline">
                      {row.label}
                    </Link>
                  </TableCell>
                  <TableCell>{formatCurrency(row.currentPrice)}</TableCell>
                  <TableCell>{formatCurrency(row.recommendedPrice)}</TableCell>
                  <TableCell>
                    {row.changePercent != null ? (
                      <span className={row.changePercent > 0 ? "text-emerald-400" : "text-amber-400"}>
                        {row.changePercent > 0 ? "+" : ""}
                        {row.changePercent}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-400">{row.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircleWarning className="h-5 w-5 text-orange-500" />
            Inactive Conversations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {inactiveConversations.length === 0 ? (
            <p className="text-sm text-slate-500">
              No conversations inactive for {inactivityThreshold}+ hours with unread messages.
            </p>
          ) : (
            <div className="space-y-2">
              {inactiveConversations.map((c) => (
                <Link
                  key={c.customer.id}
                  href="/messenger"
                  className="flex items-center justify-between rounded-md border border-slate-800 px-3 py-2 hover:bg-slate-800/50"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-100">
                      {c.customer.name ?? "Unknown"}
                    </p>
                    <p className="text-xs text-slate-500">{c.last_message}</p>
                  </div>
                  <Badge variant="urgent">{c.unread_count} unread</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
