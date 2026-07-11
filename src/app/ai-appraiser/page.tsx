"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, ScanSearch, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { AppraisalRecommendation, AppraisalResult } from "@/lib/ai-appraiser";

const CONDITIONS = ["Excellent", "Good", "Fair", "Poor"];

const RECOMMENDATION_STYLES: Record<AppraisalRecommendation, string> = {
  BUY: "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40",
  WATCH: "bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/40",
  PASS: "bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/40",
  RUN: "bg-red-500/20 text-red-400 ring-1 ring-red-500/40",
};

export default function AiAppraiserPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [vin, setVin] = useState("");
  const [mileage, setMileage] = useState("");
  const [condition, setCondition] = useState("Good");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [repairEstimate, setRepairEstimate] = useState("0");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AppraisalResult | null>(null);

  const handleFiles = async (files: FileList) => {
    setUploading(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/vehicles/upload-photo", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        uploaded.push(data.url as string);
      }
      setPhotos((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!purchasePrice) {
      setError("Purchase price is required");
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/ai-appraiser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vin: vin.trim() || null,
          photos,
          mileage: mileage ? parseInt(mileage, 10) : null,
          condition,
          purchasePrice: parseFloat(purchasePrice),
          repairEstimate: repairEstimate ? parseFloat(repairEstimate) : 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Appraisal failed");

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Appraisal failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-white">
          <ScanSearch className="h-8 w-8 text-orange-500" />
          AI Appraiser Pro
        </h1>
        <p className="mt-1 text-slate-400">
          Per-vehicle appraisal — evaluate a specific vehicle you have in hand or are
          actively considering. For portfolio-wide pricing across your whole
          inventory, use AI GM instead.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vehicle Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="vin">VIN</Label>
              <Input id="vin" value={vin} onChange={(e) => setVin(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="mileage">Mileage</Label>
              <Input
                id="mileage"
                type="number"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="condition">Condition</Label>
            <select
              id="condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="purchasePrice">Purchase Price ($)</Label>
              <Input
                id="purchasePrice"
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="repairEstimate">Repair Estimate ($)</Label>
              <Input
                id="repairEstimate"
                type="number"
                value={repairEstimate}
                onChange={(e) => setRepairEstimate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Photos</Label>
            <div className="mt-2 flex flex-wrap gap-3">
              {photos.map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="relative h-20 w-28 overflow-hidden rounded-md border border-white/10 bg-slate-900"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                className="flex h-20 w-28 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-white/15 bg-slate-900/50 text-slate-400 hover:border-white/25"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                ) : (
                  <>
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[11px]">Add photos</span>
                  </>
                )}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => e.target.files?.length && void handleFiles(e.target.files)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button onClick={handleSubmit} disabled={submitting} className="w-full sm:w-auto">
            {submitting ? "Appraising..." : "Appraise Vehicle"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Appraisal Result</CardTitle>
            <span
              className={`rounded-full px-3 py-1 text-sm font-bold ${RECOMMENDATION_STYLES[result.recommendation]}`}
            >
              {result.recommendation}
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.summary && <p className="text-sm text-slate-300">{result.summary}</p>}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <ResultStat label="Retail Value" value={formatCurrency(result.retailValue)} />
              <ResultStat label="Wholesale Value" value={formatCurrency(result.wholesaleValue)} />
              <ResultStat label="Auction Value" value={formatCurrency(result.auctionValue)} />
              <ResultStat label="Trade Value" value={formatCurrency(result.tradeValue)} />
              <ResultStat label="Max Buy Price" value={formatCurrency(result.maxBuyPrice)} />
              <ResultStat label="Expected ROI" value={formatPercent(result.expectedRoi)} />
              <ResultStat label="Expected Profit" value={formatCurrency(result.expectedProfit)} />
              <ResultStat label="Expected Days to Sell" value={String(result.expectedDaysToSell)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ResultStat label="Risk Score" value={`${result.riskScore}/100`} />
              <ResultStat label="Confidence Score" value={`${result.confidenceScore}/100`} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}
