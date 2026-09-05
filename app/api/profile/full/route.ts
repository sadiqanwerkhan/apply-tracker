import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";

// Returns the user's entire profile in one call, for export. Read-only.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const [profile, work, education, languages, certifications] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: user.id } }),
    prisma.workExperience.findMany({ where: { userId: user.id }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    prisma.education.findMany({ where: { userId: user.id }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    prisma.language.findMany({ where: { userId: user.id }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    prisma.certification.findMany({ where: { userId: user.id }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
  ]);

  return NextResponse.json({
    personal: {
      firstName: profile?.firstName ?? null,
      lastName: profile?.lastName ?? null,
      email: user.email ?? null,
      contactEmail: profile?.contactEmail ?? null,
      age: profile?.age ?? null,
      phone: profile?.phone ?? null,
      location: profile?.location ?? null,
    },
    work, education, languages, certifications,
  });
}