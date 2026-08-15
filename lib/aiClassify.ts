import Anthropic from "@anthropic-ai/sdk";
import {
  AiResult,
  SYSTEM_INSTRUCTIONS,
  buildUserMessage,
  parseClassifyResponse,
} from "./classifyShared";

// Claude (Anthropic) classifier. PRESERVED for when Anthropic credit is available
// — select it with CLASSIFY_ENGINE=claude. Uses the shared rules + parser so it
// stays identical in behavior to the free Groq engine.
const MODEL = "claude-haiku-4-5-20251001";

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
  return client;
}

export async function aiClassifyBatch(
  emails: { subject: string; body: string }[]
): Promise<(AiResult | null)[]> {
  if (emails.length === 0) return [];
  if (!process.env.ANTHROPIC_API_KEY) return emails.map(() => null);

  const userMessage = buildUserMessage(emails);

  try {
    const message = await getClient().messages.create({
      model: MODEL,
      max_tokens: 2500,
      system: [{ type: "text", text: SYSTEM_INSTRUCTIONS, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage }],
    });

    const block = message.content[0];
    const text = block.type === "text" ? block.text.trim() : "";
    return parseClassifyResponse(text, emails.length);
  } catch (err) {
    console.error("AI classify error:", err);
    return emails.map(() => null);
  }
}

// Re-export shared helpers so existing imports from "@/lib/aiClassify" keep working.
export { stageToStatus } from "./classifyShared";
export type { Stage, AiStatus, AiResult } from "./classifyShared";