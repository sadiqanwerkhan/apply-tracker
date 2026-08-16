import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// Token format: a long random string the user puts in their MCP client. We store
// only its SHA-256 hash. Looking a token up = hash the incoming token, find the
// row with that hash. (Hashing is deterministic, so the same token always hashes
// to the same value — which is what lets us look it up, unlike a salted password.)

const PREFIX = "atk_"; // "apply-tracker key" — helps the user recognize it

export function generateRawToken(): string {
  return PREFIX + crypto.randomBytes(32).toString("hex");
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// Create a token for a user: returns the RAW token (shown once) and stores its hash.
export async function createMcpToken(userId: string, label?: string): Promise<string> {
  const raw = generateRawToken();
  await prisma.mcpToken.create({
    data: { userId, tokenHash: hashToken(raw), label: label || null },
  });
  return raw;
}

// Resolve a raw token to a userId (or null). Updates lastUsedAt on success.
export async function userIdForToken(raw: string | null): Promise<string | null> {
  if (!raw) return null;
  const token = raw.replace(/^Bearer\s+/i, "").trim();
  if (!token.startsWith(PREFIX)) return null;

  const row = await prisma.mcpToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true },
  });
  if (!row) return null;

  // Best-effort "last used" stamp (non-fatal).
  prisma.mcpToken
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return row.userId;
}