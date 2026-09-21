import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { getSkillStats } from "@/lib/skills/getSkillStats";
import { buildLearningPath } from "@/lib/skills/learningPath";
import { getSkillCompanies } from "@/lib/skills/getSkillCompanies";
import { getSkillFrequency } from "@/lib/skills/getSkillFrequency";

// All data the skills page needs, in one call, so the page can fetch it on the
// client and cache it. Moving this off the server render is what makes tab
// switches to the skills page instant after the first visit.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const [stats, companies, frequency] = await Promise.all([
    getSkillStats(user.id),
    getSkillCompanies(user.id),
    getSkillFrequency(user.id),
  ]);
  const learningPath = buildLearningPath(stats);

  return NextResponse.json({ stats, learningPath, companies, frequency });
}