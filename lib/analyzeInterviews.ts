import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5-20251001";

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
  return client;
}

export type AnalyzeInput = {
  company: string;
  role: string;
  outcome: "rejected" | "positive" | "unknown";
  stages: { name: string; transcripts: { label: string | null; content: string }[] }[];
};

export async function analyzeInterviews(input: AnalyzeInput): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const blocks: string[] = [];
  for (const stage of input.stages) {
    for (const t of stage.transcripts) {
      if (!t.content.trim()) continue;
      const who = t.label ? ` (${t.label})` : "";
      blocks.push(`### Stage: ${stage.name}${who}\n${t.content.trim().slice(0, 6000)}`);
    }
  }
  if (blocks.length === 0) return null;

  const outcomeLine =
    input.outcome === "rejected"
      ? "The candidate was ultimately REJECTED for this role. Emphasize what likely went wrong and what to improve."
      : input.outcome === "positive"
      ? "The candidate advanced or was hired. Emphasize what worked, plus a few things to keep sharpening."
      : "The final outcome is unknown. Give balanced, constructive feedback.";

  const prompt = `You are an experienced interview coach reviewing a candidate's own interview transcripts for a single job application. ${outcomeLine}

Company: ${input.company}
Role: ${input.role || "(not specified)"}

Analyze ONLY the conversations in the transcripts below. Base every point strictly on what was actually said. Be honest, specific, and constructive.

IMPORTANT:
- Analyze HOW the candidate communicated and answered. You are NOT told the interviewers' private reasons, so never claim to know exactly why they decided as they did. Frame observations as "answers on X were vague", not "they rejected you because of X".
- Point to concrete moments from the transcripts. Do not invent anything not present.
- Keep each bullet to one or two sentences, plain and specific.

Return ONLY a JSON object (no markdown, no code fences, no extra text) with this exact shape:
{
  "headline": "one concise sentence summarizing the overall takeaway",
  "sections": [
    { "type": "strengths", "points": ["...", "..."] },
    { "type": "struggles", "points": ["...", "..."] },
    { "type": "unsure", "points": ["...", "..."] },
    { "type": "patterns", "points": ["...", "..."] },
    { "type": "actions", "points": ["...", "..."] }
  ]
}

Rules:
- Include all five section types, in that order.
- "strengths" = moments/stages where the candidate came across well.
- "struggles" = stages/topics where answers were weak or shallow.
- "unsure" = specific questions the candidate did not know or answered poorly.
- "patterns" = recurring habits or mistakes across rounds.
- "actions" = concrete, specific things to do differently next time.
- Each "points" array has 2-4 short bullet strings. If a section genuinely has nothing to say, use [].

TRANSCRIPTS:

${blocks.join("\n\n---\n\n")}`;

  try {
    const message = await getClient().messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    const block = message.content[0];
    const text = block.type === "text" ? block.text.trim() : "";
    const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    try {
      const parsed = JSON.parse(clean);
      if (parsed && Array.isArray(parsed.sections)) {
        return JSON.stringify(parsed);
      }
    } catch {
      // not JSON — fall through to raw text
    }
    return text || null;
  } catch (err) {
    console.error("Interview analysis error:", err);
    return null;
  }
}