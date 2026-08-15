// ── Model providers (free tiers) ─────────────────────────────────────────────
// The agent can run on either Groq or Google Gemini — both have free tiers and
// both expose an OpenAI-COMPATIBLE chat-completions API, so one implementation
// speaks to both by just swapping the base URL, model, and API key.
//
// This is the "swap the model provider = one-file change" payoff of building the
// tools behind a clean interface: the agent loop doesn't know or care which
// provider it's talking to.

export type ProviderId = "groq" | "gemini";

export type ProviderConfig = {
  id: ProviderId;
  label: string;
  baseUrl: string;   // OpenAI-compatible /chat/completions endpoint base
  model: string;     // a solid free model on that provider
  apiKeyEnv: string; // env var holding the key
};

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  groq: {
    id: "groq",
    label: "Groq (Llama 3.3)",
    baseUrl: "https://api.groq.com/openai/v1",
    // Overridable via env in case a model is retired — change without touching code.
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    apiKeyEnv: "GROQ_API_KEY",
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: process.env.GEMINI_MODEL || "gemini-flash-latest",
    apiKeyEnv: "GEMINI_API_KEY",
  },
};

export function getProvider(id: string | undefined): ProviderConfig {
  if (id && (id === "groq" || id === "gemini")) return PROVIDERS[id];
  // Default: prefer whichever key is configured, Groq first.
  if (process.env.GROQ_API_KEY) return PROVIDERS.groq;
  if (process.env.GEMINI_API_KEY) return PROVIDERS.gemini;
  return PROVIDERS.groq;
}

// ── OpenAI-compatible chat types (the subset we use) ─────────────────────────
export type OAIMessage =
  | { role: "system" | "user" | "assistant"; content: string | null; tool_calls?: OAIToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };

export type OAIToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type OAITool = {
  type: "function";
  function: { name: string; description: string; parameters: object };
};

export type OAIResponse = {
  choices: { message: { role: "assistant"; content: string | null; tool_calls?: OAIToolCall[] }; finish_reason: string }[];
};

/**
 * One chat-completions call against the chosen provider. Throws with a clear
 * message if the key is missing or the API errors.
 */
const RETRYABLE = new Set([500, 502, 503, 504]); // transient server errors — worth retrying (NOT 429: a quota error won't clear by retrying)
const MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callProvider(
  provider: ProviderConfig,
  messages: OAIMessage[],
  tools: OAITool[]
): Promise<OAIResponse> {
  const apiKey = process.env[provider.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`Missing ${provider.apiKeyEnv} — add it to your environment to use ${provider.label}.`);
  }

  const body = JSON.stringify({
    model: provider.model,
    messages,
    tools: tools.length > 0 ? tools : undefined,
    tool_choice: tools.length > 0 ? "auto" : undefined,
    temperature: 0.2,
    max_tokens: 1024,
  });

  let lastErr = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body,
      });
    } catch (netErr) {
      // network hiccup — retry
      lastErr = String(netErr);
      if (attempt < MAX_ATTEMPTS) { await sleep(attempt * 700); continue; }
      throw new Error(`${provider.label} network error: ${lastErr}`);
    }

    if (res.ok) return (await res.json()) as OAIResponse;

    const text = await res.text().catch(() => "");
    lastErr = `${res.status}: ${text.slice(0, 300)}`;

    // Retry transient overloads (e.g. free-tier 503 "high demand") with backoff.
    if (RETRYABLE.has(res.status) && attempt < MAX_ATTEMPTS) {
      await sleep(attempt * 900); // 900ms, 1800ms — simple linear backoff
      continue;
    }
    // 429 = free-tier quota hit. Retrying won't help; surface a clear message.
    if (res.status === 429) {
      throw new Error(`${provider.label} free-tier limit reached — wait a minute, or switch models. [${lastErr}]`);
    }
    // Non-retryable (e.g. 404 bad model, 401 bad key) — fail immediately with a clear message.
    throw new Error(`${provider.label} API error ${lastErr}`);
  }

  throw new Error(`${provider.label} is busy right now (kept getting overloaded). Try again in a moment. [${lastErr}]`);
}