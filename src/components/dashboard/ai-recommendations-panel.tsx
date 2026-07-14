import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AI_RECOMMENDATIONS } from "@/lib/dashboard-static-data";

export function AiRecommendationsPanel() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          AI Recommendations
        </CardTitle>
        <a href="/ai-gm" className="text-xs font-medium text-info hover:underline">
          AI GM →
        </a>
      </CardHeader>
      <CardContent className="space-y-3">
        {AI_RECOMMENDATIONS.map((text) => (
          <div key={text} className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-info" />
            <p className="text-sm text-foreground">{text}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
