import { SKILL_KEYWORDS } from "./skillKeywords";
import type { ExtractedSignal } from "./extractSkills";
import { llmComplete } from "../llm";

// The AI may ONLY return skills from this fixed list — the same canonical names
// the keyword layer uses. This keeps skills consistent across both layers and
// stops the model inventing new/duplicate skill names. This "constrain the
// output to a known set" idea is the core of reliable AI extraction.
const ALLOWED_SKILLS = SKILL_KEYWORDS.map((k) => k.canonical);
const ALLOWED_SET = new Set(ALLOWED_SKILLS);

const SYSTEM = `You map interview-feedback sentences to a fixed list of skills.

You will get a numbered list of short sentences, each already tagged as "strong" (the candidate did well) or "weak" (the candidate struggled).

For EACH sentence, decide which skill(s) from the ALLOWED LIST it is about — based on MEANING, even when the skill name isn't written. Example: "couldn't explain how the component re-rendered when state changed" is about React.

ALLOWED SKILLS (use these exact names, nothing else):
${ALLOWED_SKILLS.join(", ")}

Rules:
- Only use names from the ALLOWED list. Never invent a skill.
- If a sentence maps to no skill on the list, return an empty array for it.
- A sentence can map to more than one skill.
- Keep the sentence's given performance ("strong" or "weak").

Return ONLY a JSON array, one item per input sentence, in order:
[{ "skills": ["React"] }, { "skills": [] }, ...]
No other text.`;

/**
 * The AI fallback: takes the bullets the FREE keyword layer couldn't match and
 * asks Haiku to map them to known skills by meaning. Returns validated signals
 * tagged source: "ai". Fails safe — on any error or malformed output it returns
 * [] so the caller keeps the (already good) keyword results.
 */
export async function aiSkillFallback(
  unmatched: { text: string; performance: "strong" | "weak" }[]
): Promise<ExtractedSignal[]> {
  if (unmatched.length === 0) return [];
  if (!process.env.ANTHROPIC_API_KEY) return [];

  const list = unmatched
    .map((u, i) => `${i + 1}. [${u.performance}] ${u.text}`)
    .join("\n");

  const text = await llmComplete({ system: SYSTEM, user: list, maxTokens: 1000, json: true });
  if (!text) return [];
  const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  let arr: unknown;
  try {
    const parsed = JSON.parse(clean);
    // json mode may wrap the array in an object — unwrap a single array property.
    arr = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === "object" ? Object.values(parsed).find((v) => Array.isArray(v)) : null);
  } catch {
    return [];
  }
  if (!Array.isArray(arr) || arr.length !== unmatched.length) return [];

  try {

    const out: ExtractedSignal[] = [];
    const seen = new Set<string>(); // de-dupe skill+performance
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      const skills: unknown = item?.skills;
      if (!Array.isArray(skills)) continue;
      const performance = unmatched[i].performance;
      for (const raw of skills) {
        const skill = String(raw).trim();
        // VALIDATE: only accept skills from the allowed list. Anything the model
        // made up is discarded here.
        if (!ALLOWED_SET.has(skill)) continue;
        const key = `${skill}|${performance}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ skill, performance, source: "ai" });
      }
    }
    return out;
  } catch (err) {
    console.error("aiSkillFallback error (non-fatal):", err);
    return [];
  }
}