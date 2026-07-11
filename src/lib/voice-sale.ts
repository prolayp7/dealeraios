import { kieChatCompletion } from "@/lib/kie-ai";
import type { Vehicle } from "@/lib/types";

export interface ParsedSale {
  year: number | null;
  make: string | null;
  model: string | null;
  price: number | null;
}

const SYSTEM_PROMPT = `Extract a vehicle sale from a dealer's spoken sentence, e.g.
"I sold the 2016 Volvo XC90 for $4000". Return JSON: {"year": number|null,
"make": string|null, "model": string|null, "price": number|null}. Only return
valid JSON, no markdown.`;

export async function parseSaleUtterance(transcript: string): Promise<ParsedSale> {
  const content = await kieChatCompletion({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: transcript },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const parsed = JSON.parse(content) as Partial<ParsedSale>;
  return {
    year: parsed.year ?? null,
    make: parsed.make ?? null,
    model: parsed.model ?? null,
    price: parsed.price ?? null,
  };
}

function normalize(value: string | null): string {
  return (value ?? "").toLowerCase().trim();
}

// Matches the parsed sale against in-stock vehicles by make/model (and year
// when given). Returns null if there's no unambiguous match — the dealer
// should confirm manually rather than the system guessing.
export function matchVehicle(sale: ParsedSale, vehicles: Vehicle[]): Vehicle | null {
  if (!sale.make && !sale.model) return null;

  const candidates = vehicles.filter((v) => {
    if ((v.status ?? "").toLowerCase() === "sold") return false;
    const makeMatches = !sale.make || normalize(v.make).includes(normalize(sale.make));
    const modelMatches = !sale.model || normalize(v.model).includes(normalize(sale.model));
    const yearMatches = !sale.year || v.year === sale.year;
    return makeMatches && modelMatches && yearMatches;
  });

  return candidates.length === 1 ? candidates[0] : null;
}
