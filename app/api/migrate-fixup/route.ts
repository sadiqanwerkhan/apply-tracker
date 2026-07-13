import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { normalizeCompanyKey, normalizeRoleKey } from "@/lib/aggregate";

// Re-port ManualOutcome + AppMerge using keys RE-DERIVED from company/role text,
// so stale stored keys don't matter. Also removes empty orphan Applications.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const [apps, manualOutcomes, merges] = await Promise.all([
    prisma.application.findMany({ where: { userId: user.id } }),
    prisma.manualOutcome.findMany({ where: { userId: user.id } }),
    prisma.appMerge.findMany({ where: { userId: user.id } }),
  ]);

  // index applications by RE-DERIVED key from their display text
  const byKey = new Map<string, string>();
  for (const a of apps) {
    byKey.set(`${normalizeCompanyKey(a.company)}::${normalizeRoleKey(a.role)}`, a.id);
  }
  // fallback: company-only (for when the role text differs)
  const byCompany = new Map<string, string[]>();
  for (const a of apps) {
    const ck = normalizeCompanyKey(a.company);
    if (!byCompany.has(ck)) byCompany.set(ck, []);
    byCompany.get(ck)!.push(a.id);
  }

  function findApp(company: string, role: string): string | null {
    const exact = byKey.get(`${normalizeCompanyKey(company)}::${normalizeRoleKey(role)}`);
    if (exact) return exact;
    const candidates = byCompany.get(normalizeCompanyKey(company)) || [];
    return candidates.length === 1 ? candidates[0] : null; // only if unambiguous
  }

  const outcomeResults: string[] = [];
  for (const m of manualOutcomes) {
    const appId = findApp(m.company, m.role);
    if (!appId) { outcomeResults.push(`NOT MATCHED: ${m.company} / ${m.role}`); continue; }
    await prisma.application.update({
      where: { id: appId },
      data: { manualStatus: m.status, manualChannel: m.channel, manualReason: m.reason, manualDate: m.date },
    });
    outcomeResults.push(`ported: ${m.company} / ${m.role || "(no role)"} -> ${m.status}`);
  }

  const mergeResults: string[] = [];
  const byGroup = new Map<string, typeof merges>();
  for (const m of merges) {
    if (!byGroup.has(m.groupId)) byGroup.set(m.groupId, []);
    byGroup.get(m.groupId)!.push(m);
  }
  for (const members of byGroup.values()) {
    const primary = members.find((m) => m.isPrimary) || members[0];
    const primaryAppId = findApp(primary.company, primary.role);
    if (!primaryAppId) { mergeResults.push(`NO PRIMARY: ${primary.company}`); continue; }
    for (const m of members) {
      if (m.id === primary.id) continue;
      const appId = findApp(m.company, m.role);
      if (!appId || appId === primaryAppId) { mergeResults.push(`NOT MATCHED: ${m.company}`); continue; }
      await prisma.application.update({ where: { id: appId }, data: { mergedIntoId: primaryAppId } });
      mergeResults.push(`merged: ${m.company} -> ${primary.company}`);
    }
  }

  // clean up empty orphan Applications (no emails, no transcripts, no analysis)
  const deleted: string[] = [];
  for (const a of apps) {
    const emailCount = await prisma.email.count({ where: { applicationId: a.id } });
    if (emailCount > 0) continue;
    const stageIds = (await prisma.stage.findMany({ where: { applicationId: a.id }, select: { id: true } })).map((s) => s.id);
    const tCount = stageIds.length
      ? await prisma.transcript.count({ where: { stageId: { in: stageIds } } })
      : 0;
    if (tCount > 0 || a.analysis) continue;
    await prisma.application.delete({ where: { id: a.id } });
    deleted.push(`${a.company} / ${a.role}`);
  }

  return NextResponse.json({ ok: true, outcomeResults, mergeResults, deletedEmptyApps: deleted });
}