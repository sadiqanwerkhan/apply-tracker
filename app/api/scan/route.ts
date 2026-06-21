import { google } from "googleapis";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { classify, extractCompany, extractRole } from "@/lib/classify";
import { aiClassifyBatch, AiStatus } from "@/lib/aiClassify";
import { prisma } from "@/lib/prisma";

const MAX_MESSAGES = 200;
const FETCH_CHUNK = 10;
const AI_BATCH = 12;
const AI_DELAY_MS = 1500;

// a single email's worth of data, used for aggregation
type Item = {
  companyKey: string;
  company: string;
  role: string;
  sender: string;
  isAts: boolean;
  status: AiStatus;
  date: number; // ms
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

function isoToGmail(iso: string, addDays = 0): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + addDays);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function buildQuery(startG: string, endG: string): string {
  const keywords = [
    '"thank you for applying"', '"your application"', "application", "applying",
    "interview", "unfortunately", '"next step"', "candidacy", '"move forward"',
    "recruiting", "recruiter", "position", "role",
  ].join(" OR ");
  return `after:${startG} before:${endG} (${keywords})`;
}

function decodeB64(data: string): string {
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return "";
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getBodyText(payload: any): string {
  let out = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walk(p: any) {
    if (!p) return;
    if (p.mimeType === "text/plain" && p.body?.data) out += decodeB64(p.body.data) + " ";
    else if (p.mimeType === "text/html" && p.body?.data) out += decodeB64(p.body.data).replace(/<[^>]+>/g, " ") + " ";
    if (p.parts) p.parts.forEach(walk);
  }
  walk(payload);
  return out;
}

function keywordStatus(subject: string, body: string): AiStatus {
  const kw = classify((subject + " " + body).toLowerCase());
  if (kw === "Rejected") return "Rejected";
  if (kw === "Advancing") return "Advancing";
  return "Pending";
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get("gmail_tokens");
  if (!tokenCookie) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const startISO = req.nextUrl.searchParams.get("start") || "";
  const endISO = req.nextUrl.searchParams.get("end") || "";
  if (!startISO || !endISO) {
    return NextResponse.json({ error: "missing_dates" }, { status: 400 });
  }

  const startG = isoToGmail(startISO);
  const endG = isoToGmail(endISO, 1);

  try {
    const tokens = JSON.parse(tokenCookie.value);
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const query = buildQuery(startG, endG);

    // 1) collect message IDs for the range (fast — IDs only)
    let ids: string[] = [];
    let pageToken: string | undefined = undefined;
    do {
      const resp: { data: { messages?: { id?: string | null }[]; nextPageToken?: string | null } } =
        await gmail.users.messages.list({ userId: "me", q: query, maxResults: 100, pageToken });
      (resp.data.messages || []).forEach((m) => { if (m.id) ids.push(m.id); });
      pageToken = resp.data.nextPageToken || undefined;
    } while (pageToken && ids.length < MAX_MESSAGES);
    ids = ids.slice(0, MAX_MESSAGES);

    // 2) which of these do we already have in the DB?
    const existing = await prisma.email.findMany({ where: { id: { in: ids } } });
    const existingIds = new Set(existing.map((e) => e.id));
    const newIds = ids.filter((id) => !existingIds.has(id));
    console.log(`Scan: ${ids.length} emails, ${existing.length} cached, ${newIds.length} new to classify`);

    // 3) fetch bodies for NEW emails only
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newMessages: any[] = [];
    for (let i = 0; i < newIds.length; i += FETCH_CHUNK) {
      const chunk = newIds.slice(i, i + FETCH_CHUNK);
      const got = await Promise.all(
        chunk.map((id) =>
          gmail.users.messages.get({ userId: "me", id, format: "full" }).then((r) => r.data).catch(() => null)
        )
      );
      got.forEach((m) => { if (m) newMessages.push(m); });
    }

    // 4) parse new messages
    type Parsed = Omit<Item, "status"> & { id: string; body: string };
    const newParsed: Parsed[] = [];
    for (const msg of newMessages) {
      const headers = msg.payload?.headers || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const from = (headers.find((h: any) => h.name === "From") || {}).value || "";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subject = (headers.find((h: any) => h.name === "Subject") || {}).value || "";
      const date = parseInt(msg.internalDate, 10);

      const info = extractCompany(from);
      const role = extractRole(subject);

      let label: string, key: string;
      if (info.name) { label = info.name; key = info.name.toLowerCase(); }
      else if (role) { label = "(" + role + ")"; key = "role:" + role.toLowerCase(); }
      else continue;

      const body = getBodyText(msg.payload);
      newParsed.push({
        id: msg.id, companyKey: key, company: label, role,
        sender: info.sender, isAts: info.isAts, date, subject, body,
      });
    }

    // 5) AI-classify the new ones (keyword fallback per item)
    const newStatuses: AiStatus[] = [];
    for (let i = 0; i < newParsed.length; i += AI_BATCH) {
      const batch = newParsed.slice(i, i + AI_BATCH);
      const ai = await aiClassifyBatch(batch.map((p) => ({ subject: p.subject, body: p.body })));
      for (let j = 0; j < batch.length; j++) {
        newStatuses.push(ai[j] ?? keywordStatus(batch[j].subject, batch[j].body));
      }
      if (i + AI_BATCH < newParsed.length) {
        await new Promise((r) => setTimeout(r, AI_DELAY_MS));
      }
    }

    // 6) save the new classifications to the DB
    if (newParsed.length > 0) {
      await prisma.email.createMany({
        data: newParsed.map((p, i) => ({
          id: p.id, companyKey: p.companyKey, company: p.company, role: p.role,
          sender: p.sender, isAts: p.isAts, status: newStatuses[i],
          subject: p.subject, date: new Date(p.date),
        })),
      });
    }

    // 7) build the unified list (cached + newly classified) for aggregation
    const all: Item[] = [
      ...existing.map((e) => ({
        companyKey: e.companyKey, company: e.company, role: e.role, sender: e.sender,
        isAts: e.isAts, status: e.status as AiStatus, date: e.date.getTime(), subject: e.subject,
      })),
      ...newParsed.map((p, i) => ({
        companyKey: p.companyKey, company: p.company, role: p.role, sender: p.sender,
        isAts: p.isAts, status: newStatuses[i], date: p.date, subject: p.subject,
      })),
    ];

    // 8) aggregate per company
    const byCompany: Record<string, Rec> = {};
    for (const it of all) {
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

    // 9) resolve final status, build response rows
    const rows = Object.values(byCompany).map((r) => {
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

    return NextResponse.json({ rows, start: startISO, end: endISO });
  } catch (err) {
    console.error("Scan error:", err);
    return NextResponse.json({ error: "scan_failed" }, { status: 500 });
  }
}