import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Sample 10% of transactions for performance data. Lower = cheaper.
  tracesSampleRate: 0.1,
  // Only send events when a DSN is set (so local dev without a DSN stays quiet).
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});