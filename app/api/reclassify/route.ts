import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { classify, CONFIRM_PHRASES } from "@/lib/classify";
import { aiClassifyBatch, stageToStatus, Stage } from "@/lib/aiClassify";

export const maxDuration = 60;

// Re-classify already-stored emails with the CURRENT logic, updating each
// email's stage/status IN PLACE. Does NOT touch applicationId, merges,
// transcripts, or manual outcomes — only refreshes classification.
// Processes a bounded batch per call so it fits the serverless limit.
const BATCH = 40;

function keywordStage(subject: string, body: string): Stage {
  const kw = classify(`${subject} ${body}`.toLowerCase());
  if (kw === "Rejected") return "rejected";
  if (kw === "Advancing") return "interview";
  return "applied";
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const cursor: string | undefined = body?.cursor || undefined;

  // pull a bounded page of this user's stored emails, oldest id first
  const emails = await prisma.email.findMany({
    where: { userId: user.id },
    orderBy: { id: "asc" },
    ...(cursor ? { cursor: { userId_id: { userId: user.id, id: cursor } }, skip: 1 } : {}),
    take: BATCH,
    select: { id: true, subject: true, summary: true, stage: true, status: true },
  });

  if (emails.length === 0) {
    return NextResponse.json({ done: true, updated: 0, nextCursor: null });
  }

  // We only stored subject + summary (not full body). Re-run AI on subject+summary,
  // which is what the classifier needs for stage/company/role.
  const ai = await aiClassifyBatch(
    emails.map((e) => ({ subject: e.subject, body: e.summary || "" }))
  );

  let updated = 0;

  for (let i = 0; i < emails.length; i++) {
    const e = emails[i];
    const r = ai[i];

    const text = `${e.subject} ${e.summary || ""}`.toLowerCase();
    const kwStage = keywordStage(e.subject, e.summary || "");
    // Same rule as the live scan: a confirmation email with a stray rejection
    // word is NOT a rejection.
    const looksLikeConfirmation = CONFIRM_PHRASES.some((p) => text.includes(p));
    const looksLikeRejection = kwStage === "rejected" && !looksLikeConfirmation;

    const newStage: Stage = looksLikeRejection ? "rejected" : (r ? r.stage : kwStage);
    const newStatus = stageToStatus(newStage);

    if (newStage !== e.stage || newStatus !== e.status) {
      await prisma.email.update({
        where: { userId_id: { userId: user.id, id: e.id } },
        data: { stage: newStage, status: newStatus },
      });
      updated++;
    }
  }

  const nextCursor = emails[emails.length - 1].id;
  return NextResponse.json({ done: false, updated, nextCursor });
}