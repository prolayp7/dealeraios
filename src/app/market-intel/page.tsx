"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { getVehicleLabel } from "@/lib/vehicle-logic";
import type { MarketEvaluation } from "@/lib/market-intel";
import type { Vehicle } from "@/lib/types";

interface SourceStatus {
  id: string;
  label: string;
  status: "connected" | "not_connected";
  listingCount: number;
  error: string | null;
}

interface HistoryEntry {
  timestamp: string;
  compCount: number;
  evaluation: MarketEvaluation;
}

export default function MarketIntelPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [evaluation, setEvaluation] = useState<MarketEvaluation | null>(null);
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/vehicles")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setVehicles(data);
          if (data.length > 0) setSelectedId(data[0].id);
        }
      })
      .catch(console.error);
  }, []);

  const loadHistory = useCallback(async (vehicleId: string) => {
    const res = await fetch(`/api/market-intel/history?vehicle_id=${vehicleId}`);
    const data = await res.json();
    if (res.ok) setHistory(data.history ?? []);
  }, []);

  useEffect(() => {
    if (selectedId) void loadHistory(selectedId);
  }, [selectedId, loadHistory]);

  const runEvaluation = async () => {
    if (!selectedId) return;
    setEvaluating(true);
    setError(null);

    try {
      const res = await fetch("/api/market-intel/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle_id: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Evaluation failed");

      setEvaluation(data.evaluation);
      setSources(data.sources ?? []);
      await loadHistory(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setEvaluating(false);
    }
  };

  const selectedVehicle = vehicles.find((v) => v.id === selectedId);
  const maxMarketPrice = Math.max(1, ...history.map((h) => h.evaluation.marketPrice));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-white">
            <TrendingUp className="h-8 w-8 text-orange-500" />
            Market Intelligence Engine
          </h1>
          <p className="mt-1 text-slate-400">
            Aggregates every connected marketplace source into one price picture.
            Facebook is fully connected today — the rest are wired for later.
          </p>
        </div>
        <Link href="/market-search">
          <Button variant="outline">Open Facebook Search Tool</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select a vehicle</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="h-10 min-w-64 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {getVehicleLabel(v)}
              </option>
            ))}
          </select>
          <Button onClick={runEvaluation} disabled={evaluating || !selectedId}>
            <RefreshCw className={`mr-2 h-4 w-4 ${evaluating ? "animate-spin" : ""}`} />
            {evaluating ? "Evaluating..." : "Evaluate Again"}
          </Button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </CardContent>
      </Card>

      {sources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sources</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {sources.map((s) => (
              <Badge
                key={s.id}
                variant={s.status === "connected" ? "buy" : "secondary"}
                title={s.error ?? undefined}
              >
                {s.label} · {s.status === "connected" ? `${s.listingCount} found` : "not connected"}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {evaluation && (
        <Card>
          <CardHeader>
            <CardTitle>
              Evaluation {selectedVehicle ? `— ${getVehicleLabel(selectedVehicle)}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Quick Sale Price" value={formatCurrency(evaluation.quickSalePrice)} />
            <Stat label="Market Price" value={formatCurrency(evaluation.marketPrice)} />
            <Stat label="Premium Price" value={formatCurrency(evaluation.premiumPrice)} />
            <Stat label="Max Buy Price" value={formatCurrency(evaluation.maxBuyPrice)} />
            <Stat label="Expected Profit" value={formatCurrency(evaluation.expectedProfit)} />
            <Stat label="Expected ROI" value={formatPercent(evaluation.expectedRoi)} />
            <Stat label="Expected Days to Sell" value={String(evaluation.expectedDaysToSell)} />
            <Stat label="Confidence Score" value={`${evaluation.confidenceScore}/100`} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Evaluation History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">
              No evaluations yet — click &ldquo;Evaluate Again&rdquo; to run the first one.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex h-24 items-end gap-2">
                {history.map((h) => (
                  <div key={h.timestamp} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-orange-500/70"
                      style={{
                        height: `${Math.max(4, (h.evaluation.marketPrice / maxMarketPrice) * 72)}px`,
                      }}
                      title={formatCurrency(h.evaluation.marketPrice)}
                    />
                    <span className="text-[10px] text-slate-500">
                      {new Date(h.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>

              <div className="divide-y divide-slate-800">
                {history
                  .slice()
                  .reverse()
                  .map((h) => (
                    <div key={h.timestamp} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-400">
                        {new Date(h.timestamp).toLocaleString()}
                      </span>
                      <span className="text-slate-200">
                        Market {formatCurrency(h.evaluation.marketPrice)} · {h.compCount} comps
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}
