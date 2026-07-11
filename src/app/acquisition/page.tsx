"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import type { AcquisitionOpportunity } from "@/lib/types";

const RECOMMENDATION_BADGE: Record<AcquisitionOpportunity["recommendation"], "buy" | "hold" | "pass" | "urgent"> = {
  BUY: "buy",
  WATCH: "hold",
  PASS: "pass",
  RUN: "urgent",
};

export default function AcquisitionPage() {
  const [opportunities, setOpportunities] = useState<AcquisitionOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceStatus, setSourceStatus] = useState<
    { id: string; label: string; status: string; listingCount: number; error: string | null }[]
  >([]);

  const load = () => {
    setLoading(true);
    fetch("/api/acquisition")
      .then((res) => res.json())
      .then((data) => Array.isArray(data) && setOpportunities(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const runScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/acquisition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ make, model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setSourceStatus(data.sources ?? []);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-white">
          <ShoppingCart className="h-8 w-8 text-orange-500" />
          Acquisition Brain
        </h1>
        <p className="mt-1 text-slate-400">
          Passive marketplace opportunities the dealer hasn&apos;t engaged with yet —
          distinct from AI Appraiser, which evaluates a vehicle you already have
          or are actively considering.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scan for Opportunities</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="acq-make">Make</Label>
            <Input id="acq-make" value={make} onChange={(e) => setMake(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="acq-model">Model</Label>
            <Input id="acq-model" value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          <Button onClick={runScan} disabled={scanning || (!make && !model)}>
            <Search className="h-4 w-4" />
            {scanning ? "Scanning..." : "Scan"}
          </Button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </CardContent>
      </Card>

      {sourceStatus.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sources</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {sourceStatus.map((s) => (
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

      <Card>
        <CardHeader>
          <CardTitle>Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : opportunities.length === 0 ? (
            <p className="text-sm text-slate-500">
              No opportunities discovered yet — run a scan above.
            </p>
          ) : (
            <div className="space-y-2">
              {opportunities.map((o) => (
                <div
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-800 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <a
                      href={o.url ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-slate-100 hover:underline"
                    >
                      {o.year} {o.make} {o.model}
                    </a>
                    <p className="text-xs text-slate-500">
                      {o.source} · {formatCurrency(o.asking_price)} · {o.location ?? "Unknown location"}
                    </p>
                    {o.notes && <p className="mt-1 text-xs text-slate-500">{o.notes}</p>}
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <p>Max Buy: {formatCurrency(o.max_buy_price)}</p>
                    <p>Profit: {formatCurrency(o.expected_profit)}</p>
                  </div>
                  <Badge variant={RECOMMENDATION_BADGE[o.recommendation]}>{o.recommendation}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
