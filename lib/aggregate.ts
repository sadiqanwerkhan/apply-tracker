import { Row, TimelineEntry } from "@/lib/types";

export type EmailItem = {
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

export type AppRecord = {
  id: string;
  company: string;
  role: string;
  manualStatus: string | null;
  manualChannel: string | null;
  manualReason: string | null;
  manualDate: number | null;
  mergedIntoId: string | null;
  emails: EmailItem[];
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
  while (words.length > 1 && SUFFIXES.includes(words[words.length - 1])) words.pop();
  s = words.join(" ");
  return s || (company || "").toLowerCase().trim();
}

export function normalizeRoleKey(role: string): string {
  let s = (role || "").toLowerCase();
  s = s.replace(/\(.*?\)/g, " ");
  s = s.replace(/\b(all genders|m\/w\/d|m\/f\/d|f\/m\/d|w\/m\/d|m\/w\/x|d\/m\/w|gn|div)\b/gi, " ");
  s = s.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/\s+/g, "");
  return s;
}

function baseRow(): Row {
  return {
    id: "", company: "", role: "", status: "Pending", confidence: "High", sender: "",
    firstSeen: "", lastSeen: "", note: "", currentStage: "update",
    timeline: [], rejectionReason: "", manual: false, manualChannel: "",
    merged: false, mergedWith: [],
  };
}

function buildRow(emails: EmailItem[]): Row {
  const row = baseRow();
  let firstSeen = emails[0].date;
  let lastSeen = emails[0].date;
  let hasReject = false, lastRejectDate: number | null = null, rejectSubject = "", rejectSummary = "";
  let hasAdvance = false, lastAdvanceDate: number | null = null, advanceSubject = "";
  const events: Event[] = [];

  for (const it of emails) {
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

  if (hasReject && (!lastAdvanceDate || (lastRejectDate || 0) >= lastAdvanceDate)) row.status = "Rejected";
  else if (hasAdvance) row.status = "Advancing";
  else row.status = "Pending";

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

  row.confidence = emails[0].isAts ? "Low" : "High";
  row.sender = emails[0].isAts ? emails[0].sender : "";
  row.firstSeen = new Date(firstSeen).toISOString().slice(0, 10);
  row.lastSeen = new Date(lastSeen).toISOString().slice(0, 10);
  row.timeline = timeline;
  row.currentStage = sorted.length ? sorted[sorted.length - 1].stage : "update";
  row.note = row.status === "Advancing" ? advanceSubject : row.status === "Rejected" ? rejectSubject : "";
  row.rejectionReason = row.status === "Rejected" ? rejectSummary : "";
  return row;
}

/**
 * Build dashboard rows from stable Application records.
 * Merged applications (mergedIntoId) are folded into their root.
 */
export function aggregateApplications(apps: AppRecord[]): Row[] {
  const byId = new Map(apps.map((a) => [a.id, a]));

  function rootOf(a: AppRecord): AppRecord {
    let cur = a;
    const seen = new Set<string>();
    while (cur.mergedIntoId && byId.has(cur.mergedIntoId) && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = byId.get(cur.mergedIntoId)!;
    }
    return cur;
  }

  const groups = new Map<string, AppRecord[]>();
  for (const a of apps) {
    const root = rootOf(a);
    if (!groups.has(root.id)) groups.set(root.id, []);
    groups.get(root.id)!.push(a);
  }

  const rows: Row[] = [];
  for (const [rootId, members] of groups.entries()) {
    const root = byId.get(rootId)!;
    const allEmails = members.flatMap((m) => m.emails);

    const row = allEmails.length > 0 ? buildRow(allEmails) : baseRow();
    row.id = rootId;
    row.company = root.company;
    row.role = root.role;

    if (allEmails.length === 0) {
      const d = new Date(root.manualDate || Date.now()).toISOString().slice(0, 10);
      row.firstSeen = d;
      row.lastSeen = d;
    }

    const others = members.filter((m) => m.id !== rootId);
    row.merged = others.length > 0;
    row.mergedWith = others.map((m) => m.company).filter(Boolean);

    const withOutcome = members.find((m) => m.manualStatus);
    if (withOutcome && withOutcome.manualStatus) {
      row.status = withOutcome.manualStatus === "Advancing" ? "Advancing" : "Rejected";
      row.manual = true;
      row.manualChannel = withOutcome.manualChannel || "";
      const dateStr = new Date(withOutcome.manualDate || Date.now()).toISOString().slice(0, 10);
      const entry: TimelineEntry = {
        date: dateStr,
        stage: row.status === "Rejected" ? "rejected" : "interview",
        subject: `Recorded manually via ${withOutcome.manualChannel || "other channel"}`,
        reason: withOutcome.manualReason || undefined,
        label: row.status === "Rejected" ? "Rejected" : "Moved forward",
      };
      const tl = [...row.timeline, entry].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      row.timeline = tl;
      row.currentStage = tl[tl.length - 1].stage;
      if (row.status === "Rejected") row.rejectionReason = withOutcome.manualReason || "";
      if (dateStr > row.lastSeen) row.lastSeen = dateStr;
    }

    rows.push(row);
  }

  return rows;
}