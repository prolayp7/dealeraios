import type { MarketSource, MarketSourceSearchResult } from "./types";

// Shared factory for the six not-yet-connected marketplace sources — the
// architecture supports adding any of them later without page-level changes,
// but Phase 2 only ships Facebook as a working source (Answers §3/Q9).
export function createStubSource(id: string, label: string): MarketSource {
  return {
    id,
    label,
    async search(): Promise<MarketSourceSearchResult> {
      return {
        status: "not_connected",
        listings: [],
        error: `${label} is not yet connected`,
      };
    },
  };
}
