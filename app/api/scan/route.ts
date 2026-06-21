import { google } from "googleapis";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { classify, extractCompany, extractRole } from "@/lib/classify";

const MAX_MESSAGES = 200;
const CHUNK = 10;

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

    // 2) fetch in parallel chunks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const got = await Promise.all(
        chunk.map((id) =>
          gmail.users.messages.get({ userId: "me", id, format: "full" }).then((r) => r.data).catch(() => null)
        )
      );
      got.forEach((m) => { if (m) messages.push(m); });
    }

    // 3) classify + aggregate
    const byCompany: Record<string, Rec> = {};
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
      const hay = (subject + " " + body).toLowerCase();
      const result = classify(hay);

      if (!byCompany[key]) {
        byCompany[key] = {
          company: label, role, sender: info.sender, viaAts: info.isAts,
          hasReject: false, lastRejectDate: null,
          hasAdvance: false, lastAdvanceDate: null,
          firstSeen: date, lastSeen: date,
          rejectSubject: "", advanceSubject: "",
          confidence: info.isAts ? "Low" : "High",
        };
      }
      const rec = byCompany[key];
      if (!rec.role && role) rec.role = role;
      if (date < rec.firstSeen) rec.firstSeen = date;
      if (date > rec.lastSeen) rec.lastSeen = date;

      if (result === "Rejected") {
        rec.hasReject = true;
        if (!rec.lastRejectDate || date > rec.lastRejectDate) { rec.lastRejectDate = date; rec.rejectSubject = subject; }
      } else if (result === "Advancing") {
        rec.hasAdvance = true;
        if (!rec.lastAdvanceDate || date > rec.lastAdvanceDate) { rec.lastAdvanceDate = date; rec.advanceSubject = subject; }
      }
    }

    // 4) resolve final status, build response rows
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