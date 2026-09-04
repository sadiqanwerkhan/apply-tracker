import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { checkLimit } from "@/lib/rateLimit";
import { llmComplete, parseJsonLoose } from "@/lib/llm";
import {
  lookupSkill, CATEGORY_ORDER, CATEGORY_MEANING, SkillCategory,
} from "@/lib/skills/skillKnowledge";

export const maxDuration = 30;

type Classified = { name: string; category: string; what: string; known: boolean };

// Split a pasted blob into individual skill tokens (commas, newlines, semicolons,
// bullets, slashes).
function splitSkills(input: string): string[] {
  return input
    .split(/[,\n;•|]/g)
    .map((s) => s.replace(/^[-*\s]+/, "").trim())
    .filter((s) => s.length > 0 && s.length < 60)
    .slice(0, 60); // cap
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const raw = typeof body?.skills === "string" ? body.skills : "";
  const tokens = splitSkills(raw);
  if (tokens.length === 0) return NextResponse.json({ error: "no_skills" }, { status: 400 });

  // Rate-limit the AI part (reuses existing limiter bucket).
  const limited = await checkLimit(user.id, "ask");
  if (limited) return NextResponse.json(limited, { status: 429 });

  // 1) FREE + INSTANT: categorize everything we know from the fixed mapping.
  const classified: Classified[] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    const hit = lookupSkill(t);
    if (hit) classified.push({ name: hit.name, category: hit.category, what: hit.what, known: true });
    else unknown.push(t);
  }

  // 2) AI ONLY FOR THE GAPS: categorize unknown skills. Constrained to our category
  //    list so results stay consistent. If AI fails, unknowns go to "Tools".
  if (unknown.length > 0) {
    const cats = CATEGORY_ORDER.join(", ");
    const prompt = `Categorize each developer skill below into EXACTLY one of these categories: ${cats}.
For each, also give a one-sentence plain-English explanation a beginner would understand.
Return ONLY a JSON array like [{"name":"...","category":"...","what":"..."}], same order, one per skill. No other text.

Skills:
${unknown.map((u) => `- ${u}`).join("\n")}`;
    const text = await llmComplete({ system: "You classify software developer skills accurately and explain them simply. Reply with only JSON.", user: prompt, maxTokens: 1200, json: true });
    const parsed = parseJsonLoose<{ name: string; category: string; what: string }[]>(text);
    const validCats = new Set<string>(CATEGORY_ORDER);
    if (Array.isArray(parsed)) {
      for (const p of parsed) {
        if (p && typeof p.name === "string") {
          classified.push({
            name: p.name,
            category: validCats.has(p.category) ? p.category : "Tools",
            what: typeof p.what === "string" ? p.what : "",
            known: false,
          });
        }
      }
    } else {
      // AI failed — still show the skills, bucketed as Tools.
      for (const u of unknown) classified.push({ name: u, category: "Tools", what: "", known: false });
    }
  }

  // 3) Group by category (in canonical order).
  const grouped: { category: string; meaning: string; skills: Classified[] }[] = [];
  for (const cat of CATEGORY_ORDER) {
    const inCat = classified.filter((c) => c.category === cat);
    if (inCat.length > 0) grouped.push({ category: cat, meaning: CATEGORY_MEANING[cat as SkillCategory], skills: inCat });
  }

  // 4) Encouraging "developer profile" insight via AI (kept positive + forward-looking).
  const catCounts = grouped.map((g) => `${g.category}: ${g.skills.map((s) => s.name).join(", ")}`).join("\n");
  let insight: string | null = null;
  const insightText = await llmComplete({
    system: "You are a supportive, honest career coach for developers. Be encouraging and specific. Never say the person is 'bad' at anything — frame everything as strengths and next steps to grow.",
    user: `Based on this developer's skills grouped by area, write a short (3-4 sentence) encouraging summary of what KIND of developer they appear to be (e.g. 'full-stack leaning frontend with strong AI tooling'). Mention their clear strengths, and gently suggest one area they could round out — as an opportunity, not a weakness.

${catCounts}`,
    maxTokens: 400,
  });
  if (insightText) insight = insightText.trim();

  return NextResponse.json({ grouped, insight, total: classified.length });
}