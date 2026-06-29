import { Row, TimelineEntry } from "@/lib/types";

// One email's worth of data, the input to aggregation.
export type EmailItem = {
  companyKey: string;
  company: string;
  role: string;
  sender: string;
  isAts: boolean;
  status: string; // "Rejected" | "Advancing" | "Pending"
  stage: string;  // "applied" | "screening" | ... | "rejected" | "update"
  date: number;   // epoch ms
  subject: string;
};

type Event = { date: number; stage: string; subject: string };

type Rec = {
  company: string;
  role: string;
  sender: string;
  viaAts: boolean;
  hasReject: boolean;
  lastRejectDate: number | null;
  hasAdvance: boolean;
  lastAdvanceDate: number | null;
  firstSeen: number;
  lastSeen: number;
  rejectSubject: string;
  advanceSubject: string;
  bestNameLen: number;
  events: Event[];
};

// legal suffixes and noise words that make the same company look different
const SUFFIXES = [
  "gmbh", "ag", "se", "kg", "kgaa", "ohg", "ug", "mbh", "co",
  "inc", "incorporated", "ltd", "limited", "llc", "llp", "lp", "plc",
  "corp", "corporation", "company", "group", "holding", "holdings",
  "technologies", "technology", "tech", "solutions", "software", "labs",
  "international", "global", "digital", "ventures", "studios", "studio",
];

/**
 * Normalize a company name into a stable grouping key.
 * "Flip GmbH", "Flip", "FLIP gmbh" all become "flip" so they merge.
 * Conservative: strips legal/suffix noise but does NOT fuzzy-match,
 * to avoid wrongly merging two different companies.
 */
function normalizeKey(company: string): string {
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

/**
 * Collapse many per-email rows into one row per company.
 * Resolves a final status, AND builds an ordered timeline of the journey.
 */
export function aggregateEmails(items: EmailItem[]): Row[] {
  const byCompany: Record<string, Rec> = {};

  for (const it of items) {
    const key = it.companyKey.startsWith("role:")
      ? it.companyKey
      : normalizeKey(it.company);

    if (!byCompany[key]) {
      byCompany[key] = {
        company: it.company, role: it.role, sender: it.sender, viaAts: it.isAts,
        hasReject: false, lastRejectDate: null,
        hasAdvance: false, lastAdvanceDate: null,
        firstSeen: it.date, lastSeen: it.date,
        rejectSubject: "", advanceSubject: "",
        bestNameLen: it.company.length,
        events: [],
      };
    }
    const rec = byCompany[key];

    if (it.company.length > rec.bestNameLen) {
      rec.company = it.company;
      rec.bestNameLen = it.company.length;
    }
    if (!rec.role && it.role) rec.role = it.role;
    if (it.date < rec.firstSeen) rec.firstSeen = it.date;
    if (it.date > rec.lastSeen) rec.lastSeen = it.date;

    rec.events.push({ date: it.date, stage: it.stage || "update", subject: it.subject });

    if (it.status === "Rejected") {
      rec.hasReject = true;
      if (!rec.lastRejectDate || it.date > rec.lastRejectDate) { rec.lastRejectDate = it.date; rec.rejectSubject = it.subject; }
    } else if (it.status === "Advancing") {
      rec.hasAdvance = true;
      if (!rec.lastAdvanceDate || it.date > rec.lastAdvanceDate) { rec.lastAdvanceDate = it.date; rec.advanceSubject = it.subject; }
    }
  }

  return Object.values(byCompany).map((r) => {
    let status: string;
    if (r.hasReject && (!r.lastAdvanceDate || (r.lastRejectDate || 0) >= r.lastAdvanceDate)) status = "Rejected";
    else if (r.hasAdvance) status = "Advancing";
    else status = "Pending";

    // build the ordered timeline: sort by date, collapse consecutive same-stage runs
    const sorted = r.events.slice().sort((a, b) => a.date - b.date);
    const timeline: TimelineEntry[] = [];
    for (const ev of sorted) {
      const last = timeline[timeline.length - 1];
      if (last && last.stage === ev.stage) continue;
      timeline.push({
        date: new Date(ev.date).toISOString().slice(0, 10),
        stage: ev.stage,
        subject: ev.subject,
      });
    }
    const currentStage = sorted.length ? sorted[sorted.length - 1].stage : "update";

    const note = status === "Advancing" ? r.advanceSubject : status === "Rejected" ? r.rejectSubject : "";
    return {
      company: r.company,
      role: r.role || "",
      status,
      confidence: r.viaAts ? "Low" : "High",
      sender: r.viaAts ? r.sender : "",
      firstSeen: new Date(r.firstSeen).toISOString().slice(0, 10),
      lastSeen: new Date(r.lastSeen).toISOString().slice(0, 10),
      note,
      currentStage,
      timeline,
    };
  });
}