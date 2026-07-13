import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { classify, extractCompany, extractRole, isPersonalSender } from "@/lib/classify";
import { aiClassifyBatch, stageToStatus, Stage } from "@/lib/aiClassify";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { aggregateApplications, normalizeCompanyKey, normalizeRoleKey } from "@/lib/aggregate";

// Vercel: allow up to 60s per invocation (Hobby maximum).
// Each call now processes ONE bounded chunk, so it comfortably fits.
export const maxDuration = 60;

const MAX_MESSAGES = 1000; // message ids considered for a date range
const CHUNK_SIZE = 24;     // new emails fully processed per invocation (2 AI batches)
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

function keywordStage(subject: string, body: string): Stage {
  const kw = classify((subject + " " + body).toLowerCase());
  if (kw === "Rejected") return "rejected";
  if (kw === "Advancing") return "interview";
  return "applied";
}

// Build the dashboard rows from the stable Application records.
async function buildRows(userId: string) {
  const apps = await prisma.application.findMany({
    where: { userId },
    include: { emails: true },
  });
  return aggregateApplications(
    apps.map((a) => ({
      id: a.id, company: a.company, role: a.role,
      manualStatus: a.manualStatus, manualChannel: a.manualChannel,
      manualReason: a.manualReason, manualDate: a.manualDate ? a.manualDate.getTime() : null,
      mergedIntoId: a.mergedIntoId,
      emails: a.emails.map((e) => ({
        company: e.company, role: e.role, sender: e.sender, isAts: e.isAts,
        status: e.status, stage: e.stage, date: e.date.getTime(),
        subject: e.subject, summary: e.summary,
      })),
    }))
  );
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

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
        // non-fatal
      }
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const query = buildQuery(startG, endG);

    // 1) message ids for the range (cheap; repeated per chunk to stay stateless)
    let ids: string[] = [];
    let pageToken: string | undefined = undefined;
    do {
      const resp: { data: { messages?: { id?: string | null }[]; nextPageToken?: string | null } } =
        await gmail.users.messages.list({ userId: "me", q: query, maxResults: 100, pageToken });
      (resp.data.messages || []).forEach((m) => { if (m.id) ids.push(m.id); });
      pageToken = resp.data.nextPageToken || undefined;
    } while (pageToken && ids.length < MAX_MESSAGES);
    ids = ids.slice(0, MAX_MESSAGES);

    const truncated = ids.length >= MAX_MESSAGES;

    // 2) THE CURSOR: whatever is already stored (or skipped) is already done.
    const [existingEmails, skippedRows] = await Promise.all([
      prisma.email.findMany({ where: { userId: user.id, id: { in: ids } }, select: { id: true } }),
      prisma.skippedEmail.findMany({ where: { userId: user.id, messageId: { in: ids } }, select: { messageId: true } }),
    ]);
    const seen = new Set<string>([
      ...existingEmails.map((e) => e.id),
      ...skippedRows.map((s) => s.messageId),
    ]);
    const allNewIds = ids.filter((id) => !seen.has(id));

    // 2b) This invocation handles ONE bounded chunk.
    const newIds = allNewIds.slice(0, CHUNK_SIZE);
    const remaining = allNewIds.length - newIds.length;

    console.log(
      `Scan (${user.email}): ${ids.length} in range, ${seen.size} seen, ` +
      `${allNewIds.length} new -> processing ${newIds.length}, ${remaining} remaining`
    );

    // nothing to do: return current state
    if (newIds.length === 0) {
      const rows = await buildRows(user.id);
      return NextResponse.json({ rows, processed: 0, remaining: 0, done: true, truncated });
    }

    // 3) fetch bodies for THIS CHUNK only
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

    // 4) parse
    type Parsed = {
      id: string; subject: string; body: string; date: number;
      regexCompany: string; regexRole: string; sender: string; isAts: boolean;
    };
    const parsed: Parsed[] = [];
    const skipIds: string[] = [];

    for (const msg of newMessages) {
      const headers = msg.payload?.headers || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const from = (headers.find((h: any) => h.name === "From") || {}).value || "";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subject = (headers.find((h: any) => h.name === "Subject") || {}).value || "";
      const date = parseInt(msg.internalDate, 10);

      if (isPersonalSender(from)) { skipIds.push(msg.id); continue; }

      const info = extractCompany(from);
      const role = extractRole(subject);
      const body = getBodyText(msg.payload);

      parsed.push({
        id: msg.id, subject, body, date,
        regexCompany: info.name, regexRole: role, sender: info.sender, isAts: info.isAts,
      });
    }

    // 5) AI classification for this chunk
    type Final = {
      id: string; company: string; role: string; sender: string; isAts: boolean;
      stage: Stage; subject: string; date: number; summary: string | null;
    };
    const finals: Final[] = [];

    for (let i = 0; i < parsed.length; i += AI_BATCH) {
      const batch = parsed.slice(i, i + AI_BATCH);
      const ai = await aiClassifyBatch(batch.map((p) => ({ subject: p.subject, body: p.body })));

      for (let j = 0; j < batch.length; j++) {
        const p = batch[j];
        const r = ai[j];

        if (r && r.promotional) { skipIds.push(p.id); continue; }

        const stage: Stage = r ? r.stage : keywordStage(p.subject, p.body);
        const company = (r && r.company) ? r.company : (p.regexCompany || "");
        const role = (r && r.role) ? r.role : (p.regexRole || "");

        if (!company && !role) { skipIds.push(p.id); continue; }
        const label = company || `(${role})`;

        finals.push({
          id: p.id, company: label, role,
          sender: p.sender, isAts: p.isAts, stage, subject: p.subject, date: p.date,
          summary: r ? r.reason : null,
        });
      }

      if (i + AI_BATCH < parsed.length) {
        await new Promise((r) => setTimeout(r, AI_DELAY_MS));
      }
    }

    // 6) PERSIST THIS CHUNK NOW (this is what makes progress durable)
    if (finals.length > 0) {
      const existingApps = await prisma.application.findMany({ where: { userId: user.id } });
      const appByKey = new Map<string, string>();
      const appByCompany = new Map<string, string[]>();
      for (const a of existingApps) {
        const ck = normalizeCompanyKey(a.company);
        appByKey.set(`${ck}::${normalizeRoleKey(a.role)}`, a.id);
        if (!appByCompany.has(ck)) appByCompany.set(ck, []);
        appByCompany.get(ck)!.push(a.id);
      }

      const rowsToCreate: {
        id: string; userId: string; applicationId: string; companyKey: string; company: string;
        role: string; sender: string; isAts: boolean; stage: string; status: string;
        subject: string; date: Date; summary: string | null;
      }[] = [];

      for (const f of finals) {
        const ck = normalizeCompanyKey(f.company);
        const rk = normalizeRoleKey(f.role);
        const exactKey = `${ck}::${rk}`;

        let appId = appByKey.get(exactKey);

        if (!appId && !rk) {
          const candidates = appByCompany.get(ck) || [];
          if (candidates.length === 1) appId = candidates[0];
        }

        if (!appId) {
          const created = await prisma.application.create({
            data: { userId: user.id, companyKey: ck, roleKey: rk, company: f.company, role: f.role },
          });
          appId = created.id;
          appByKey.set(exactKey, appId);
          if (!appByCompany.has(ck)) appByCompany.set(ck, []);
          appByCompany.get(ck)!.push(appId);
        }

        rowsToCreate.push({
          id: f.id, userId: user.id, applicationId: appId, companyKey: ck, company: f.company,
          role: f.role, sender: f.sender, isAts: f.isAts, stage: f.stage, status: stageToStatus(f.stage),
          subject: f.subject, date: new Date(f.date), summary: f.summary,
        });
      }

      // idempotent: re-writing the same Gmail message id is a no-op
      await prisma.email.createMany({ data: rowsToCreate, skipDuplicates: true });
    }

    if (skipIds.length > 0) {
      await prisma.skippedEmail.createMany({
        data: skipIds.map((id) => ({ userId: user.id, messageId: id })),
        skipDuplicates: true,
      });
    }

    console.log(`Scan (${user.email}): chunk stored ${finals.length}, skipped ${skipIds.length}`);

    // 7) return current rows + progress
    const rows = await buildRows(user.id);
    return NextResponse.json({
      rows,
      processed: newIds.length,
      remaining,
      done: remaining === 0,
      truncated,
    });
  } catch (err) {
    console.error("Scan error:", err);
    return NextResponse.json({ error: "scan_failed" }, { status: 500 });
  }
}