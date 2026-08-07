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

// The classification RULES never change between calls, so they live in a single
// constant that we send as a cached `system` block. Only the email list varies
// per call. Note: Anthropic prompt caching has a per-model minimum cacheable
// length; if this block is below it for Haiku, cache_control is simply ignored
// (no error, no benefit). The bigger cost wins live in scanChunk — a per-user
// classification cache and skipping the AI when a deterministic keyword read is
// already decisive — so treat this as a cheap, safe optimization, not the main
// lever.
const SYSTEM_INSTRUCTIONS = `You are analyzing emails from a job seeker's inbox. For EACH email the user sends, return a JSON object with these fields:

- "promotional": true if the email is NOT a response to a specific job application this person submitted. This includes: newsletters, job alerts, job digests, marketing/promotional emails, job-board recommendations, AND service/system notifications (e.g. from GitHub, GitLab, Vercel, Google, Slack, cloud providers), AND privacy/legal/GDPR/consent/data-retention/compliance notifications. Set true for any of these. Set false ONLY for a genuine application-related email: an application confirmation, a recruiter contacting them about a specific application, an interview invite, an assessment, a rejection, or an offer.
- "company": the name of the ACTUAL hiring company the email concerns. If the email comes from a job board (Indeed, LinkedIn, XING, StepStone, Glassdoor, Instaffo, etc.) but names the real employer, extract the REAL employer's name, not the platform's name. Use null if no specific employer can be determined.
- "role": the specific job title/position the email is about (e.g. "Senior Frontend Engineer"). IMPORTANT: calendar invitations and meeting subjects are NOT job titles — if the subject is a meeting name like "FE Technical Interview", "Sadiq <> Ben Interview", "Videocall", or "Intro Call", do NOT use it as the role. Extract the actual job title only if it genuinely appears. Use null if no real job title is present.
- "stage": the hiring stage. Be STRICT and conservative — when unsure, choose the EARLIER stage. Do not assume progress the email does not explicitly show. Choose exactly one of:
    - "applied": the email only acknowledges or confirms that an application was received (e.g. "thank you for applying", "we have received your application", "your application to join X"). This is the default for any confirmation/acknowledgment, even a warm friendly one.
    - "screening": ONLY if the email explicitly invites the candidate to an initial recruiter/HR call or asks them to schedule/pick a time for an intro or phone conversation.
    - "assessment": ONLY if the email asks the candidate to complete a specific coding test, take-home task, or online assessment.
    - "interview": ONLY if the email explicitly invites the candidate to, or schedules, a technical, onsite, or final-round interview.
    - "offer": ONLY if a job offer is actually being extended.
    - "rejected": the company declined the application or is not moving forward with the candidate.
    - "update": a genuine application-related email that does not fit any category above.
- "reason": ONLY when stage is "rejected", a very short one-sentence summary of WHY the candidate was rejected, based strictly on what the email actually says. If the rejection gives no specific reason, use "No specific reason given". For every non-rejected email, use null.
CRITICAL — distinguish an APPLICATION from RECRUITER OUTREACH:
- If a recruiter is PITCHING a job to the candidate (unsolicited: "I have an opportunity", "could this be a next step for you", "our partner is hiring", contains an unsubscribe link, or comes via a sourcing platform), set "promotional": true. The candidate did NOT apply.
- Only treat an email as an application if it responds to something the CANDIDATE started: an application confirmation, an interview invitation for a role they applied to, a rejection, or an offer.

Return ONLY a JSON array with one object per email, in the same order as given. No explanation, no other text.`;

export async function aiClassifyBatch(
  emails: { subject: string; body: string }[]
): Promise<(AiResult | null)[]> {
  if (emails.length === 0) return [];
  if (!process.env.ANTHROPIC_API_KEY) return emails.map(() => null);

  const list = emails
    .map((e, i) => `Email ${i + 1}:\nSubject: ${e.subject}\nBody: ${truncate(e.body, 1500)}`)
    .join("\n\n---\n\n");

  const userMessage = `Classify the following ${emails.length} email(s). Return a JSON array of exactly ${emails.length} objects, one per email, in order.\n\n${list}`;

  try {
    const message = await getClient().messages.create({
      model: MODEL,
      max_tokens: 2500,
      // Static rules -> cached system block. Variable content -> user turn.
      system: [
        {
          type: "text",
          text: SYSTEM_INSTRUCTIONS,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
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