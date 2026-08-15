import Anthropic from "@anthropic-ai/sdk";

// ── Unified LLM helper ───────────────────────────────────────────────────────
// One place that runs a "system prompt + user message -> text" completion on
// EITHER Claude or Groq, chosen by the LLM_ENGINE env var:
//   "groq"   -> free Groq/Llama (default — no Anthropic credit needed)
//   "claude" -> Anthropic Haiku (switch back when you have credit)
//
// All the app's JSON-producing AI calls (interview analysis, insights, prep,
// skill fallback) go through this, so switching every one of them between free
// and paid is a single env-var change — and Claude's path stays fully intact.

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

let anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
  return anthropic;
}

function engine(): "groq" | "claude" {
  return (process.env.LLM_ENGINE || "groq").toLowerCase() === "claude" ? "claude" : "groq";
}

export type LlmOptions = {
  system: string;
  user: string;
  maxTokens?: number;
  // Ask providers that support it to return strict JSON. Safe to leave true for
  // our JSON-producing prompts; ignored by providers that don't support it.
  json?: boolean;
};

/**
 * Run a single completion and return the raw text output (usually JSON that the
 * caller parses). Returns null on any failure or missing key, so callers can
 * fail soft exactly as they did with the old direct Claude calls.
 */
export async function llmComplete(opts: LlmOptions): Promise<string | null> {
  const maxTokens = opts.maxTokens ?? 1500;

  if (engine() === "claude") {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    try {
      const message = await getAnthropic().messages.create({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: opts.user }],
      });
      const block = message.content[0];
      return block.type === "text" ? block.text.trim() : null;
    } catch (err) {
      console.error("llmComplete (claude) error:", err);
      return null;
    }
  }

  // Groq (OpenAI-compatible)
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        temperature: 0,
        max_tokens: maxTokens,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) {
      console.error("llmComplete (groq) error:", res.status, (await res.text().catch(() => "")).slice(0, 200));
      return null;
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    return content.trim() || null;
  } catch (err) {
    console.error("llmComplete (groq) exception:", err);
    return null;
  }
}

// Strip markdown fences and parse JSON; returns null if not valid JSON.
export function parseJsonLoose<T>(text: string | null): T | null {
  if (!text) return null;
  const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(clean) as T;
  } catch {
    return null;
  }
}