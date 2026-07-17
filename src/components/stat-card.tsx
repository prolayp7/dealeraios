import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrendSentiment } from "@/lib/dashboard-trends";

interface StatCardProps {
  icon: LucideIcon;
  iconClassName: string;
  label: string;
  value: string;
  trendLabel: string;
  trendDirection?: "up" | "down" | "flat";
  trendSentiment?: TrendSentiment;
  className?: string;
}

const SENTIMENT_STYLES: Record<TrendSentiment, string> = {
  good: "text-success",
  bad: "text-warning",
  neutral: "text-muted-foreground",
};

const DIRECTION_ICON: Record<"up" | "down" | "flat", LucideIcon> = {
  up: ArrowUp,
  down: ArrowDown,
  flat: Minus,
};

export function StatCard({
  icon: Icon,
  iconClassName,
  label,
  value,
  trendLabel,
  trendDirection = "flat",
  trendSentiment = "neutral",
  className,
}: StatCardProps) {
  const TrendIcon = DIRECTION_ICON[trendDirection];

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            iconClassName
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-3 text-2xl font-bold text-foreground">{value}</div>
      <div
        className={cn(
          "mt-1 flex items-center gap-1 text-xs font-medium",
          SENTIMENT_STYLES[trendSentiment]
        )}
      >
        <TrendIcon className="h-3 w-3" />
        {trendLabel}
      </div>
    </div>
  );
}
