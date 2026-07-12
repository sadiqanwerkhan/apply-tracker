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
  summary: string | null;
};

export type ManualOutcomeItem = {
  companyKey: string;
  roleKey: string;
  status: string;
  channel: string;
  reason: string | null;
  date: number;
};

export type MergeItem = {
  companyKey: string;
  roleKey: string;
  groupId: string;
  isPrimary: boolean;
  company: string;
  role: string;
};

type Event = { date: number; stage: string; subject: string; summary: string };

const SUFFIXES = [
  "gmbh", "ag", "se", "kg", "kgaa", "ohg", "ug", "mbh", "co",
  "inc", "incorporated", "ltd", "limited", "llc", "llp", "lp", "plc",
  "corp", "corporation", "company", "group", "holding", "holdings",
  "technologies", "technology", "tech", "solutions", "software", "labs",
  "international", "global", "digital", "ventures", "studios", "studio",
  "deutschland", "germany", "europe", "eu", "usa", "uk", "america",
  "österreich", "austria", "schweiz", "switzerland", "nordics", "dach",
];

export function normalizeCompanyKey(company: string): string {
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

export function normalizeRoleKey(role: string): string {
  let s = (role || "").toLowerCase();
  s = s.replace(/\(.*?\)/g, " ");
  s = s.replace(/\b(all genders|m\/w\/d|m\/f\/d|f\/m\/d|w\/m\/d|m\/w\/x|d\/m\/w|gn|div)\b/gi, " ");
  s = s.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/\s+/g, "");            // ← NEW: collapse all spaces
  return s;
}

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
    manual: false,
    manualChannel: "",
    merged: false,
    mergedWith: [],
  };
}

type FinalApp = {
  emails: EmailItem[];
  displayCompany: string | null;
  displayRole: string | null;
  memberKeys: string[];
  merged: boolean;
  mergedWith: string[];
};

export function aggregateEmails(
  items: EmailItem[],
  manual: ManualOutcomeItem[] = [],
  merges: MergeItem[] = []
): Row[] {
  const byCompany: Record<string, EmailItem[]> = {};
  for (const it of items) {
    const ck = it.companyKey.startsWith("role:") ? it.companyKey : normalizeCompanyKey(it.company);
    (byCompany[ck] ||= []).push(it);
  }

  const apps: { ck: string; roleKey: string; emails: EmailItem[] }[] = [];
  for (const [ck, companyItems] of Object.entries(byCompany)) {
    const withRole = companyItems.filter((it) => normalizeRoleKey(it.role));
    const roleless = companyItems.filter((it) => !normalizeRoleKey(it.role));
    const groups: Record<string, EmailItem[]> = {};
    for (const it of withRole) {
      const rk = normalizeRoleKey(it.role);
      (groups[rk] ||= []).push(it);
    }
    const roleKeys = Object.keys(groups);
    if (roleKeys.length === 0) {
      if (companyItems.length) apps.push({ ck, roleKey: "", emails: companyItems });
    } else if (roleKeys.length === 1) {
      apps.push({ ck, roleKey: roleKeys[0], emails: [...groups[roleKeys[0]], ...roleless] });
    } else {
      for (const rl of roleless) {
        let bestRk = roleKeys[0], bestDist = Infinity;
        for (const rk of roleKeys) {
          const dist = Math.min(...groups[rk].map((e) => Math.abs(e.date - rl.date)));
          if (dist < bestDist) { bestDist = dist; bestRk = rk; }
        }
        groups[bestRk].push(rl);
      }
      for (const rk of roleKeys) apps.push({ ck, roleKey: rk, emails: groups[rk] });
    }
  }

  const appByKey = new Map<string, { ck: string; roleKey: string; emails: EmailItem[] }>();
  for (const a of apps) appByKey.set(`${a.ck}::${a.roleKey}`, a);

  const groupsById = new Map<string, MergeItem[]>();
  for (const m of merges) {
    if (!groupsById.has(m.groupId)) groupsById.set(m.groupId, []);
    groupsById.get(m.groupId)!.push(m);
  }

  const consumed = new Set<string>();
  const finalApps: FinalApp[] = [];

  for (const members of groupsById.values()) {
    const memberKeys = members.map((m) => `${m.companyKey}::${m.roleKey}`);
    const primary = members.find((m) => m.isPrimary) || members[0];
    const combinedEmails: EmailItem[] = [];
    let anyExists = false;
    for (const m of members) {
      const k = `${m.companyKey}::${m.roleKey}`;
      consumed.add(k);
      const a = appByKey.get(k);
      if (a) { combinedEmails.push(...a.emails); anyExists = true; }
    }
    if (!anyExists) continue;
    const mergedWith = members.filter((m) => !m.isPrimary).map((m) => m.company).filter(Boolean);
    finalApps.push({
      emails: combinedEmails,
      displayCompany: primary.company,
      displayRole: primary.role,
      memberKeys,
      merged: true,
      mergedWith,
    });
  }

  for (const a of apps) {
    const k = `${a.ck}::${a.roleKey}`;
    if (consumed.has(k)) continue;
    finalApps.push({ emails: a.emails, displayCompany: null, displayRole: null, memberKeys: [k], merged: false, mergedWith: [] });
  }

  const built = finalApps.map((fa) => {
    const row = buildRow(fa.emails);
    if (fa.displayCompany !== null) row.company = fa.displayCompany;
    if (fa.displayRole !== null) row.role = fa.displayRole;
    row.merged = fa.merged;
    row.mergedWith = fa.mergedWith;
    return { row, memberKeys: fa.memberKeys };
  });

  if (manual.length > 0) {
    const mmap = new Map<string, ManualOutcomeItem>();
    for (const m of manual) mmap.set(`${m.companyKey}::${m.roleKey}`, m);

    for (const { row, memberKeys } of built) {
      let m: ManualOutcomeItem | undefined;
      for (const k of memberKeys) { if (mmap.has(k)) { m = mmap.get(k); break; } }
      if (!m) continue;

      row.status = m.status === "Advancing" ? "Advancing" : "Rejected";
      row.manual = true;
      row.manualChannel = m.channel;
      const dateStr = new Date(m.date).toISOString().slice(0, 10);
      const entry: TimelineEntry = {
        date: dateStr,
        stage: row.status === "Rejected" ? "rejected" : "interview",
        subject: `Recorded manually via ${m.channel}`,
        reason: m.reason || undefined,
        label: row.status === "Rejected" ? "Rejected" : "Moved forward",
      };
      const tl = [...row.timeline, entry].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      row.timeline = tl;
      row.currentStage = tl[tl.length - 1].stage;
      if (row.status === "Rejected") row.rejectionReason = m.reason || "";
      if (dateStr > row.lastSeen) row.lastSeen = dateStr;
    }
  }

  return built.map((b) => b.row);
}