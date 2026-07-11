import { kieChatCompletion, type KieMessageContentPart } from "@/lib/kie-ai";

export type AppraisalRecommendation = "BUY" | "WATCH" | "PASS" | "RUN";

export interface AppraisalInput {
  vin: string | null;
  photos: string[];
  mileage: number | null;
  condition: string;
  purchasePrice: number;
  repairEstimate: number;
}

export interface AppraisalResult {
  retailValue: number;
  wholesaleValue: number;
  auctionValue: number;
  tradeValue: number;
  maxBuyPrice: number;
  expectedRoi: number;
  expectedProfit: number;
  expectedDaysToSell: number;
  riskScore: number;
  confidenceScore: number;
  recommendation: AppraisalRecommendation;
  summary: string;
}

const SYSTEM_PROMPT = `You are an expert independent-dealership vehicle appraiser (AI Appraiser Pro).
Given a vehicle's VIN, mileage, condition, purchase price, repair estimate, and photos, produce a
per-vehicle appraisal. This is a single-vehicle decision tool distinct from portfolio-wide pricing.

Return a JSON object with exactly these fields:
- retailValue (number): expected retail asking price
- wholesaleValue (number): expected wholesale/dealer-to-dealer value
- auctionValue (number): expected auction sale value
- tradeValue (number): expected trade-in value
- maxBuyPrice (number): the most this dealer should pay to still hit a healthy margin
- expectedRoi (number): expected ROI as a percent, e.g. 22.5
- expectedProfit (number): expected net profit in dollars if bought at purchasePrice
- expectedDaysToSell (number): estimated days to sell at retailValue
- riskScore (number 0-100): higher = riskier (condition, photo damage, mileage, market thinness)
- confidenceScore (number 0-100): confidence in this appraisal given the inputs provided
- recommendation (string): exactly one of "BUY", "WATCH", "PASS", "RUN"
- summary (string): one or two sentences explaining the recommendation

Only return valid JSON, no markdown.`;

export async function appraiseVehicle(
  input: AppraisalInput
): Promise<AppraisalResult> {
  const textPrompt = [
    `VIN: ${input.vin ?? "unknown"}`,
    `Mileage: ${input.mileage ?? "unknown"}`,
    `Condition: ${input.condition}`,
    `Purchase price under consideration: $${input.purchasePrice}`,
    `Repair estimate: $${input.repairEstimate}`,
    input.photos.length > 0
      ? `${input.photos.length} photo(s) attached for visual condition assessment.`
      : "No photos provided.",
  ].join("\n");

  const content: KieMessageContentPart[] = [{ type: "text", text: textPrompt }];
  for (const url of input.photos) {
    content.push({ type: "image_url", image_url: { url } });
  }

  const raw = await kieChatCompletion({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const parsed = JSON.parse(raw) as Partial<AppraisalResult>;

  const validRecommendations: AppraisalRecommendation[] = ["BUY", "WATCH", "PASS", "RUN"];
  const recommendation = validRecommendations.includes(
    parsed.recommendation as AppraisalRecommendation
  )
    ? (parsed.recommendation as AppraisalRecommendation)
    : "WATCH";

  return {
    retailValue: parsed.retailValue ?? 0,
    wholesaleValue: parsed.wholesaleValue ?? 0,
    auctionValue: parsed.auctionValue ?? 0,
    tradeValue: parsed.tradeValue ?? 0,
    maxBuyPrice: parsed.maxBuyPrice ?? 0,
    expectedRoi: parsed.expectedRoi ?? 0,
    expectedProfit: parsed.expectedProfit ?? 0,
    expectedDaysToSell: parsed.expectedDaysToSell ?? 0,
    riskScore: parsed.riskScore ?? 50,
    confidenceScore: parsed.confidenceScore ?? 50,
    recommendation,
    summary: parsed.summary ?? "",
  };
}
