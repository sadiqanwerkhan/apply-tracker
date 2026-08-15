import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { checkLimit } from "@/lib/rateLimit";
import { runAgent } from "@/lib/agent/runAgent";

export const maxDuration = 60;

// The chat/agent endpoint. Takes a question, runs the agent (which calls the
// query tools as needed), and returns a grounded answer. Same guards as the
// other AI routes: auth + per-user budget limit.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) return NextResponse.json({ error: "empty_question" }, { status: 400 });
  if (question.length > 500) return NextResponse.json({ error: "question_too_long" }, { status: 400 });

  // Budget guard: this endpoint calls Claude.
  const limited = await checkLimit(user.id, "ask");
  if (limited) return NextResponse.json(limited, { status: 429 });

  try {
    const result = await runAgent(question, { userId: user.id });
    return NextResponse.json(result);
  } catch (err) {
    console.error("agent error:", err);
    return NextResponse.json({ error: "agent_failed" }, { status: 500 });
  }
}