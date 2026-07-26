import { google } from "googleapis";
import { classify, extractCompany, extractRole, isPersonalSender, isBulkNoise  } from "@/lib/classify";
import { aiClassifyBatch, stageToStatus, Stage } from "@/lib/aiClassify";
import { prisma } from "@/lib/prisma";
import { normalizeCompanyKey, normalizeRoleKey, companyKeysMatch } from "@/lib/aggregate";

const MAX_MESSAGES = 1000;
const CHUNK_SIZE = 60;   // emails fully processed per invocation
const FETCH_CHUNK = 20;  // Gmail body fetches in flight at once
const AI_BATCH = 15;     // emails per Claude call
const AI_PARALLEL = 3;   // Claude calls in flight at once
// No sleep between batches: Inngest retries a failed chunk, so a transient
// rate-limit is no longer catastrophic. Reliability bought the right to be fast.

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
    // rejection-specific terms, so a rejection can never miss the Gmail query
    '"regret to inform"', '"not moving forward"', '"other candidates"', '"talent pool"',
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

type Parsed = {
  id: string; subject: string; body: string; date: number;
  regexCompany: string; regexRole: string; sender: string; isAts: boolean;
};

/**
 * Process ONE bounded chunk of a user's scan.
 *
 * Idempotent and resumable:
 *  - emails already stored (or skipped) are the cursor
 *  - the chunk is persisted before returning
 *  - re-running it repeats only un-persisted work
 *
 * Knows nothing about HTTP, so it can be driven by a route, a queue, or a cron.
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
  const unfetchable: string[] = [];
  for (let i = 0; i < newIds.length; i += FETCH_CHUNK) {
    const chunk = newIds.slice(i, i + FETCH_CHUNK);
    const got = await Promise.all(
      chunk.map((id) =>
        gmail.users.messages.get({ userId: "me", id, format: "full" })
          .then((r) => ({ id, data: r.data }))
          .catch((e) => {
            console.warn(`ScanChunk: could not fetch ${id}: ${e?.message || e}`);
            return { id, data: null };
          })
      )
    );
    for (const g of got) {
      if (g.data) newMessages.push(g.data);
      else unfetchable.push(g.id);
    }
  }

  // 4) parse
  const parsed: Parsed[] = [];
  const skipIds: string[] = [];

  for (const msg of newMessages) {
    const headers = msg.payload?.headers || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const from = (headers.find((h: any) => h.name === "From") || {}).value || "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subject = (headers.find((h: any) => h.name === "Subject") || {}).value || "";
    const date = parseInt(msg.internalDate, 10);

    if (isPersonalSender(from)) {
      skipIds.push(msg.id);
      continue;
    }
        // PRE-FILTER: drop obvious bulk/marketing noise before it ever reaches the
    // AI. Conservative by design — only provably-non-application mail is dropped
    // here. A keyword rejection check below still runs on anything that stays,
    // so we never drop a real rejection. This is a pure cost/speed optimization.
    const rawSubject = subject;
    if (isBulkNoise(from, rawSubject) && classify(`${rawSubject} ${getBodyText(msg.payload)}`.toLowerCase()) === "None") {
      console.log(`ScanChunk: pre-filter drop [bulk noise] ${rawSubject}`);
      skipIds.push(msg.id);
      continue;
    }

    const info = extractCompany(from);
    const role = extractRole(subject);
    const body = getBodyText(msg.payload);

    parsed.push({
      id: msg.id, subject, body, date,
      regexCompany: info.name, regexRole: role, sender: info.sender, isAts: info.isAts,
    });
  }

  // 5) AI classification — batches run in PARALLEL, with rejection protection.
  type Final = {
    id: string; company: string; role: string; sender: string; isAts: boolean;
    stage: Stage; subject: string; date: number; summary: string | null;
  };
  const finals: Final[] = [];

  const batches: Parsed[][] = [];
  for (let i = 0; i < parsed.length; i += AI_BATCH) {
    batches.push(parsed.slice(i, i + AI_BATCH));
  }

  for (let i = 0; i < batches.length; i += AI_PARALLEL) {
    const group = batches.slice(i, i + AI_PARALLEL);
    const results = await Promise.all(
      group.map((b) => aiClassifyBatch(b.map((p) => ({ subject: p.subject, body: p.body }))))
    );

    for (let g = 0; g < group.length; g++) {
      const batch = group[g];
      const ai = results[g];

      for (let j = 0; j < batch.length; j++) {
        const p = batch[j];
        const r = ai[j];

        // Cheap, deterministic keyword read of the raw text. Hard to fool.
        const kwStage = keywordStage(p.subject, p.body);
        const looksLikeRejection = kwStage === "rejected";

        // DEFENSE IN DEPTH: never let the AI discard a probable rejection.
        // Losing a rejection makes the app lie about your status — the worst
        // failure mode this system has.
        if (r && r.promotional && !looksLikeRejection) {
          console.log(`ScanChunk: skip [promotional] ${p.subject}`);
          skipIds.push(p.id);
          continue;
        }

        // A keyword rejection overrides whatever the AI decided.
        const stage: Stage = looksLikeRejection ? "rejected" : (r ? r.stage : kwStage);
        const company = (r && r.company) ? r.company : (p.regexCompany || "");
        const role = (r && r.role) ? r.role : (p.regexRole || "");

        // Never drop a rejection just because we couldn't name the company.
        let label = company || (role ? `(${role})` : "");
        if (!label && looksLikeRejection) label = "Unknown company";

        if (!label) {
          console.log(`ScanChunk: skip [no company/role] ${p.subject}`);
          skipIds.push(p.id);
          continue;
        }

        finals.push({
          id: p.id, company: label, role,
          sender: p.sender, isAts: p.isAts, stage, subject: p.subject, date: p.date,
          summary: r ? r.reason : null,
        });
      }
    }
  }

  // 6) PERSIST THIS CHUNK.
  //    Applications stay ROLE-LEVEL (two Tesla roles = two rows).
  //    But an email with NO role (calendar invite, "Re:", confirmation) must
  //    NEVER create its own row — it attaches to the company's nearest
  //    application by date. This restores the read-time behaviour that was lost.
  if (finals.length > 0) {
    const existingApps = await prisma.application.findMany({
      where: { userId },
      select: { id: true, company: true, role: true, emails: { select: { date: true } } },
    });

    type AppRef = { id: string; ck: string; rk: string; dates: number[] };
    const apps: AppRef[] = existingApps.map((a) => ({
      id: a.id,
      ck: normalizeCompanyKey(a.company),
      rk: normalizeRoleKey(a.role),
      dates: a.emails.map((e) => e.date.getTime()),
    }));

    const rowsToCreate: {
      id: string; userId: string; applicationId: string; companyKey: string; company: string;
      role: string; sender: string; isAts: boolean; stage: string; status: string;
      subject: string; date: Date; summary: string | null;
    }[] = [];

    for (const f of finals) {
      const ck = normalizeCompanyKey(f.company);
      const rk = normalizeRoleKey(f.role);
      const sameCompany = apps.filter((a) => companyKeysMatch(a.ck, ck));

      let appId: string | undefined;

      // 1) exact role match at this company
      if (rk) {
        const exact = sameCompany.find((a) => a.rk === rk);
        if (exact) appId = exact.id;
      }

      // 2) NO role on this email → attach to the company's nearest application by date
      if (!appId && !rk && sameCompany.length > 0) {
        let best = sameCompany[0];
        let bestDist = Infinity;
        for (const a of sameCompany) {
          const d = a.dates.length ? Math.min(...a.dates.map((t) => Math.abs(t - f.date))) : Infinity;
          if (d < bestDist) { bestDist = d; best = a; }
        }
        appId = best.id;
      }

      // 3) HAS a role, and this company has a role-less placeholder → adopt it
      if (!appId && rk) {
        const placeholder = sameCompany.find((a) => a.rk === "");
        if (placeholder) {
          await prisma.application.update({
            where: { id: placeholder.id },
            data: { role: f.role, roleKey: rk },
          });
          placeholder.rk = rk;
          appId = placeholder.id;
        }
      }

      // 4) genuinely a new role (or a new company) → new application
      if (!appId) {
        const created = await prisma.application.create({
          data: { userId, companyKey: ck, roleKey: rk, company: f.company, role: f.role },
        });
        appId = created.id;
        apps.push({ id: created.id, ck, rk, dates: [] });
      }

      const ref = apps.find((a) => a.id === appId);
      if (ref) ref.dates.push(f.date);

      rowsToCreate.push({
        id: f.id, userId, applicationId: appId, companyKey: ck, company: f.company,
        role: f.role, sender: f.sender, isAts: f.isAts, stage: f.stage, status: stageToStatus(f.stage),
        subject: f.subject, date: new Date(f.date), summary: f.summary,
      });
    }

    await prisma.email.createMany({ data: rowsToCreate, skipDuplicates: true });
  }

  // messages we could not fetch are recorded too, so they can never loop forever
  const toSkip = [...skipIds, ...unfetchable];
  if (toSkip.length > 0) {
    await prisma.skippedEmail.createMany({
      data: toSkip.map((id) => ({ userId, messageId: id })),
      skipDuplicates: true,
    });
  }

  console.log(
    `ScanChunk(${userId}): stored ${finals.length}, skipped ${skipIds.length}, unfetchable ${unfetchable.length}`
  );

  return { processed: newIds.length, remaining, done: remaining === 0, truncated };
}