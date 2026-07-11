"use client";

import type { ReactNode } from "react";
import { CarFront } from "lucide-react";

const FEATURES = ["Inventory", "Lead CRM", "Cashflow"];

interface AuthLayoutProps {
  headline: string;
  subcopy?: string;
  showFeatures?: boolean;
  children: ReactNode;
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={
          compact
            ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white"
            : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white"
        }
      >
        <CarFront className={compact ? "h-4 w-4" : "h-5 w-5"} />
      </div>
      <span className="text-sm font-bold text-white">Dealer AI OS</span>
    </div>
  );
}

export function AuthLayout({
  headline,
  subcopy,
  showFeatures = false,
  children,
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex items-center gap-3 border-b border-slate-800/60 bg-navy-dark px-6 py-5 lg:hidden">
        <BrandMark compact />
      </div>

      <div className="relative hidden overflow-hidden bg-gradient-to-br from-navy-dark via-navy to-orange-600/20 lg:flex lg:w-[45%] lg:flex-col lg:justify-center lg:px-12">
        <div className="absolute left-12 top-10">
          <BrandMark />
        </div>

        <div className="max-w-sm">
          <h1 className="text-3xl font-bold leading-tight text-white">
            {headline}
          </h1>
          {subcopy && (
            <p className="mt-3 text-slate-400">{subcopy}</p>
          )}

          {showFeatures && (
            <div className="mt-10 flex gap-8">
              {FEATURES.map((feature) => (
                <div key={feature}>
                  <div className="h-1 w-8 rounded-full bg-orange-500" />
                  <p className="mt-2 text-sm text-slate-300">{feature}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </div>
    </div>
  );
}
