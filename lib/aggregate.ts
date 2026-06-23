import { Row } from "@/lib/types";

// One email's worth of data, the input to aggregation.
export type EmailItem = {
  companyKey: string;
  company: string;
  role: string;
  sender: string;
  isAts: boolean;
  status: string; // "Rejected" | "Advancing" | "Pending"
  date: number;   // epoch ms
  subject: string;
};

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
};

/**
 * Collapse many per-email rows into one row per company,
 * resolving the final status (a later rejection beats an earlier advance).
 * Shared by the scan route and the load-from-DB route.
 */
export function aggregateEmails(items: EmailItem[]): Row[] {
  const byCompany: Record<string, Rec> = {};

  for (const it of items) {
    if (!byCompany[it.companyKey]) {
      byCompany[it.companyKey] = {
        company: it.company, role: it.role, sender: it.sender, viaAts: it.isAts,
        hasReject: false, lastRejectDate: null,
        hasAdvance: false, lastAdvanceDate: null,
        firstSeen: it.date, lastSeen: it.date,
        rejectSubject: "", advanceSubject: "",
      };
    }
    const rec = byCompany[it.companyKey];
    if (!rec.role && it.role) rec.role = it.role;
    if (it.date < rec.firstSeen) rec.firstSeen = it.date;
    if (it.date > rec.lastSeen) rec.lastSeen = it.date;

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
    };
  });
}