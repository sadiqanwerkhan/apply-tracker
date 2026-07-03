import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5-20251001";

export type Stage =
  | "applied" | "screening" | "assessment" | "interview" | "offer" | "rejected" | "update";

export type AiStatus = "Rejected" | "Advancing" | "Pending";

export type AiResult = {
  promotional: boolean;
  company: string | null;
  role: string | null;
  stage: Stage;
  reason: string | null;
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

export function stageToStatus(stage: Stage): AiStatus {
  if (stage === "rejected") return "Rejected";
  if (stage === "screening" || stage === "assessment" || stage === "interview" || stage === "offer") {
    return "Advancing";
  }
  return "Pending";
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

export async function aiClassifyBatch(
  emails: { subject: string; body: string }[]
): Promise<(AiResult | null)[]> {
  if (emails.length === 0) return [];
  if (!process.env.ANTHROPIC_API_KEY) return emails.map(() => null);

  const list = emails
    .map((e, i) => `Email ${i + 1}:\nSubject: ${e.subject}\nBody: ${truncate(e.body, 1500)}`)
    .join("\n\n---\n\n");

  const prompt = `You are analyzing emails from a job seeker's inbox. For EACH email below, return a JSON object with these fields:

- "promotional": true if the email is NOT a response to a specific job application this person submitted. This includes: newsletters, job alerts, job digests, marketing/promotional emails, job-board recommendations, AND service/system notifications (e.g. from GitHub, GitLab, Vercel, Google, Slack, cloud providers), AND privacy/legal/GDPR/consent/data-retention/compliance notifications. Set true for any of these. Set false ONLY for a genuine application-related email: an application confirmation, a recruiter contacting them about a specific application, an interview invite, an assessment, a rejection, or an offer.
- "company": the name of the ACTUAL hiring company the email concerns. If the email comes from a job board (Indeed, LinkedIn, XING, StepStone, Glassdoor, Instaffo, etc.) but names the real employer, extract the REAL employer's name, not the platform's name. Use null if no specific employer can be determined.
- "role": the specific job title/position the email is about (e.g. "Senior Frontend Engineer"). Use null if not determinable.
- "stage": the hiring stage. Be STRICT and conservative — when unsure, choose the EARLIER stage. Do not assume progress the email does not explicitly show. Choose exactly one of:
    - "applied": the email only acknowledges or confirms that an application was received (e.g. "thank you for applying", "we have received your application", "your application to join X"). This is the default for any confirmation/acknowledgment, even a warm friendly one.
    - "screening": ONLY if the email explicitly invites the candidate to an initial recruiter/HR call or asks them to schedule/pick a time for an intro or phone conversation.
    - "assessment": ONLY if the email asks the candidate to complete a specific coding test, take-home task, or online assessment.
    - "interview": ONLY if the email explicitly invites the candidate to, or schedules, a technical, onsite, or final-round interview.
    - "offer": ONLY if a job offer is actually being extended.
    - "rejected": the company declined the application or is not moving forward with the candidate.
    - "update": a genuine application-related email that does not fit any category above.
- "reason": ONLY when stage is "rejected", a very short one-sentence summary of WHY the candidate was rejected, based strictly on what the email actually says. If the rejection gives no specific reason, use "No specific reason given". For every non-rejected email, use null.

Return ONLY a JSON array of exactly ${emails.length} objects, one per email in order. No explanation, no other text.

${list}`;

  try {
    const message = await getClient().messages.create({
      model: MODEL,
      max_tokens: 2500,
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
      const stage = coerceStage(obj.stage);
      return {
        promotional: obj.promotional === true,
        company: cleanStr(obj.company),
        role: cleanStr(obj.role),
        stage,
        reason: stage === "rejected" ? cleanStr(obj.reason) : null,
      } as AiResult;
    });
  } catch (err) {
    console.error("AI classify error:", err);
    return emails.map(() => null);
  }
}