"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { computeAvailableCash } from "@/lib/available-cash";
import { computeCashflowForecast } from "@/lib/cashflow-forecast";
import { formatCurrency } from "@/lib/utils";
import type { CashflowTransaction, CashflowType } from "@/lib/types";

const TYPE_LABELS: Record<CashflowType, string> = {
  vehicle_purchase: "Vehicle Purchase",
  vehicle_sale: "Vehicle Sale",
  repair: "Repair",
  transport: "Transport",
  insurance: "Insurance",
  rent: "Rent",
  payroll: "Payroll",
  advertising: "Advertising",
  auction_fee: "Auction Fee",
  misc: "Miscellaneous",
};

const CASH_IN_TYPES = new Set<CashflowType>(["vehicle_sale"]);

const defaultForm = {
  type: "misc" as CashflowType,
  amount: "",
  description: "",
  transaction_date: new Date().toISOString().split("T")[0],
};

export default function CashflowPage() {
  const [transactions, setTransactions] = useState<CashflowTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/cashflow")
      .then((res) => res.json())
      .then((data) => Array.isArray(data) && setTransactions(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const availableCash = useMemo(() => computeAvailableCash(transactions), [transactions]);
  const forecast = useMemo(() => computeCashflowForecast(transactions), [transactions]);
  const maxForecast = Math.max(1, ...forecast.points.map((p) => Math.abs(p.projectedCash)));

  const handleAdd = async () => {
    if (!form.amount) {
      setError("Amount is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/cashflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save transaction");
      setForm(defaultForm);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save transaction");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-white">
          <Wallet className="h-8 w-8 text-orange-500" />
          Cashflow
        </h1>
        <p className="mt-1 text-slate-400">
          Every transaction feeds Available Cash on the Command Center in real time.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Cash</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-white">{formatCurrency(availableCash)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Transaction</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label htmlFor="cf-type">Type</Label>
            <select
              id="cf-type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CashflowType }))}
              className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="cf-amount">Amount ($)</Label>
            <Input
              id="cf-amount"
              type="number"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="cf-date">Date</Label>
            <Input
              id="cf-date"
              type="date"
              value={form.transaction_date}
              onChange={(e) => setForm((f) => ({ ...f, transaction_date: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="cf-description">Description</Label>
            <Input
              id="cf-description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="flex items-end sm:col-span-2 lg:col-span-5">
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? "Saving..." : "Add Transaction"}
            </Button>
          </div>
          {error && <p className="text-sm text-red-400 sm:col-span-2 lg:col-span-5">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Future Cashflow Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          {!forecast.hasEnoughHistory ? (
            <p className="text-sm text-slate-500">
              Not enough transaction history yet to project a trend — add
              transactions over time and this will fill in.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                Average monthly net: {formatCurrency(forecast.monthlyNetAverage)}
              </p>
              <div className="flex h-24 items-end gap-3">
                {forecast.points.map((p) => (
                  <div key={p.monthKey} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t ${p.projectedCash >= 0 ? "bg-emerald-500/70" : "bg-red-500/70"}`}
                      style={{ height: `${Math.max(4, (Math.abs(p.projectedCash) / maxForecast) * 72)}px` }}
                      title={formatCurrency(p.projectedCash)}
                    />
                    <span className="text-[10px] text-slate-500">{p.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Running Transaction Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.transaction_date}</TableCell>
                    <TableCell>
                      <Badge variant={CASH_IN_TYPES.has(t.type) ? "buy" : "secondary"}>
                        {TYPE_LABELS[t.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-400">{t.description ?? "—"}</TableCell>
                    <TableCell className={CASH_IN_TYPES.has(t.type) ? "text-emerald-400" : "text-amber-400"}>
                      {CASH_IN_TYPES.has(t.type) ? "+" : "-"}
                      {formatCurrency(t.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
