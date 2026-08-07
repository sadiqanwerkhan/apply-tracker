import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "apply-tracker",
  // Force the local Dev Server whenever we're NOT in production, so
  // inngest.send() delivers events to the local Inngest dev server
  // (localhost:8288) instead of Inngest Cloud during local development.
  // On Vercel, NODE_ENV is "production", so this is false and the app uses
  // Inngest Cloud with your signing/event keys as normal.
  isDev: process.env.NODE_ENV !== "production",
});