export type ListingTemplateId = "professional" | "marketplace" | "luxury";

export interface ListingTemplate {
  id: ListingTemplateId;
  label: string;
  description: string;
  promptStyle: string;
}

// Answers §4/Q14 — three AI listing templates; the dealer picks a default.
export const LISTING_TEMPLATES: ListingTemplate[] = [
  {
    id: "professional",
    label: "Professional",
    description: "Clean, factual, dealer-lot tone — specs and condition up front.",
    promptStyle:
      "Write in a clean, professional dealer tone. Lead with year/make/model and key specs. Be factual and concise, no hype.",
  },
  {
    id: "marketplace",
    label: "Marketplace",
    description: "Friendly, casual tone tuned for Facebook Marketplace browsers.",
    promptStyle:
      "Write in a friendly, approachable tone suited to casual Marketplace shoppers. Highlight the best-selling points first, use short punchy sentences.",
  },
  {
    id: "luxury",
    label: "Luxury",
    description: "Elevated tone for higher-end vehicles — emphasizes craftsmanship and exclusivity.",
    promptStyle:
      "Write in an elevated, premium tone. Emphasize craftsmanship, performance, and exclusivity. Avoid discount-store language.",
  },
];

export function getListingTemplate(id: string | null | undefined): ListingTemplate {
  return (
    LISTING_TEMPLATES.find((t) => t.id === id) ??
    LISTING_TEMPLATES.find((t) => t.id === "marketplace")!
  );
}
