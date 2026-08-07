import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";

const MAX_MESSAGES = 1000;

/** Thrown when the user's Google connection is unusable. Not worth retrying. */
export class NoGoogleAccountError extends Error {
  constructor() {
    super("no_google_account");
    this.name = "NoGoogleAccountError";
  }
}

/**
 * Build an authorized Gmail client for a user.
 *
 * Reads the stored Google Account, DECRYPTS the tokens (lib/crypto), and wires
 * up an on("tokens") listener that RE-ENCRYPTS any refreshed token before
 * writing it back. Shared by the id-listing pass and the per-chunk body fetch
 * so this token handling lives in exactly one place.
 */
export async function getGmailClient(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });
  const accessToken = decrypt(account?.access_token);
  if (!account || !accessToken) throw new NoGoogleAccountError();

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: decrypt(account.refresh_token) ?? undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });

  oauth2Client.on("tokens", async (tokens) => {
    try {
      await prisma.account.update({
        where: { id: account.id },
        data: {
          access_token: tokens.access_token ? encrypt(tokens.access_token) : account.access_token,
          expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : account.expires_at,
          ...(tokens.refresh_token ? { refresh_token: encrypt(tokens.refresh_token) } : {}),
        },
      });
    } catch {
      // non-fatal — the in-memory client already has the fresh token
    }
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
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

export type ListResult = { ids: string[]; truncated: boolean };

/**
 * List all matching Gmail message ids for a date range, in ONE pass.
 *
 * This is the expensive Gmail call. It used to run on every chunk (O(n^2) list
 * calls per scan); the orchestrator now runs it once per job (a memoized
 * Inngest step) and hands the ids to each chunk.
 */
export async function listMessageIds(
  userId: string,
  startISO: string,
  endISO: string
): Promise<ListResult> {
  const gmail = await getGmailClient(userId);
  const query = buildQuery(isoToGmail(startISO), isoToGmail(endISO, 1));

  let ids: string[] = [];
  let pageToken: string | undefined = undefined;
  do {
    const resp: { data: { messages?: { id?: string | null }[]; nextPageToken?: string | null } } =
      await gmail.users.messages.list({ userId: "me", q: query, maxResults: 100, pageToken });
    (resp.data.messages || []).forEach((m) => { if (m.id) ids.push(m.id); });
    pageToken = resp.data.nextPageToken || undefined;
  } while (pageToken && ids.length < MAX_MESSAGES);

  const truncated = ids.length >= MAX_MESSAGES;
  ids = ids.slice(0, MAX_MESSAGES);
  return { ids, truncated };
}