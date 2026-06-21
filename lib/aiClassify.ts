import Anthropic from "@anthropic-ai/sdk";

// Claude model names are stable. If you ever get a "model not found" error,
// change ONLY this line. Haiku is the fast, cheap model — ideal for classification.
const MODEL = "claude-haiku-4-5-20251001";

export type AiStatus = "Rejected" | "Advancing" | "Pending";

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
  return client;
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) : s;
}

/**
 * Classify a batch of emails in ONE API call.
 * Returns one status per email, in order.
 * Returns null for an item if the response can't be parsed —
 * the caller then falls back to keyword matching.
 */
export async function aiClassifyBatch(
  emails: { subject: string; body: string }[]
): Promise<(AiStatus | null)[]> {
  if (emails.length === 0) return [];
  if (!process.env.ANTHROPIC_API_KEY) return emails.map(() => null);

  const list = emails
    .map((e, i) => `Email ${i + 1}:\nSubject: ${e.subject}\nBody: ${truncate(e.body, 1500)}`)
    .join("\n\n---\n\n");

  const prompt = `You are classifying job application emails. For EACH email below, decide its status:
- "Rejected": the company declined the application or is not moving forward with the candidate.
- "Advancing": the company wants to interview, schedule a call, run an assessment, or move to a next step.
- "Pending": an application acknowledgment, auto-reply, or anything that is neither a rejection nor an advancement.

Return ONLY a JSON array of exactly ${emails.length} strings, one per email in order.
Each value must be exactly "Rejected", "Advancing", or "Pending". No explanation, no other text.

${list}`;

  try {
    const message = await getClient().messages.create({
      model: MODEL,
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    // Claude returns content blocks; grab the text from the first one
    const block = message.content[0];
    const text = block.type === "text" ? block.text.trim() : "";
    const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const arr = JSON.parse(clean);

    if (!Array.isArray(arr) || arr.length !== emails.length) {
      return emails.map(() => null);
    }

    return arr.map((v: unknown) => {
      const s = String(v).toLowerCase();
      if (s.includes("reject")) return "Rejected";
      if (s.includes("advanc")) return "Advancing";
      if (s.includes("pend")) return "Pending";
      return null;
    });
  } catch (err) {
    console.error("AI classify error:", err);
    return emails.map(() => null);
  }
}