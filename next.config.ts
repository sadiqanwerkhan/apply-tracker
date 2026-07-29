import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // Suppresses the Sentry build logs; set org/project when you set up source maps
  silent: true,
  // These come from your Sentry account — fill in from the Sentry project settings
  org: "apply-tracker",
  project: "javascript-nextjs",
  // Only upload source maps in CI/production builds
  disableLogger: true,
});