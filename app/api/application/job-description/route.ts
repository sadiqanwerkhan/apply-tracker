import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { applicationId, jobTitle, jobLocation, jobDescription } = await req.json().catch(() => ({}));
  if (!applicationId) return NextResponse.json({ error: "missing_application" }, { status: 400 });

  const app = await prisma.application.findUnique({ where: { id: applicationId }, select: { userId: true } });
  if (!app || app.userId !== user.id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.application.update({
    where: { id: applicationId },
    data: {
      jobTitle: jobTitle?.trim() || null,
      jobLocation: jobLocation?.trim() || null,
      jobDescription: jobDescription?.trim() || null,
    },
  });

  return NextResponse.json({ ok: true });
}