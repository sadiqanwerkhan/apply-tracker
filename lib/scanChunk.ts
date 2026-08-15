import crypto from "node:crypto";
import { classify, extractCompany, extractRole, isPersonalSender, isBulkNoise } from "@/lib/classify";
import { stageToStatus, Stage, AiResult } from "@/lib/aiClassify";
import { classifyBatch } from "@/lib/classifyEngine";
import { prisma } from "@/lib/prisma";
import { getGmailClient, NoGoogleAccountError } from "@/lib/gmail";
import { normalizeCompanyKey, normalizeRoleKey } from "@/lib/aggregate";
import { matchApplication, AppRef } from "@/lib/matchApplication";

const CHUNK_SIZE = 60;   // emails fully processed per invocation
const FETCH_CHUNK = 20;  // Gmail body fetches in flight at once
const AI_BATCH = 15;     // emails per Claude call
const AI_PARALLEL = 3;   // Claude calls in flight at once
const BODY_LIMIT = 1500; // must match the truncation aiClassifyBatch uses, so cache hashes line up
// No sleep between batches: Inngest retries a failed chunk, so a transient
// rate-limit is no longer catastrophic. Reliability bought the right to be fast.

// Re-exported so existing importers keep working after the move to lib/gmail.
export { NoGoogleAccountError };

export type ChunkResult = {
  processed: number;
  remaining: number;
  done: boolean;
  truncated: boolean;
};

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

/** Hash of exactly what the classifier sees, so a cache hit is a true match. */
function contentHash(subject: string, body: string): string {
  const b = body.length > BODY_LIMIT ? body.slice(0, BODY_LIMIT) : body;
  return crypto.createHash("sha256").update(subject + "\u0000" + b).digest("hex");
}

type Parsed = {
  id: string; subject: string; body: string; date: number;
  regexCompany: string; regexRole: string; sender: string; isAts: boolean;
};

type Final = {
  id: string; company: string; role: string; sender: string; isAts: boolean;
  stage: Stage; subject: string; date: number; summary: string | null;
};

/**
 * Process ONE bounded chunk of a user's scan.
 *
 * The list of matching message ids is produced ONCE per job by the orchestrator
 * (a memoized Inngest step) and passed in here — this used to re-list every
 * chunk, which was O(n^2) Gmail calls per scan.
 *
 * Idempotent and resumable:
 *  - emails already stored (or skipped) are the cursor
 *  - the chunk is persisted before returning
 *  - re-running it repeats only un-persisted work
 *
 * Cost controls added:
 *  - a deterministic keyword read resolves clear rejections (and clear
 *    ATS-sent application confirmations) with NO AI call at all
 *  - remaining emails are classified through a per-user content-hash cache, so
 *    an Inngest retry of a chunk never re-pays for AI it already ran
 */
export async function runScanChunk(
  userId: string,
  startISO: string,
  endISO: string,
  ids: string[],
  truncated: boolean
): Promise<ChunkResult> {
  const gmail = await getGmailClient(userId); // throws NoGoogleAccountError if unusable

  if (ids.length === 0) {
    return { processed: 0, remaining: 0, done: true, truncated };
  }

  // 1) THE CURSOR: anything already stored or skipped is already done.
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

  // 2) fetch bodies for THIS CHUNK only
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
            console.warn(`ScanChunk: could not fetch a message (${id}): ${e?.message || e}`);
            return { id, data: null };
          })
      )
    );
    for (const g of got) {
      if (g.data) newMessages.push(g.data);
      else unfetchable.push(g.id);
    }
  }

  // 3) parse
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

  const finals: Final[] = [];

  // 4) DETERMINISTIC SHORT-CIRCUIT — resolve the clear cases with no AI call.
  //    - A clear rejection (deterministic phrases are high precision). Never
  //      dropped even if we can't name the company.
  //    - An ATS-sent application confirmation with a company we could extract.
  //    Everything else falls through to the AI path.
  const needAi: Parsed[] = [];
  for (const p of parsed) {
    const kw = classify(`${p.subject} ${p.body}`.toLowerCase());

    if (kw === "Rejected") {
      let label = p.regexCompany || (p.regexRole ? `(${p.regexRole})` : "");
      if (!label) label = "Unknown company";
      finals.push({
        id: p.id, company: label, role: p.regexRole,
        sender: p.sender, isAts: p.isAts, stage: "rejected",
        subject: p.subject, date: p.date, summary: null,
      });
      continue;
    }

    if (kw === "Confirmed" && p.isAts && p.regexCompany) {
      finals.push({
        id: p.id, company: p.regexCompany, role: p.regexRole,
        sender: p.sender, isAts: p.isAts, stage: "applied",
        subject: p.subject, date: p.date, summary: null,
      });
      continue;
    }

    needAi.push(p);
  }

  // 5) AI classification for the rest, THROUGH A PER-USER CACHE.
  //    Cache key = hash of exactly what the model sees. A retry of this chunk
  //    therefore reuses results instead of re-paying for them.
  if (needAi.length > 0) {
    const hashById = new Map<string, string>();
    for (const p of needAi) hashById.set(p.id, contentHash(p.subject, p.body));
    const wantedHashes = Array.from(new Set(hashById.values()));

    const cachedRows = await prisma.classificationCache.findMany({
      where: { userId, hash: { in: wantedHashes } },
      select: { hash: true, result: true },
    });
    const resultByHash = new Map<string, AiResult>();
    for (const row of cachedRows) resultByHash.set(row.hash, row.result as unknown as AiResult);

    // Emails whose hash we haven't classified yet — dedup by hash so two
    // identical emails in one chunk cost a single AI slot.
    const missByHash = new Map<string, Parsed>();
    for (const p of needAi) {
      const h = hashById.get(p.id)!;
      if (!resultByHash.has(h) && !missByHash.has(h)) missByHash.set(h, p);
    }
    const misses = Array.from(missByHash.entries()); // [hash, Parsed][]

    if (misses.length > 0) {
      const batches: [string, Parsed][][] = [];
      for (let i = 0; i < misses.length; i += AI_BATCH) batches.push(misses.slice(i, i + AI_BATCH));

      for (let i = 0; i < batches.length; i += AI_PARALLEL) {
        const group = batches.slice(i, i + AI_PARALLEL);
        const results = await Promise.all(
          group.map((b) => classifyBatch(b.map(([, p]) => ({ subject: p.subject, body: p.body }))))
        );
        for (let g = 0; g < group.length; g++) {
          const batch = group[g];
          const ai = results[g];
          for (let j = 0; j < batch.length; j++) {
            const [h] = batch[j];
            const r = ai[j];
            if (r) resultByHash.set(h, r);
          }
        }
      }

      // Persist freshly-computed results (skip the ones the model failed on).
      const toCache = misses
        .map(([h]) => h)
        .filter((h) => resultByHash.has(h))
        .map((h) => ({ userId, hash: h, result: resultByHash.get(h) as unknown as object }));
      if (toCache.length > 0) {
        await prisma.classificationCache.createMany({ data: toCache, skipDuplicates: true });
      }
    }

    // Apply results (cached or fresh) with the same rejection protection as before.
    for (const p of needAi) {
      const r = resultByHash.get(hashById.get(p.id)!) ?? null;

      const kwStage = keywordStage(p.subject, p.body);
      const looksLikeRejection = kwStage === "rejected";

      // DEFENSE IN DEPTH: never let the AI discard a probable rejection.
      if (r && r.promotional && !looksLikeRejection) {
        skipIds.push(p.id);
        continue;
      }

      const stage: Stage = looksLikeRejection ? "rejected" : (r ? r.stage : kwStage);
      const company = (r && r.company) ? r.company : (p.regexCompany || "");
      const role = (r && r.role) ? r.role : (p.regexRole || "");

      let label = company || (role ? `(${role})` : "");
      if (!label && looksLikeRejection) label = "Unknown company";

      if (!label) {
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

      // Where does this email belong? Pure decision logic, unit-tested in
      // lib/matchApplication.test.ts. The DB writes stay here.
      const decision = matchApplication(apps, { ck, rk, date: f.date });
      let appId: string;

      if (decision.kind === "adopt") {
        // the company had a role-less placeholder — give it this email's role
        await prisma.application.update({
          where: { id: decision.appId },
          data: { role: f.role, roleKey: rk },
        });
        const ph = apps.find((a) => a.id === decision.appId);
        if (ph) ph.rk = rk;
        appId = decision.appId;
      } else if (decision.kind === "attach") {
        appId = decision.appId;
      } else {
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