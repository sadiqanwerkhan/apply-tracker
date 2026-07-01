import { Row, TimelineEntry } from "@/lib/types";

export type EmailItem = {
  companyKey: string;
  company: string;
  role: string;
  sender: string;
  isAts: boolean;
  status: string;
  stage: string;
  date: number;
  subject: string;
  summary: string | null; // AI "why" (only set on rejection emails)
};

type Event = { date: number; stage: string; subject: string; summary: string };

// legal suffixes / noise that make the same company look different
const SUFFIXES = [
  "gmbh", "ag", "se", "kg", "kgaa", "ohg", "ug", "mbh", "co",
  "inc", "incorporated", "ltd", "limited", "llc", "llp", "lp", "plc",
  "corp", "corporation", "company", "group", "holding", "holdings",
  "technologies", "technology", "tech", "solutions", "software", "labs",
  "international", "global", "digital", "ventures", "studios", "studio",
];

function normalizeCompanyKey(company: string): string {
  let s = (company || "").toLowerCase().trim();
  s = s.replace(/\(.*?\)/g, " ");
  s = s.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const words = s.split(" ").filter(Boolean);
  while (words.length > 1 && SUFFIXES.includes(words[words.length - 1])) {
    words.pop();
  }
  s = words.join(" ");
  return s || (company || "").toLowerCase().trim();
}

// normalize a role into a grouping key: drop gender markers, parentheticals, punctuation
function normalizeRoleKey(role: string): string {
  let s = (role || "").toLowerCase();
  s = s.replace(/\(.*?\)/g, " "); // (all genders), (m/w/d), etc.
  s = s.replace(/\b(all genders|m\/w\/d|m\/f\/d|f\/m\/d|w\/m\/d|m\/w\/x|d\/m\/w|gn|div)\b/gi, " ");
  s = s.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Merge role keys where one is a prefix of another (handles the same application
 * being worded with extra trailing words across different emails). Returns a map
 * from each role key to a canonical group key.
 */
function canonicalRoleGroups(roleKeys: string[]): Map<string, string> {
  const sorted = [...new Set(roleKeys)].sort((a, b) => a.length - b.length);
  const canon = new Map<string, string>();
  for (const key of sorted) {
    let assigned: string | null = null;
    for (const [existing, c] of canon) {
      if (key === existing || key.startsWith(existing + " ")) { assigned = c; break; }
    }
    canon.set(key, assigned ?? key);
  }
  return canon;
}

// build one Row (one application) from a set of emails that belong together
function buildRow(emails: EmailItem[]): Row {
  let company = emails[0].company;
  let companyLen = company.length;
  let role = "";
  let roleLen = 0;
  const sender = emails[0].sender;
  const viaAts = emails[0].isAts;

  let firstSeen = emails[0].date;
  let lastSeen = emails[0].date;

  let hasReject = false, lastRejectDate: number | null = null, rejectSubject = "", rejectSummary = "";
  let hasAdvance = false, lastAdvanceDate: number | null = null, advanceSubject = "";

  const events: Event[] = [];

  for (const it of emails) {
    if (it.company.length > companyLen) { company = it.company; companyLen = it.company.length; }
    if (it.role && it.role.length > roleLen) { role = it.role; roleLen = it.role.length; }
    if (it.date < firstSeen) firstSeen = it.date;
    if (it.date > lastSeen) lastSeen = it.date;

    events.push({ date: it.date, stage: it.stage || "update", subject: it.subject, summary: it.summary || "" });

    if (it.status === "Rejected") {
      hasReject = true;
      if (!lastRejectDate || it.date > lastRejectDate) { lastRejectDate = it.date; rejectSubject = it.subject; rejectSummary = it.summary || ""; }
    } else if (it.status === "Advancing") {
      hasAdvance = true;
      if (!lastAdvanceDate || it.date > lastAdvanceDate) { lastAdvanceDate = it.date; advanceSubject = it.subject; }
    }
  }

  let status: string;
  if (hasReject && (!lastAdvanceDate || (lastRejectDate || 0) >= lastAdvanceDate)) status = "Rejected";
  else if (hasAdvance) status = "Advancing";
  else status = "Pending";

  const sorted = events.slice().sort((a, b) => a.date - b.date);
  const timeline: TimelineEntry[] = [];
  for (const ev of sorted) {
    const last = timeline[timeline.length - 1];
    if (last && last.stage === ev.stage) {
      if (!last.reason && ev.summary) last.reason = ev.summary;
      continue;
    }
    timeline.push({
      date: new Date(ev.date).toISOString().slice(0, 10),
      stage: ev.stage,
      subject: ev.subject,
      reason: ev.summary || undefined,
    });
  }
  const currentStage = sorted.length ? sorted[sorted.length - 1].stage : "update";

  const note = status === "Advancing" ? advanceSubject : status === "Rejected" ? rejectSubject : "";
  return {
    company,
    role: role || "",
    status,
    confidence: viaAts ? "Low" : "High",
    sender: viaAts ? sender : "",
    firstSeen: new Date(firstSeen).toISOString().slice(0, 10),
    lastSeen: new Date(lastSeen).toISOString().slice(0, 10),
    note,
    currentStage,
    timeline,
    rejectionReason: status === "Rejected" ? rejectSummary : "",
  };
}

/**
 * Group emails into applications. An application is a (company + role) pair,
 * so two different roles at the same company become two separate rows.
 */
export function aggregateEmails(items: EmailItem[]): Row[] {
  // 1) group by company
  const byCompany: Record<string, EmailItem[]> = {};
  for (const it of items) {
    const ck = it.companyKey.startsWith("role:") ? it.companyKey : normalizeCompanyKey(it.company);
    (byCompany[ck] ||= []).push(it);
  }

  const applications: EmailItem[][] = [];

  for (const companyItems of Object.values(byCompany)) {
    const withRole = companyItems.filter((it) => normalizeRoleKey(it.role));
    const roleless = companyItems.filter((it) => !normalizeRoleKey(it.role));

    // group role-bearing emails by canonical role
    const canon = canonicalRoleGroups(withRole.map((it) => normalizeRoleKey(it.role)));
    const groups: Record<string, EmailItem[]> = {};
    for (const it of withRole) {
      const g = canon.get(normalizeRoleKey(it.role)) || normalizeRoleKey(it.role);
      (groups[g] ||= []).push(it);
    }
    const roleGroups = Object.values(groups);

    if (roleGroups.length === 0) {
      // no role info at all for this company → one application
      if (companyItems.length > 0) applications.push(companyItems);
    } else if (roleGroups.length === 1) {
      // single application → all role-less follow-ups belong to it
      roleGroups[0].push(...roleless);
      applications.push(roleGroups[0]);
    } else {
      // multiple applications → attach each role-less email to the nearest by date
      for (const rl of roleless) {
        let best = roleGroups[0];
        let bestDist = Infinity;
        for (const g of roleGroups) {
          const dist = Math.min(...g.map((e) => Math.abs(e.date - rl.date)));
          if (dist < bestDist) { bestDist = dist; best = g; }
        }
        best.push(rl);
      }
      for (const g of roleGroups) applications.push(g);
    }
  }

  return applications.map(buildRow);
}