import { formatCurrency } from "@/lib/utils";

interface MissionAction {
  label: string;
  sublabel: string;
}

interface MissionBannerProps {
  userName?: string;
  targetAmount: number;
  missionScore: number;
  movesQueued: number;
  newLeads: number;
  actions: MissionAction[];
}

export function MissionBanner({
  userName = "Didar",
  targetAmount,
  missionScore,
  movesQueued,
  newLeads,
  actions,
}: MissionBannerProps) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - missionScore / 100);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950/50 via-slate-950 to-slate-950 p-6 sm:p-8">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
            Good morning, {userName}
          </p>
          <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
            Today&apos;s mission: release{" "}
            <span className="text-blue-400">{formatCurrency(targetAmount)}</span>
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Mission score{" "}
            <span className="font-bold text-blue-400">{missionScore}/100</span>
            <span className="mx-2 text-slate-600">•</span>
            <span className="font-bold text-white">{movesQueued}</span> moves
            queued
            <span className="mx-2 text-slate-600">•</span>
            <span className="font-bold text-white">{newLeads}</span> new leads
          </p>
        </div>

        <div className="relative flex h-28 w-28 shrink-0 items-center justify-center self-center sm:self-start">
          <svg className="h-28 w-28 -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              stroke="rgba(148,163,184,0.15)"
              strokeWidth="6"
            />
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              stroke="#22c55e"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ filter: "drop-shadow(0 0 6px rgba(34,197,94,0.6))" }}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-2xl font-bold text-white">
              {missionScore}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-slate-400">
              Mission
            </span>
            <span className="text-[10px] uppercase tracking-wide text-slate-400">
              Score
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((action, i) => (
          <div
            key={action.label}
            className="flex items-start gap-3 rounded-xl border border-slate-800/60 bg-slate-950/40 p-4"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-bold text-blue-400">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-semibold text-white">{action.label}</p>
              <p className="mt-0.5 text-xs font-medium text-emerald-400">
                {action.sublabel}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
