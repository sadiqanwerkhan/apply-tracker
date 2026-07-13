import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { normalizeCompanyKey, normalizeRoleKey } from "@/lib/aggregate";

// ONE-TIME migration: link every Email to a stable Application, and port
// ManualOutcome + AppMerge onto Applications. Visit once, then delete this file.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const [emails, existingApps, manualOutcomes, merges] = await Promise.all([
    prisma.email.findMany({ where: { userId: user.id } }),
    prisma.application.findMany({ where: { userId: user.id } }),
    prisma.manualOutcome.findMany({ where: { userId: user.id } }),
    prisma.appMerge.findMany({ where: { userId: user.id } }),
  ]);

  type E = (typeof emails)[number];

  const pickCompany = (items: E[]) =>
    items.reduce((best, i) => (i.company.length > best.length ? i.company : best), items[0].company);
  const pickRole = (items: E[]) =>
    items.reduce((best, i) => (i.role && i.role.length > best.length ? i.role : best), "");

  // 1) group emails exactly the way the dashboard groups them today
  const byCompany: Record<string, E[]> = {};
  for (const e of emails) {
    const ck = normalizeCompanyKey(e.company);
    (byCompany[ck] ||= []).push(e);
  }

  const groups: { companyKey: string; roleKey: string; company: string; role: string; emails: E[] }[] = [];
  for (const [ck, items] of Object.entries(byCompany)) {
    const withRole = items.filter((e) => normalizeRoleKey(e.role));
    const roleless = items.filter((e) => !normalizeRoleKey(e.role));
    const byRole: Record<string, E[]> = {};
    for (const e of withRole) {
      const rk = normalizeRoleKey(e.role);
      (byRole[rk] ||= []).push(e);
    }
    const roleKeys = Object.keys(byRole);

    if (roleKeys.length === 0) {
      if (items.length) groups.push({ companyKey: ck, roleKey: "", company: pickCompany(items), role: "", emails: items });
    } else if (roleKeys.length === 1) {
      const all = [...byRole[roleKeys[0]], ...roleless];
      groups.push({ companyKey: ck, roleKey: roleKeys[0], company: pickCompany(all), role: pickRole(all), emails: all });
    } else {
      for (const rl of roleless) {
        let best = roleKeys[0];
        let bestDist = Infinity;
        for (const rk of roleKeys) {
          const d = Math.min(...byRole[rk].map((e) => Math.abs(e.date.getTime() - rl.date.getTime())));
          if (d < bestDist) { bestDist = d; best = rk; }
        }
        byRole[best].push(rl);
      }
      for (const rk of roleKeys) {
        groups.push({ companyKey: ck, roleKey: rk, company: pickCompany(byRole[rk]), role: pickRole(byRole[rk]), emails: byRole[rk] });
      }
    }
  }

  // 2) reuse existing Application rows where keys match (this preserves transcripts)
  const usedAppIds = new Set<string>();
  const groupToApp = new Map<string, string>();

  for (const g of groups) {
    const match = existingApps.find(
      (a) => a.companyKey === g.companyKey && a.roleKey === g.roleKey && !usedAppIds.has(a.id)
    );

    let appId: string;
    if (match) {
      appId = match.id;
      await prisma.application.update({ where: { id: appId }, data: { company: g.company, role: g.role } });
    } else {
      const created = await prisma.application.create({
        data: { userId: user.id, companyKey: g.companyKey, roleKey: g.roleKey, company: g.company, role: g.role },
      });
      appId = created.id;
    }
    usedAppIds.add(appId);
    groupToApp.set(`${g.companyKey}::${g.roleKey}`, appId);

    await prisma.email.updateMany({
      where: { userId: user.id, id: { in: g.emails.map((e) => e.id) } },
      data: { applicationId: appId },
    });
  }

  // 3) port manual outcomes onto Applications
  let outcomesPorted = 0;
  for (const m of manualOutcomes) {
    const appId = groupToApp.get(`${m.companyKey}::${m.roleKey}`);
    if (!appId) continue;
    await prisma.application.update({
      where: { id: appId },
      data: { manualStatus: m.status, manualChannel: m.channel, manualReason: m.reason, manualDate: m.date },
    });
    outcomesPorted++;
  }

  // 4) port merges onto mergedIntoId
  let mergesPorted = 0;
  const byGroup = new Map<string, typeof merges>();
  for (const m of merges) {
    if (!byGroup.has(m.groupId)) byGroup.set(m.groupId, []);
    byGroup.get(m.groupId)!.push(m);
  }
  for (const members of byGroup.values()) {
    const primary = members.find((m) => m.isPrimary) || members[0];
    const primaryAppId = groupToApp.get(`${primary.companyKey}::${primary.roleKey}`);
    if (!primaryAppId) continue;
    for (const m of members) {
      if (m.id === primary.id) continue;
      const appId = groupToApp.get(`${m.companyKey}::${m.roleKey}`);
      if (!appId || appId === primaryAppId) continue;
      await prisma.application.update({ where: { id: appId }, data: { mergedIntoId: primaryAppId } });
      mergesPorted++;
    }
  }

  const unlinked = await prisma.email.count({ where: { userId: user.id, applicationId: null } });
  const orphanApps = existingApps.filter((a) => !usedAppIds.has(a.id));

  return NextResponse.json({
    ok: true,
    emails: emails.length,
    applicationsLinked: groups.length,
    emailsStillUnlinked: unlinked,
    outcomesPorted,
    mergesPorted,
    orphanApplicationsKept: orphanApps.map((a) => ({ id: a.id, company: a.company, role: a.role })),
  });
}