export interface MarketSourceListing {
  title: string;
  price: number | null;
  mileage: number | null;
  location: string | null;
  url: string;
  year: number | null;
  make: string | null;
  model: string | null;
}

export interface MarketSourceSearchParams {
  make: string;
  model: string;
  year?: number | null;
}

export type MarketSourceStatus = "connected" | "not_connected";

export interface MarketSourceSearchResult {
  status: MarketSourceStatus;
  listings: MarketSourceListing[];
  error?: string;
}

// Every marketplace integration — working or future — implements this
// interface, so Market Intelligence and List Everywhere can add sources
// without rearchitecting either page.
export interface MarketSource {
  id: string;
  label: string;
  search(params: MarketSourceSearchParams): Promise<MarketSourceSearchResult>;
}
