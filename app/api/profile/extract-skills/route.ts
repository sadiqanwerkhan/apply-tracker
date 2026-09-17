import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { SKILL_DB } from "@/lib/skills/skillKnowledge";

// Scans the user's work-experience descriptions for skills from the known-skill
// database, and returns the ones they haven't already added. Keyword matching
// against SKILL_DB — instant, free, reliable (no AI). Each suggestion carries its
// CV group so it can be added pre-categorized.

// Map a knowledge-base category to one of the three CV groups.
function toGroup(category: string): string {
  return category === "Languages" ? "language" : "technology";
}

// Build the searchable term list: every canonical skill name + its aliases,
// paired with the canonical entry.
const TERMS: { term: string; name: string; group: string }[] = [];
for (const [canonical, entry] of Object.entries(SKILL_DB)) {
  const display = canonical
    .split(/[\s.]/).map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
  TERMS.push({ term: canonical, name: display, group: toGroup(entry.category) });
  for (const a of entry.aliases || []) TERMS.push({ term: a.toLowerCase(), name: display, group: toGroup(entry.category) });
}

// Word-boundary match so "go" doesn't match "google" and "react" matches cleanly.
function mentioned(term: string, haystack: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const [work, existingSkills] = await Promise.all([
    prisma.workExperience.findMany({ where: { userId: user.id }, select: { description: true } }),
    prisma.skill.findMany({ where: { userId: user.id }, select: { name: true } }),
  ]);

  const corpus = work.map((w) => w.description || "").join("\n").toLowerCase();
  if (corpus.trim().length < 20) {
    return NextResponse.json({ suggestions: [], reason: "no_descriptions" });
  }

  const have = new Set(existingSkills.map((s) => s.name.trim().toLowerCase()));

  // Find mentioned skills, dedupe by canonical display name, skip ones already added.
  const found = new Map<string, { name: string; group: string }>();
  for (const t of TERMS) {
    const key = t.name.toLowerCase();
    if (have.has(key) || found.has(key)) continue;
    if (mentioned(t.term, corpus)) found.set(key, { name: t.name, group: t.group });
  }

  return NextResponse.json({ suggestions: [...found.values()] });
}
