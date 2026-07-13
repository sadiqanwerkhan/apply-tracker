import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { scanInbox } from "@/lib/inngest/scanFunction";

export const maxDuration = 60;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [scanInbox],
});