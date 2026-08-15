import { aiClassifyBatch } from "./aiClassify";
import { groqClassifyBatch } from "./groqClassify";
import type { AiResult } from "./classifyShared";

// Chooses which model classifies emails. Set CLASSIFY_ENGINE in the environment:
//   "groq"   -> free Groq/Llama (default — no Anthropic credit needed)
//   "claude" -> original Anthropic Haiku (switch back here when you have credit)
//
// This is the ONE place the engine is chosen. Claude's code (aiClassify.ts) is
// fully preserved and used whenever CLASSIFY_ENGINE=claude.
export function classifyBatch(
  emails: { subject: string; body: string }[]
): Promise<(AiResult | null)[]> {
  const engine = (process.env.CLASSIFY_ENGINE || "groq").toLowerCase();
  if (engine === "claude") return aiClassifyBatch(emails);
  return groqClassifyBatch(emails);
}