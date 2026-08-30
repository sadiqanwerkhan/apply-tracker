import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";

// One endpoint for all four repeatable profile sections. `section` picks the
// table; each section has a strict field whitelist so only known fields are
// written. Everything is scoped to the authenticated user.
type Section = "work" | "education" | "language" | "certification";

const s = (v: unknown, max = 300) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
const bool = (v: unknown) => v === true;

function clean(section: Section, body: Record<string, unknown>) {
  switch (section) {
    case "work":
      return {
        title: s(body.title) ?? "", company: s(body.company) ?? "",
        workMode: ["onsite", "hybrid", "remote"].includes(String(body.workMode)) ? String(body.workMode) : "onsite",
        country: s(body.country), city: s(body.city),
        startDate: s(body.startDate, 20), endDate: s(body.endDate, 20),
        current: bool(body.current), description: s(body.description, 4000),
      };
    case "education":
      return {
        degree: s(body.degree) ?? "", institution: s(body.institution) ?? "",
        country: s(body.country), city: s(body.city),
        startDate: s(body.startDate, 20), endDate: s(body.endDate, 20),
        current: bool(body.current), description: s(body.description, 4000),
      };
    case "language":
      return { name: s(body.name) ?? "", level: s(body.level, 20) ?? "" };
    case "certification":
      return { name: s(body.name) ?? "", issuer: s(body.issuer), year: s(body.year, 10) };
  }
}

function delegate(section: Section) {
  if (section === "work") return prisma.workExperience;
  if (section === "education") return prisma.education;
  if (section === "language") return prisma.language;
  return prisma.certification;
}

function isSection(v: unknown): v is Section {
  return v === "work" || v === "education" || v === "language" || v === "certification";
}

// GET ?section=work — list this user's entries for a section.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const section = req.nextUrl.searchParams.get("section");
  if (!isSection(section)) return NextResponse.json({ error: "bad_section" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = await (delegate(section) as any).findMany({
    where: { userId: user.id },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ items });
}

// POST { section, ...fields } — create an entry.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || !isSection(body.section)) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const data = clean(body.section, body);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const created = await (delegate(body.section) as any).create({ data: { userId: user.id, ...data } });
  return NextResponse.json({ ok: true, item: created });
}

// PUT { section, id, ...fields } — update an entry (ownership-checked).
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || !isSection(body.section) || typeof body.id !== "string") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const data = clean(body.section, body);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (delegate(body.section) as any).updateMany({
    where: { id: body.id, userId: user.id },
    data,
  });
  return NextResponse.json({ ok: res.count > 0 });
}

// DELETE { section, id } — remove an entry (ownership-checked).
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || !isSection(body.section) || typeof body.id !== "string") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (delegate(body.section) as any).deleteMany({ where: { id: body.id, userId: user.id } });
  return NextResponse.json({ ok: true });
}