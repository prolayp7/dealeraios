import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionDealership } from "@/lib/supabase/session";
import { ScraperError } from "@/lib/fb-scraper/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { parseSearchParams, scrapeFacebookMarketplace } = await import(
      "@/lib/fb-scraper/scraper"
    );
    const params = parseSearchParams(body);

    if (!params.make && !params.model) {
      return NextResponse.json(
        { error: "Make or model is required for search" },
        { status: 400 }
      );
    }

    const searchResult = await scrapeFacebookMarketplace(params, session.dealershipId);

    return NextResponse.json({
      count: searchResult.results.length,
      results: searchResult.results,
      resultBatch: searchResult.resultBatch,
      skipCount: searchResult.skipCount,
      hasMore: searchResult.hasMore,
    });
  } catch (error) {
    console.error("POST /api/fb-scraper:", error);

    if (error instanceof ScraperError) {
      const statusMap: Record<ScraperError["code"], number> = {
        CONFIG: 500,
        LOGIN: 401,
        TWO_FACTOR: 403,
        BLOCKED: 429,
        MULTILOGIN: 502,
        GOLOGIN: 502,
        SCRAPE: 500,
        PUBLISH: 500,
      };

      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] ?? 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to scrape Facebook Marketplace" },
      { status: 500 }
    );
  }
}
