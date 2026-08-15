import { llmComplete, parseJsonLoose } from "./llm";

export type PrepInput = {
  company: string;
  role: string;
  stageName: string;              // the upcoming round we're prepping for
  stageType: string;
  jobDescription: string | null;  // optional
  priorTranscripts: { stageName: string; label: string | null; content: string }[];
};

export type Prep = {
  encouragement?: string;         // shown especially for the first round
  focusAreas?: string[];          // what to cover / prepare
  questionsToAsk?: string[];      // smart questions for the candidate to ask
  watchOuts?: string[];           // things to be careful about, from prior rounds
};

const TYPE_GUIDANCE: Record<string, string> = {
    phone_screen: "an initial recruiter/phone screen — expect background, motivation, availability, and high-level fit questions. Keep prep light and behavioral, not deeply technical.",
    technical: "a technical interview — expect coding, technical depth, and problem-solving. Focus prep on relevant technical topics and practice areas.",
    system_design: "a system-design interview — expect architecture, scalability, trade-offs, and high-level design. Focus prep on design fundamentals and structured approaches.",
    cultural_fit: "a cultural-fit / values interview — expect behavioral questions, teamwork, and alignment with company values. Focus prep on stories (STAR) and values, NOT technical topics.",
    hr: "an HR interview — expect compensation, logistics, notice period, and general fit. Keep prep practical and non-technical.",
    final: "a final / founder / senior-leadership round — expect big-picture motivation, long-term fit, and high-level discussion. Prep should be strategic and thoughtful.",
    other: "a general interview round.",
  };

export async function generatePrep(input: PrepInput): Promise<Prep | null> {
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
Round type: This is ${TYPE_GUIDANCE[input.stageType] || TYPE_GUIDANCE.other}

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
- Tailor "focusAreas" and "questionsToAsk" to the round type above. For a cultural-fit or HR round, do NOT suggest technical topics; for a technical or system-design round, do NOT dwell on generic behavioral advice.

Respond with ONLY the JSON object — no markdown, no backticks, no preamble.`;

  const text = await llmComplete({ system: "You are a supportive interview coach who replies with only JSON.", user: prompt, maxTokens: 1024, json: true });
  return parseJsonLoose<Prep>(text);
}