import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { checkLimit } from "@/lib/rateLimit";
import { runAgent } from "@/lib/agent/runAgent";
import type { ProviderId } from "@/lib/agent/providers";

export const maxDuration = 60;

// GET — load this user's saved chat history (most recent 100 messages).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const messages = await prisma.chatMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { role: true, content: true },
  });
  return NextResponse.json({ messages });
}

// POST — ask a question. Runs the agent, saves both the question and the answer
// so the conversation persists across visits.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) return NextResponse.json({ error: "empty_question" }, { status: 400 });
  if (question.length > 500) return NextResponse.json({ error: "question_too_long" }, { status: 400 });

  const provider: ProviderId | undefined =
    body?.provider === "groq" || body?.provider === "gemini" ? body.provider : undefined;

  const limited = await checkLimit(user.id, "ask");
  if (limited) return NextResponse.json(limited, { status: 429 });

  try {
    const result = await runAgent(question, { userId: user.id }, provider);

    // Persist the exchange (non-fatal — a save failure shouldn't lose the answer).
    try {
      await prisma.chatMessage.createMany({
        data: [
          { userId: user.id, role: "user", content: question },
          { userId: user.id, role: "assistant", content: result.answer },
        ],
      });
    } catch (saveErr) {
      console.error("chat history save failed (non-fatal):", saveErr);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("agent error:", err);
    const msg = err instanceof Error ? err.message : "agent_failed";
    return NextResponse.json({ error: "agent_failed", detail: msg }, { status: 500 });
  }
}

// DELETE — clear this user's chat history.
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  await prisma.chatMessage.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ ok: true });
}