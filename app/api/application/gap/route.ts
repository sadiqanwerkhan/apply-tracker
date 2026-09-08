import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { checkLimit } from "@/lib/rateLimit";
import { llmComplete, parseJsonLoose } from "@/lib/llm";

export const maxDuration = 45;

type GapResult = {
  score: number;                 // 0-100 overall match
  summary: string;               // one honest, encouraging sentence
  matches: string[];             // what the candidate already brings
  gaps: { area: string; why: string; howToClose: string }[]; // missing, with next steps
};

// Build a compact text profile from the user's structured profile data, so the
// model reasons over the real "honest self" rather than a tailored CV.
function buildProfileText(p: {
  profile: { firstName?: string | null; lastName?: string | null; location?: string | null } | null;
  work: { title: string; company: string; description?: string | null; startDate?: string | null; endDate?: string | null; current?: boolean }[];
  education: { degree: string; major?: string | null; institution: string }[];
  skills: { name: string; group: string }[];
  languages: { name: string; level: string }[];
  certifications: { name: string; issuer?: string | null }[];
}): string {
  const lines: string[] = [];
  if (p.work.length) {
    lines.push("WORK EXPERIENCE:");
    for (const w of p.work) {
      const when = `${w.startDate || "?"}–${w.current ? "present" : w.endDate || "?"}`;
      lines.push(`- ${w.title} at ${w.company} (${when})`);
      if (w.description) lines.push(`  ${w.description}`);
    }
  }
  if (p.education.length) {
    lines.push("EDUCATION:");
    for (const e of p.education) lines.push(`- ${[e.degree, e.major].filter(Boolean).join(", ")} — ${e.institution}`);
  }
  if (p.skills.length) {
    const byGroup = (g: string) => p.skills.filter((s) => s.group === g).map((s) => s.name).join(", ");
    lines.push("SKILLS:");
    if (byGroup("language")) lines.push(`- Programming languages: ${byGroup("language")}`);
    if (byGroup("technology")) lines.push(`- Technologies: ${byGroup("technology")}`);
    if (byGroup("soft")) lines.push(`- Soft skills: ${byGroup("soft")}`);
  }
  if (p.languages.length) lines.push(`LANGUAGES: ${p.languages.map((l) => `${l.name} (${l.level})`).join(", ")}`);
  if (p.certifications.length) lines.push(`CERTIFICATIONS: ${p.certifications.map((c) => c.name).join(", ")}`);
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const applicationId = typeof body?.applicationId === "string" ? body.applicationId : "";
  if (!applicationId) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  // Application (with its job description), scoped to the user.
  const app = await prisma.application.findFirst({
    where: { id: applicationId, userId: user.id },
    select: { company: true, role: true, jobTitle: true, jobDescription: true },
  });
  if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!app.jobDescription || app.jobDescription.trim().length < 40) {
    return NextResponse.json({ error: "no_job_description" }, { status: 400 });
  }

  // Full profile.
  const [profile, work, education, skills, languages, certifications] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: user.id } }),
    prisma.workExperience.findMany({ where: { userId: user.id }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    prisma.education.findMany({ where: { userId: user.id }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    prisma.skill.findMany({ where: { userId: user.id }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    prisma.language.findMany({ where: { userId: user.id }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    prisma.certification.findMany({ where: { userId: user.id }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
  ]);

  const profileText = buildProfileText({ profile, work, education, skills, languages, certifications });
  if (profileText.trim().length < 30) {
    return NextResponse.json({ error: "empty_profile" }, { status: 400 });
  }

  const limited = await checkLimit(user.id, "ask");
  if (limited) return NextResponse.json(limited, { status: 429 });

  const prompt = `You are comparing a candidate's HONEST profile against a job description, to show them where they stand and how to close the gap. Be accurate and specific, but encouraging — frame gaps as concrete next steps, never as the person being inadequate.

Return ONLY a JSON object:
{
  "score": <integer 0-100, overall fit>,
  "summary": "<one honest, encouraging sentence about their fit>",
  "matches": ["<specific strength the candidate already has that this role needs>", ...],
  "gaps": [{"area": "<what's missing or light>", "why": "<why the role needs it, brief>", "howToClose": "<a concrete, achievable next step>"}, ...]
}
Keep matches and gaps to the most important 4-6 each. Base everything ONLY on the profile and job description below — do not invent experience the candidate doesn't list.

=== CANDIDATE PROFILE ===
${profileText.slice(0, 6000)}

=== JOB: ${[app.jobTitle, app.role, "at " + app.company].filter(Boolean).join(" ")} ===
${app.jobDescription.slice(0, 4000)}`;

  const text = await llmComplete({
    system: "You are a fair, encouraging technical recruiter who gives candidates an honest read on their fit for a role and actionable next steps. Reply with only JSON.",
    user: prompt,
    maxTokens: 1500,
    json: true,
  });
  const parsed = parseJsonLoose<GapResult>(text);
  if (!parsed || typeof parsed.score !== "number") {
    return NextResponse.json({ error: "analysis_failed" }, { status: 502 });
  }

  // Clamp + sanitize.
  const result: GapResult = {
    score: Math.max(0, Math.min(100, Math.round(parsed.score))),
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    matches: Array.isArray(parsed.matches) ? parsed.matches.filter((m) => typeof m === "string").slice(0, 8) : [],
    gaps: Array.isArray(parsed.gaps)
      ? parsed.gaps.filter((g) => g && typeof g.area === "string").map((g) => ({
          area: g.area, why: typeof g.why === "string" ? g.why : "", howToClose: typeof g.howToClose === "string" ? g.howToClose : "",
        })).slice(0, 8)
      : [],
  };
  return NextResponse.json({ result });
}