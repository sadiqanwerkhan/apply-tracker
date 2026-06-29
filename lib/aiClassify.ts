import Anthropic from "@anthropic-ai/sdk";

// Claude model names are stable. If you ever get a "model not found" error,
// change ONLY this line. Haiku is the fast, cheap model — ideal for classification.
const MODEL = "claude-haiku-4-5-20251001";

export type Stage =
  | "applied"
  | "screening"
  | "assessment"
  | "interview"
  | "offer"
  | "rejected"
  | "update";

export type AiStatus = "Rejected" | "Advancing" | "Pending";

export type AiResult = {
  promotional: boolean;
  company: string | null;
  role: string | null;
  stage: Stage;
};

const VALID_STAGES: Stage[] = [
  "applied", "screening", "assessment", "interview", "offer", "rejected", "update",
];

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
  return client;
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) : s;
}

/** Map a hiring stage to the coarse status used by the filter pills. */
export function stageToStatus(stage: Stage): AiStatus {
  if (stage === "rejected") return "Rejected";
  if (stage === "screening" || stage === "assessment" || stage === "interview" || stage === "offer") {
    return "Advancing";
  }
  return "Pending"; // applied, update
}

function coerceStage(v: unknown): Stage {
  const s = String(v ?? "").toLowerCase().trim();
  const found = VALID_STAGES.find((stage) => s.includes(stage));
  return found ?? "update";
}

function cleanStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  const low = s.toLowerCase();
  if (!s || low === "null" || low === "unknown" || low === "n/a" || low === "none") return null;
  return s;
}

/**
 * Analyze a batch of emails in ONE API call.
 * For each email returns { promotional, company, role, stage }, in order.
 * Returns null for an item (or all) if the response can't be parsed —
 * the caller then falls back to keyword/regex handling.
 */
export async function aiClassifyBatch(
  emails: { subject: string; body: string }[]
): Promise<(AiResult | null)[]> {
  if (emails.length === 0) return [];
  if (!process.env.ANTHROPIC_API_KEY) return emails.map(() => null);

  const list = emails
    .map((e, i) => `Email ${i + 1}:\nSubject: ${e.subject}\nBody: ${truncate(e.body, 1500)}`)
    .join("\n\n---\n\n");

  const prompt = `You are analyzing emails from a job seeker's inbox. For EACH email below, return a JSON object with these fields:

- "promotional": true if the email is a newsletter, job alert, job digest, marketing/promotional email, or a job-board recommendation of jobs to apply to — i.e. NOT a response to a specific application this person actually submitted. false if it is a genuine application-related email (an application confirmation, a recruiter contacting them about a specific application, an interview invite, an assessment, a rejection, or an offer).
- "company": the name of the ACTUAL hiring company the email concerns. If the email comes from a job board (Indeed, LinkedIn, XING, StepStone, Glassdoor, Instaffo, etc.) but names the real employer, extract the REAL employer's name, not the platform's name. Use null if no specific employer can be determined.
- "role": the specific job title/position the email is about (e.g. "Senior Frontend Engineer"). Use null if not determinable.
- "stage": the hiring stage, exactly one of: "applied", "screening", "assessment", "interview", "offer", "rejected", "update". Use "update" if unclear.

Return ONLY a JSON array of exactly ${emails.length} objects, one per email in order. No explanation, no other text.

${list}`;

  try {
    const message = await getClient().messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    const text = block.type === "text" ? block.text.trim() : "";
    const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const arr = JSON.parse(clean);

    if (!Array.isArray(arr) || arr.length !== emails.length) {
      return emails.map(() => null);
    }

    return arr.map((o: unknown) => {
      if (o === null || typeof o !== "object") return null;
      const obj = o as Record<string, unknown>;
      return {
        promotional: obj.promotional === true,
        company: cleanStr(obj.company),
        role: cleanStr(obj.role),
        stage: coerceStage(obj.stage),
      } as AiResult;
    });
  } catch (err) {
    console.error("AI classify error:", err);
    return emails.map(() => null);
  }
}