"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

interface VoiceSaleEntryProps {
  onSold?: () => void;
}

// Minimal ambient type for the Web Speech API — not in the standard TS lib
// and only implemented in Chromium browsers, hence the runtime feature check.
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

export function VoiceSaleEntry({ onSold }: VoiceSaleEntryProps) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    vehicle: { year: number | null; make: string | null; model: string | null };
    soldPrice: number;
    netProfit: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setSupported(false);
      return;
    }

    setSupported(true);
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? "";
      setTranscript(text);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      setError(null);
      setResult(null);
      recognitionRef.current.start();
      setListening(true);
    }
  };

  const submitSale = async () => {
    if (!transcript.trim()) return;
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/voice-sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process sale");

      setResult(data);
      setTranscript("");
      onSold?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process sale");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voice Sale Entry</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-400">
          Say something like &ldquo;I sold the 2016 Volvo XC90 for $4000&rdquo; —
          browser microphone only, no phone integration.
        </p>

        <div className="flex gap-2">
          {supported && (
            <Button
              type="button"
              variant={listening ? "destructive" : "outline"}
              onClick={toggleListening}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {listening ? "Stop" : "Speak"}
            </Button>
          )}
          <Input
            placeholder={
              supported
                ? "Transcript appears here — edit if needed"
                : "Mic not supported in this browser — type the sale instead"
            }
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitSale()}
          />
          <Button type="button" onClick={submitSale} disabled={submitting || !transcript.trim()}>
            <Send className="h-4 w-4" />
            {submitting ? "Processing..." : "Submit"}
          </Button>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {result && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            Sold {result.vehicle.year} {result.vehicle.make} {result.vehicle.model} for{" "}
            {formatCurrency(result.soldPrice)} — net profit {formatCurrency(result.netProfit)}.
            Archived, listings removed, cashflow updated.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
