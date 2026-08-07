import { prisma } from "@/lib/prisma";

type Limit = { max: number; windowMs: number };

/**
 * Fixed-window, per-user rate limit backed by Postgres.
 *
 * Purpose: stop any one authenticated user from draining paid resources
 * (Anthropic tokens, Gmail quota) with a loop. It is deliberately simple and
 * "good enough" at small/mid scale — move to Redis/Upstash for a sliding window
 * and lower latency when you outgrow a single database.
 *
 * The INCREMENT is atomic, so the count can never be badly undercounted; under
 * heavy concurrency the allow/deny boundary can be off by a request or two,
 * which is fine for a budget guard. Old rows can be swept periodically; at this
 * scale they're negligible.
 */
export async function rateLimit(userId: string, action: string, limit: Limit) {
  const windowKey = String(Math.floor(Date.now() / limit.windowMs));
  const key = { userId, action, window: windowKey };

  const row = await prisma.rateLimit.upsert({
    where: { userId_action_window: key },
    create: { ...key, count: 1 },
    update: { count: { increment: 1 } },
  });

  return {
    allowed: row.count <= limit.max,
    remaining: Math.max(0, limit.max - row.count),
    limit: limit.max,
  };
}

// One place to see and tune every paid action's per-user budget.
export const LIMITS = {
  scan:       { max: 10, windowMs: 24 * 60 * 60 * 1000 },
  analyze:    { max: 30, windowMs: 24 * 60 * 60 * 1000 },
  prep:       { max: 50, windowMs: 24 * 60 * 60 * 1000 },
  insights:   { max: 50, windowMs: 24 * 60 * 60 * 1000 },
  // reclassify runs ONE call per 40-email page and the client loops through
  // pages, so this is sized to allow a full pass of a large inbox (~2400 emails)
  // per day while still capping repeated full re-runs.
  reclassify: { max: 60, windowMs: 24 * 60 * 60 * 1000 },
} as const;

export type LimitAction = keyof typeof LIMITS;

/** Small helper: enforce a named limit and return a ready-to-send 429 body, or null if allowed. */
export async function checkLimit(userId: string, action: LimitAction) {
  const r = await rateLimit(userId, action, LIMITS[action]);
  if (r.allowed) return null;
  return { error: "rate_limited", action, limit: r.limit, retryAfterSeconds: Math.ceil(LIMITS[action].windowMs / 1000) };
}