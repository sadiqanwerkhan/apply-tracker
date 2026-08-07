import { z } from "zod";

/**
 * Request-body schemas. Every mutating route parses its body through one of
 * these before touching the database or an LLM. Two jobs:
 *  1. reject malformed input with a clear 400 instead of coercing junk in.
 *  2. CAP the size of any free text that gets sent to Claude, so a single huge
 *     paste can't blow up token cost or latency.
 */

// Free text that flows into an LLM prompt — bounded hard.
const MAX_TRANSCRIPT = 40_000;
const MAX_JOB_DESC = 30_000;

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const id = z.string().min(1).max(64);

export const scanSchema = z.object({
  start: dateOnly,
  end: dateOnly,
});

// Stage type is a UI-driven string today; bound its length rather than guess the
// exact enum the frontend sends. Once you confirm the dropdown values, swap this
// for z.enum([...]) to reject anything off-list.
export const createStageSchema = z.object({
  applicationId: id,
  name: z.string().trim().min(1).max(120),
  type: z.string().trim().max(40).optional(),
  scheduledAt: z.union([z.string().max(40), z.null()]).optional(),
});

export const patchStageSchema = z.object({
  id,
  name: z.string().trim().max(120).optional(),
  type: z.string().trim().max(40).optional(),
  move: z.enum(["up", "down"]).optional(),
  scheduledAt: z.union([z.string().max(40), z.null()]).optional(),
});

export const deleteByIdSchema = z.object({ id });

export const createTranscriptSchema = z.object({
  stageId: id,
  content: z.string().min(1).max(MAX_TRANSCRIPT),
  label: z.string().trim().max(120).nullish(),
});

export const patchTranscriptSchema = z.object({
  id,
  content: z.string().max(MAX_TRANSCRIPT).optional(),
  label: z.string().trim().max(120).nullish(),
});

export const manualOutcomeSchema = z.object({
  applicationId: id,
  status: z.enum(["Advancing", "Rejected"]),
  channel: z.string().trim().min(1).max(60),
  reason: z.string().trim().max(2_000).nullish(),
  date: z.union([z.string().max(40), z.null()]).optional(),
});

export const mergeSchema = z.object({
  primaryId: id,
  otherId: id,
});

export const applicationIdSchema = z.object({ applicationId: id });

export const analyzeSchema = z.object({ applicationId: id });

export const prepSchema = z.object({ applicationId: id, stageId: id });

export const jobDescriptionSchema = z.object({
  applicationId: id,
  jobTitle: z.string().trim().max(200).nullish(),
  jobLocation: z.string().trim().max(200).nullish(),
  jobDescription: z.string().max(MAX_JOB_DESC).nullish(),
});

/**
 * Parse `data` against `schema`. Returns a discriminated result so callers can
 * do: `const p = parse(schema, body); if (!p.ok) return 400(p.error);`
 */
export function parse<T>(
  schema: z.ZodType<T>,
  data: unknown
): { ok: true; data: T } | { ok: false; error: string } {
  const r = schema.safeParse(data);
  if (r.success) return { ok: true, data: r.data };
  const error = r.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
  return { ok: false, error };
}