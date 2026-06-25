import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { classify, extractCompany, extractRole } from "@/lib/classify";
import { aiClassifyBatch, AiStatus } from "@/lib/aiClassify";
import { aggregateEmails } from "@/lib/aggregate";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";

const MAX_MESSAGES = 200;
const FETCH_CHUNK = 10;
const AI_BATCH = 12;
const AI_DELAY_MS = 1500;

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
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  // the user's stored Google credentials (saved by Auth.js at sign-in)
  const account = await prisma.account.findFirst({
    where: { userId: user.id, provider: "google" },
  });
  if (!account?.access_token) {
    return NextResponse.json({ error: "no_google_account" }, { status: 400 });
  }

  const startISO = req.nextUrl.searchParams.get("start") || "";
  const endISO = req.nextUrl.searchParams.get("end") || "";
  if (!startISO || !endISO) {
    return NextResponse.json({ error: "missing_dates" }, { status: 400 });
  }

  const startG = isoToGmail(startISO);
  const endG = isoToGmail(endISO, 1);

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token ?? undefined,
      expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
    });
    // persist a refreshed access token back to the DB when Google issues one
    oauth2Client.on("tokens", async (tokens) => {
      try {
        await prisma.account.update({
          where: { id: account.id },
          data: {
            access_token: tokens.access_token ?? account.access_token,
            expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : account.expires_at,
            ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
          },
        });
      } catch {
        // non-fatal: scan can still proceed with the in-memory token
      }
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const query = buildQuery(startG, endG);

    // 1) message IDs for the range
    let ids: string[] = [];
    let pageToken: string | undefined = undefined;
    do {
      const resp: { data: { messages?: { id?: string | null }[]; nextPageToken?: string | null } } =
        await gmail.users.messages.list({ userId: "me", q: query, maxResults: 100, pageToken });
      (resp.data.messages || []).forEach((m) => { if (m.id) ids.push(m.id); });
      pageToken = resp.data.nextPageToken || undefined;
    } while (pageToken && ids.length < MAX_MESSAGES);
    ids = ids.slice(0, MAX_MESSAGES);

    // 2) which of these are already classified for THIS user?
    const existing = await prisma.email.findMany({
      where: { userId: user.id, id: { in: ids } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((e) => e.id));
    const newIds = ids.filter((id) => !existingIds.has(id));
    console.log(`Scan (${user.email}): ${ids.length} in range, ${existingIds.size} cached, ${newIds.length} new`);

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
    type Parsed = {
      id: string; companyKey: string; company: string; role: string;
      sender: string; isAts: boolean; date: number; subject: string; body: string;
    };
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

    // 6) save new classifications, tagged with this user
    if (newParsed.length > 0) {
      await prisma.email.createMany({
        data: newParsed.map((p, i) => ({
          id: p.id, userId: user.id, companyKey: p.companyKey, company: p.company, role: p.role,
          sender: p.sender, isAts: p.isAts, status: newStatuses[i],
          subject: p.subject, date: new Date(p.date),
        })),
      });
    }

    // 7) aggregate ALL of this user's emails
    const allEmails = await prisma.email.findMany({ where: { userId: user.id } });
    const rows = aggregateEmails(
      allEmails.map((e) => ({
        companyKey: e.companyKey, company: e.company, role: e.role, sender: e.sender,
        isAts: e.isAts, status: e.status, date: e.date.getTime(), subject: e.subject,
      }))
    );

    return NextResponse.json({ rows, newCount: newParsed.length });
  } catch (err) {
    console.error("Scan error:", err);
    return NextResponse.json({ error: "scan_failed" }, { status: 500 });
  }
}