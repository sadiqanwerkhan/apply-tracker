import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5-20251001";

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
  return client;
}

export type InsightsInput = {
  company: string;
  role: string;
  stages: { name: string; transcripts: { label: string | null; content: string }[] }[];
};

// The structured facts we accumulate about an application across its interview
// rounds. Every field optional — the model fills what the transcripts support
// and omits the rest. It must never invent details.
export type Insights = {
  techStack?: string[];
  teamSize?: string;
  teamStructure?: string;
  product?: string;
  payRange?: string;
  nextSteps?: string;
  notes?: string[];
};

export async function extractInsights(input: InsightsInput): Promise<Insights | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const blocks: string[] = [];
  for (const stage of input.stages) {
    for (const t of stage.transcripts) {
      if (!t.content.trim()) continue;
      const who = t.label ? ` (${t.label})` : "";
      blocks.push(`### Round: ${stage.name}${who}\n${t.content.trim()}`);
    }
  }
  if (blocks.length === 0) return null;

  const prompt = `You are analyzing interview transcripts for a job application.
Company: ${input.company}
Role: ${input.role}

From the transcripts below, extract ONLY facts that are actually stated or clearly implied. Do NOT guess or invent. If a fact isn't present, omit that field entirely.

Return a JSON object with these optional fields:
- "techStack": array of technologies/languages/tools mentioned as used by the team
- "teamSize": short string, e.g. "~8 engineers"
- "teamStructure": short string describing how the team/org is arranged
- "product": short string describing what the company/team builds
- "payRange": short string if compensation was discussed, else omit
- "nextSteps": short string describing what happens next in the process
- "notes": array of other short, useful factual observations (e.g. "remote-first", "uses Linear")

Respond with ONLY the JSON object — no markdown, no backticks, no preamble.

Transcripts:
${blocks.join("\n\n")}`;

  try {
    const res = await getClient().messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = res.content
      .filter((b) => b.type === "text")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b) => (b as any).text)
      .join("")
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    const parsed = JSON.parse(text) as Insights;
    return parsed;
  } catch (err) {
    console.error("extractInsights failed:", err);
    return null;
  }
}