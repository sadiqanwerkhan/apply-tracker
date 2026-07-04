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

// A manually-recorded outcome (rejection/advance that arrived off-channel).
export type ManualOutcomeItem = {
  companyKey: string;
  roleKey: string;
  status: string;    // "Rejected" | "Advancing"
  channel: string;
  reason: string | null;
  date: number;      // epoch ms
};

type Event = { date: number; stage: string; subject: string; summary: string };

// legal suffixes / noise that make the same company look different
const SUFFIXES = [
  "gmbh", "ag", "se", "kg", "kgaa", "ohg", "ug", "mbh", "co",
  "inc", "incorporated", "ltd", "limited", "llc", "llp", "lp", "plc",
  "corp", "corporation", "company", "group", "holding", "holdings",
  "technologies", "technology", "tech", "solutions", "software", "labs",
  "international", "global", "digital", "ventures", "studios", "studio",
  // country / region words that appear as trailing noise (e.g. "Recare Deutschland" == "Recare")
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

// Two roles match only if their full normalized text is identical (NO prefix-merge).
export function normalizeRoleKey(role: string): string {
  let s = (role || "").toLowerCase();
  s = s.replace(/\(.*?\)/g, " ");
  s = s.replace(/\b(all genders|m\/w\/d|m\/f\/d|f\/m\/d|w\/m\/d|m\/w\/x|d\/m\/w|gn|div)\b/gi, " ");
  s = s.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
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
  };
}

export function aggregateEmails(items: EmailItem[], manual: ManualOutcomeItem[] = []): Row[] {
  const byCompany: Record<string, EmailItem[]> = {};
  for (const it of items) {
    const ck = it.companyKey.startsWith("role:") ? it.companyKey : normalizeCompanyKey(it.company);
    (byCompany[ck] ||= []).push(it);
  }

  const applications: EmailItem[][] = [];

  for (const companyItems of Object.values(byCompany)) {
    const withRole = companyItems.filter((it) => normalizeRoleKey(it.role));
    const roleless = companyItems.filter((it) => !normalizeRoleKey(it.role));

    const groups: Record<string, EmailItem[]> = {};
    for (const it of withRole) {
      const key = normalizeRoleKey(it.role);
      (groups[key] ||= []).push(it);
    }
    const roleGroups = Object.values(groups);

    if (roleGroups.length === 0) {
      if (companyItems.length > 0) applications.push(companyItems);
    } else if (roleGroups.length === 1) {
      roleGroups[0].push(...roleless);
      applications.push(roleGroups[0]);
    } else {
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

  const rows = applications.map(buildRow);

  if (manual.length > 0) {
    const map = new Map<string, ManualOutcomeItem>();
    for (const m of manual) map.set(`${m.companyKey}::${m.roleKey}`, m);

    for (const row of rows) {
      const key = `${normalizeCompanyKey(row.company)}::${normalizeRoleKey(row.role)}`;
      const m = map.get(key);
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

  return rows;
}