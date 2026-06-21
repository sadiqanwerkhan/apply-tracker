import { google } from "googleapis";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { classify, extractCompany, extractRole } from "@/lib/classify";
import { aiClassifyBatch, AiStatus } from "@/lib/aiClassify";

const MAX_MESSAGES = 200;
const FETCH_CHUNK = 10;   // parallel Gmail fetches
const AI_BATCH = 12;      // emails per AI call
const AI_DELAY_MS = 1500; // pause between AI batches (respect rate limit)

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
  confidence: string;
};

type Parsed = {
  company: string;
  key: string;
  role: string;
  sender: string;
  isAts: boolean;
  date: number;
  subject: string;
  body: string;
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

// keyword fallback mapped to the 3 statuses
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

    // 1) collect message IDs
    let ids: string[] = [];
    let pageToken: string | undefined = undefined;
    do {
      const resp: { data: { messages?: { id?: string | null }[]; nextPageToken?: string | null } } =
        await gmail.users.messages.list({ userId: "me", q: query, maxResults: 100, pageToken });
      (resp.data.messages || []).forEach((m) => { if (m.id) ids.push(m.id); });
      pageToken = resp.data.nextPageToken || undefined;
    } while (pageToken && ids.length < MAX_MESSAGES);
    ids = ids.slice(0, MAX_MESSAGES);

    // 2) fetch messages in parallel chunks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = [];
    for (let i = 0; i < ids.length; i += FETCH_CHUNK) {
      const chunk = ids.slice(i, i + FETCH_CHUNK);
      const got = await Promise.all(
        chunk.map((id) =>
          gmail.users.messages.get({ userId: "me", id, format: "full" }).then((r) => r.data).catch(() => null)
        )
      );
      got.forEach((m) => { if (m) messages.push(m); });
    }

    // 3) parse each message into a structured item
    const parsed: Parsed[] = [];
    for (const msg of messages) {
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
      parsed.push({ company: label, key, role, sender: info.sender, isAts: info.isAts, date, subject, body });
    }

    // 4) classify with AI in batches (keyword fallback per item)
    const statuses: AiStatus[] = [];
    for (let i = 0; i < parsed.length; i += AI_BATCH) {
      const batch = parsed.slice(i, i + AI_BATCH);
      const ai = await aiClassifyBatch(batch.map((p) => ({ subject: p.subject, body: p.body })));
      for (let j = 0; j < batch.length; j++) {
        statuses.push(ai[j] ?? keywordStatus(batch[j].subject, batch[j].body));
      }
      if (i + AI_BATCH < parsed.length) {
        await new Promise((r) => setTimeout(r, AI_DELAY_MS));
      }
    }

    // 5) aggregate per company using the statuses
    const byCompany: Record<string, Rec> = {};
    parsed.forEach((p, idx) => {
      const status = statuses[idx];
      if (!byCompany[p.key]) {
        byCompany[p.key] = {
          company: p.company, role: p.role, sender: p.sender, viaAts: p.isAts,
          hasReject: false, lastRejectDate: null,
          hasAdvance: false, lastAdvanceDate: null,
          firstSeen: p.date, lastSeen: p.date,
          rejectSubject: "", advanceSubject: "",
          confidence: p.isAts ? "Low" : "High",
        };
      }
      const rec = byCompany[p.key];
      if (!rec.role && p.role) rec.role = p.role;
      if (p.date < rec.firstSeen) rec.firstSeen = p.date;
      if (p.date > rec.lastSeen) rec.lastSeen = p.date;

      if (status === "Rejected") {
        rec.hasReject = true;
        if (!rec.lastRejectDate || p.date > rec.lastRejectDate) { rec.lastRejectDate = p.date; rec.rejectSubject = p.subject; }
      } else if (status === "Advancing") {
        rec.hasAdvance = true;
        if (!rec.lastAdvanceDate || p.date > rec.lastAdvanceDate) { rec.lastAdvanceDate = p.date; rec.advanceSubject = p.subject; }
      }
    });

    // 6) resolve final status, build response rows
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
        confidence: r.confidence,
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