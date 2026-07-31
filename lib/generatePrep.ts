import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5-20251001";

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
  return client;
}

export type PrepInput = {
  company: string;
  role: string;
  stageName: string;              // the upcoming round we're prepping for
  jobDescription: string | null;  // optional
  priorTranscripts: { stageName: string; label: string | null; content: string }[];
};

export type Prep = {
  encouragement?: string;         // shown especially for the first round
  focusAreas?: string[];          // what to cover / prepare
  questionsToAsk?: string[];      // smart questions for the candidate to ask
  watchOuts?: string[];           // things to be careful about, from prior rounds
};

export async function generatePrep(input: PrepInput): Promise<Prep | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const hasPrior = input.priorTranscripts.some((t) => t.content.trim());
  const hasJD = !!(input.jobDescription && input.jobDescription.trim());

  const priorBlock = hasPrior
    ? input.priorTranscripts
        .filter((t) => t.content.trim())
        .map((t) => `### Previous round: ${t.stageName}${t.label ? ` (${t.label})` : ""}\n${t.content.trim()}`)
        .join("\n\n")
    : "(no previous interview rounds yet — this is the first)";

  const jdBlock = hasJD ? input.jobDescription!.trim() : "(no job description provided)";

  const prompt = `You are a supportive interview coach preparing a candidate for an upcoming interview round.

Company: ${input.company}
Role: ${input.role}
Upcoming round: ${input.stageName}

Job description:
${jdBlock}

Previous interview rounds (transcripts):
${priorBlock}

Prepare the candidate for the "${input.stageName}" round. Base your advice ONLY on the material above — do not invent company specifics that aren't supported.

Return a JSON object with these optional fields:
- "encouragement": one short encouraging sentence (especially important if this is the first round with no prior transcripts)
- "focusAreas": array of concrete topics/skills to prepare or review for this round (from the JD and/or what previous rounds suggest is coming next)
- "questionsToAsk": array of smart, specific questions the candidate could ask the interviewer in this round
- "watchOuts": array of things to be careful about, drawn from previous rounds (e.g. a topic they struggled with, or a follow-up the interviewer hinted at). Omit if there are no previous rounds.

Guidance:
- If there is no job description AND no previous rounds, keep it light: a warm "encouragement" plus a couple of general "focusAreas", and note that adding the job description would sharpen this.
- Keep every point short and actionable.

Respond with ONLY the JSON object — no markdown, no backticks, no preamble.`;

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

    return JSON.parse(text) as Prep;
  } catch (err) {
    console.error("generatePrep failed:", err);
    return null;
  }
}