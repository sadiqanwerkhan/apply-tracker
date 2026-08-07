import crypto from "node:crypto";

/**
 * Symmetric encryption for secrets we must store but never want readable in the
 * database — specifically the user's Google access/refresh tokens.
 *
 * Format of an encrypted value:  v1:<iv>:<authTag>:<ciphertext>   (each base64)
 *
 * Why a version prefix:
 *  - it lets decrypt() tell an encrypted value from a LEGACY PLAINTEXT one, so
 *    tokens written before this module existed keep working until the user next
 *    signs in (which re-writes them encrypted). Zero-downtime migration.
 *  - it leaves room to rotate keys / algorithms later ("v2:") without ambiguity.
 */

const ALGO = "aes-256-gcm";
const VERSION = "v1";

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENC_KEY;
  if (!raw) throw new Error("TOKEN_ENC_KEY is not set");
  // Accept either hex (64 chars) or base64 (44 chars). Must decode to 32 bytes.
  const key = raw.length === 64 ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("TOKEN_ENC_KEY must decode to exactly 32 bytes");
  return key;
}

/** Encrypt a UTF-8 string. Returns a self-describing token (see file header). */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit nonce, the standard size for GCM
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

/**
 * Decrypt a value produced by encrypt().
 *  - null/empty in -> null out.
 *  - a value NOT in our "v1:" format is assumed to be a legacy plaintext token
 *    and returned unchanged, so existing sessions don't break.
 *  - a tampered or wrong-key ciphertext returns null (fail closed).
 */
export function decrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith(VERSION + ":")) return value; // legacy plaintext — pass through
  const parts = value.split(":");
  if (parts.length !== 4) return null;
  const [, ivB64, tagB64, dataB64] = parts;
  try {
    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

/** Encrypt only if there's a value; pass null through. Convenience for optional fields. */
export function encryptNullable(value: string | null | undefined): string | null {
  return value ? encrypt(value) : null;
}

/** True if a stored value is already in our encrypted format. */
export function isEncrypted(value: string | null | undefined): boolean {
  return !!value && value.startsWith(VERSION + ":");
}