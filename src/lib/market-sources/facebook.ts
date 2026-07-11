import type {
  MarketSource,
  MarketSourceSearchParams,
  MarketSourceSearchResult,
} from "./types";

export const facebookSource: MarketSource = {
  id: "facebook",
  label: "Facebook Marketplace",

  async search(params: MarketSourceSearchParams): Promise<MarketSourceSearchResult> {
    try {
      const { parseSearchParams, scrapeFacebookMarketplace } = await import(
        "@/lib/fb-scraper/scraper"
      );

      const searchParams = parseSearchParams({
        make: params.make,
        model: params.model,
        yearFrom: params.year ?? 0,
        yearTo: params.year ?? 0,
      });

      const result = await scrapeFacebookMarketplace(searchParams);

      return {
        status: "connected",
        listings: result.results.map((listing) => ({
          title: listing.title,
          price: listing.price,
          mileage: listing.mileage,
          location: listing.location,
          url: listing.url,
          year: listing.year,
          make: listing.make,
          model: listing.model,
        })),
      };
    } catch (error) {
      // Live scraping can fail for reasons unrelated to data quality (FB auth,
      // browser automation unavailable in this environment, rate limits) —
      // report it rather than crash the whole evaluation.
      return {
        status: "connected",
        listings: [],
        error: error instanceof Error ? error.message : "Facebook search failed",
      };
    }
  },
};
