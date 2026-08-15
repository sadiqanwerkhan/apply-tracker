// Shared classification contract used by BOTH the Claude classifier (aiClassify.ts)
// and the free Groq classifier (groqClassify.ts). Keeping the rules and the
// parsing here means both engines behave identically — same categories, same
// strictness, same output shape — so switching engines never changes the meaning
// of a classification, only which model computes it.

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

export const VALID_STAGES: Stage[] = [
  "applied", "screening", "assessment", "interview", "offer", "rejected", "update",
];

export function stageToStatus(stage: Stage): AiStatus {
  if (stage === "rejected") return "Rejected";
  if (stage === "screening" || stage === "assessment" || stage === "interview" || stage === "offer") {
    return "Advancing";
  }
  return "Pending";
}

export function coerceStage(v: unknown): Stage {
  const s = String(v ?? "").toLowerCase().trim();
  const found = VALID_STAGES.find((stage) => s.includes(stage));
  return found ?? "update";
}

export function cleanStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  const low = s.toLowerCase();
  if (!s || low === "null" || low === "unknown" || low === "n/a" || low === "none") return null;
  return s;
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) : s;
}

// The classification rules — IDENTICAL for every engine. This is the strict
// ruleset (originally written for Claude) that reliably rejects non-application
// emails (newsletters, job alerts, course emails, service notifications, etc.).
export const SYSTEM_INSTRUCTIONS = `You are analyzing emails from a job seeker's inbox. For EACH email the user sends, return a JSON object with these fields:

- "promotional": true if the email is NOT a response to a specific job application this person submitted. This includes: newsletters, job alerts, job digests, marketing/promotional emails, job-board recommendations, course/learning platform emails (e.g. Coursera, Udemy), product/newsletter emails (e.g. Beehiiv, Substack), AND service/system notifications (e.g. from GitHub, GitLab, Vercel, Google, Slack, cloud providers), AND privacy/legal/GDPR/consent/data-retention/compliance notifications. Set true for any of these. Set false ONLY for a genuine application-related email: an application confirmation, a recruiter contacting them about a specific application, an interview invite, an assessment, a rejection, or an offer.
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

// Shared parser: turn the model's raw JSON text into validated AiResults.
// Used identically by both engines so output is guaranteed consistent.
export function parseClassifyResponse(text: string, expectedCount: number): (AiResult | null)[] {
  const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  let arr: unknown;
  try {
    arr = JSON.parse(clean);
  } catch {
    return Array(expectedCount).fill(null);
  }
  if (!Array.isArray(arr) || arr.length !== expectedCount) {
    return Array(expectedCount).fill(null);
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
}

export function buildUserMessage(emails: { subject: string; body: string }[]): string {
  const list = emails
    .map((e, i) => `Email ${i + 1}:\nSubject: ${e.subject}\nBody: ${truncate(e.body, 1500)}`)
    .join("\n\n---\n\n");
  return `Classify the following ${emails.length} email(s). Return a JSON array of exactly ${emails.length} objects, one per email, in order.\n\n${list}`;
}