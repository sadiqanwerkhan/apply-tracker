import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { normalizeCompanyKey, normalizeRoleKey, companyKeysMatch } from "@/lib/aggregate";

// ONE-TIME: fold every role-less Application into the company's nearest
// role-bearing Application (by date). Transcripts/analysis are preserved.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const apps = await prisma.application.findMany({
    where: { userId: user.id },
    include: { emails: { select: { date: true } }, stages: { select: { id: true } } },
  });

  const report: string[] = [];

  for (const a of apps) {
    if (normalizeRoleKey(a.role) !== "") continue;           // has a role → keep
    if (a.analysis || a.stages.length > 0) continue;         // has user data → keep, don't risk it

    const ck = normalizeCompanyKey(a.company);
    const targets = apps.filter(
      (t) => t.id !== a.id && companyKeysMatch(normalizeCompanyKey(t.company), ck) && normalizeRoleKey(t.role) !== ""
    );
    if (targets.length === 0) continue;                      // only app for this company → keep

    const myDates = a.emails.map((e) => e.date.getTime());
    const avg = myDates.length ? myDates.reduce((s, d) => s + d, 0) / myDates.length : Date.now();

    let best = targets[0];
    let bestDist = Infinity;
    for (const t of targets) {
      const ds = t.emails.map((e) => e.date.getTime());
      const d = ds.length ? Math.min(...ds.map((x) => Math.abs(x - avg))) : Infinity;
      if (d < bestDist) { bestDist = d; best = t; }
    }

    await prisma.email.updateMany({ where: { applicationId: a.id }, data: { applicationId: best.id } });
    await prisma.application.updateMany({ where: { mergedIntoId: a.id }, data: { mergedIntoId: best.id } });
    await prisma.application.delete({ where: { id: a.id } });

    report.push(`${a.company} (no role, ${a.emails.length} emails) → ${best.company} / ${best.role}`);
  }

  return NextResponse.json({ ok: true, folded: report });
}