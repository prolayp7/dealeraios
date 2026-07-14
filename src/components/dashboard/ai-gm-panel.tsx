import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AI_GM_SUMMARY } from "@/lib/dashboard-static-data";

interface AiGmPanelProps {
  missionScore: number;
  movesQueued: number;
  newLeads: number;
}

export function AiGmPanel({ missionScore, movesQueued, newLeads }: AiGmPanelProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">AI GM</CardTitle>
        <Link href="/ai-gm" className="text-xs font-medium text-info hover:underline">
          Open →
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-foreground">{AI_GM_SUMMARY}</p>
        <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
          <div>
            <p className="text-lg font-bold text-foreground">{missionScore}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Score</p>
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{movesQueued}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Moves</p>
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{newLeads}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Leads</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
