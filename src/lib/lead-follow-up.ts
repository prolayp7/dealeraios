import { kieChatCompletion } from "@/lib/kie-ai";
import type { Customer, Message } from "@/lib/types";

const SYSTEM_PROMPT = `You write short, friendly follow-up messages for an independent car
dealership's Facebook Messenger leads who have gone quiet. Keep it natural, low-pressure,
under 300 characters, and reference the conversation context if useful. Return only the
message text, no quotes, no markdown.`;

export async function generateFollowUpMessage(
  customer: Pick<Customer, "name">,
  recentMessages: Pick<Message, "message" | "direction">[],
  customTemplate?: string
): Promise<string> {
  const context = recentMessages
    .slice(-5)
    .map((m) => `${m.direction === "inbound" ? "Customer" : "Dealer"}: ${m.message}`)
    .join("\n");

  const userPrompt = [
    `Customer name: ${customer.name ?? "there"}`,
    context ? `Recent conversation:\n${context}` : "No prior conversation on record.",
    customTemplate
      ? `Use this dealer-saved template as a starting point/tone guide: "${customTemplate}"`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const content = await kieChatCompletion({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.6,
  });

  return content.trim();
}
