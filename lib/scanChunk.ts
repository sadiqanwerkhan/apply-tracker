import { google } from "googleapis";
import { classify, extractCompany, extractRole, isPersonalSender } from "@/lib/classify";
import { aiClassifyBatch, stageToStatus, Stage } from "@/lib/aiClassify";
import { prisma } from "@/lib/prisma";
import { normalizeCompanyKey, normalizeRoleKey } from "@/lib/aggregate";

const MAX_MESSAGES = 1000;
const CHUNK_SIZE = 24;
const FETCH_CHUNK = 10;
const AI_BATCH = 12;
const AI_DELAY_MS = 1500;

export type ChunkResult = {
  processed: number;
  remaining: number;
  done: boolean;
  truncated: boolean;
};

/** Thrown when the user's Google connection is unusable. Not worth retrying. */
export class NoGoogleAccountError extends Error {
  constructor() {
    super("no_google_account");
    this.name = "NoGoogleAccountError";
  }
}

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

/**
 * Process ONE bounded chunk of a user's scan.
 *
 * This function is idempotent and resumable:
 *  - emails already stored (or skipped) are the cursor
 *  - the chunk is persisted before returning
 *  - re-running it repeats only un-persisted work
 *
 * It knows nothing about HTTP, so it can be driven by a route, a queue, or a cron.
 */
export async function runScanChunk(
  userId: string,
  startISO: string,
  endISO: string
): Promise<ChunkResult> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });
  if (!account?.access_token) throw new NoGoogleAccountError();

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
  const query = buildQuery(isoToGmail(startISO), isoToGmail(endISO, 1));

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

  // 2) THE CURSOR: anything already stored or skipped is already done.
  const [existingEmails, skippedRows] = await Promise.all([
    prisma.email.findMany({ where: { userId, id: { in: ids } }, select: { id: true } }),
    prisma.skippedEmail.findMany({ where: { userId, messageId: { in: ids } }, select: { messageId: true } }),
  ]);
  const seen = new Set<string>([
    ...existingEmails.map((e) => e.id),
    ...skippedRows.map((s) => s.messageId),
  ]);
  const allNewIds = ids.filter((id) => !seen.has(id));

  const newIds = allNewIds.slice(0, CHUNK_SIZE);
  const remaining = allNewIds.length - newIds.length;

  console.log(
    `ScanChunk(${userId}): ${ids.length} in range, ${seen.size} seen, ` +
    `${allNewIds.length} new -> processing ${newIds.length}, ${remaining} remaining`
  );

  if (newIds.length === 0) {
    return { processed: 0, remaining: 0, done: true, truncated };
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

  // 5) AI classification
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

  // 6) PERSIST THIS CHUNK (durable progress)
  if (finals.length > 0) {
    const existingApps = await prisma.application.findMany({ where: { userId } });
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

// exact key miss → if this company has exactly ONE application, attach to it
// rather than inventing a second one for a role-string variant.
if (!appId) {
  const candidates = appByCompany.get(ck) || [];
  if (candidates.length === 1) appId = candidates[0];
}

      if (!appId) {
        const created = await prisma.application.create({
          data: { userId, companyKey: ck, roleKey: rk, company: f.company, role: f.role },
        });
        appId = created.id;
        appByKey.set(exactKey, appId);
        if (!appByCompany.has(ck)) appByCompany.set(ck, []);
        appByCompany.get(ck)!.push(appId);
      }

      rowsToCreate.push({
        id: f.id, userId, applicationId: appId, companyKey: ck, company: f.company,
        role: f.role, sender: f.sender, isAts: f.isAts, stage: f.stage, status: stageToStatus(f.stage),
        subject: f.subject, date: new Date(f.date), summary: f.summary,
      });
    }

    await prisma.email.createMany({ data: rowsToCreate, skipDuplicates: true });
  }

  if (skipIds.length > 0) {
    await prisma.skippedEmail.createMany({
      data: skipIds.map((id) => ({ userId, messageId: id })),
      skipDuplicates: true,
    });
  }

  console.log(`ScanChunk(${userId}): stored ${finals.length}, skipped ${skipIds.length}`);

  return { processed: newIds.length, remaining, done: remaining === 0, truncated };
}