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

  // build the transcript context, capped so we don't send an enormous prompt
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
      ? "The candidate was ultimately REJECTED for this role. Focus on what likely went wrong and what to improve."
      : input.outcome === "positive"
      ? "The candidate advanced or was hired for this role. Focus on what worked well, plus a few things to keep sharpening."
      : "The final outcome is unknown. Give balanced, constructive feedback.";

  const prompt = `You are an experienced interview coach reviewing a candidate's own interview transcripts for a single job application. ${outcomeLine}

Company: ${input.company}
Role: ${input.role || "(not specified)"}

Analyze ONLY the conversations in the transcripts below. Base every point strictly on what was actually said. Be honest and specific but constructive.

IMPORTANT rules:
- Analyze HOW the candidate communicated and answered — you are NOT told the interviewers' private reasons, so never claim to know exactly why they decided as they did. Frame observations as "in the technical round, answers on X were vague" — not "they rejected you because of X".
- Point to concrete moments from the transcripts.
- Do not invent details that aren't in the transcripts.

Return your analysis as plain text with these short sections (use these exact headers, each followed by 2-4 concise bullet points starting with "- "):

Stages where you seemed strongest:
Stages where you seemed to struggle:
Questions you appeared unsure of or answered weakly:
Recurring patterns or mistakes across rounds:
Concrete things to do differently next time:

TRANSCRIPTS:

${blocks.join("\n\n---\n\n")}`;

  try {
    const message = await getClient().messages.create({
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    const block = message.content[0];
    const text = block.type === "text" ? block.text.trim() : "";
    return text || null;
  } catch (err) {
    console.error("Interview analysis error:", err);
    return null;
  }
}