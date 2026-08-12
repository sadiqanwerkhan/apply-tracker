import Link from "next/link";
import { auth } from "@/auth";
import { signIn } from "@/auth";
import LandingPage from "@/components/LandingPage";
import { getSkillStats } from "@/lib/skills/getSkillStats";
import { buildLearningPath } from "@/lib/skills/learningPath";
import { getSkillCompanies } from "@/lib/skills/getSkillCompanies";
import { SkillList } from "@/components/SkillList";
import { StrengthList } from "@/components/StrengthList";

export default async function SkillsPage() {
  const session = await auth();

  if (!session?.user) {
    async function handleSignIn() {
      "use server";
      await signIn("google", { redirectTo: "/skills" });
    }
    return <LandingPage onSignIn={handleSignIn} />;
  }

  const userId = session.user.id as string;
  const stats = await getSkillStats(userId);
  const learningPath = buildLearningPath(stats);
  const companies = await getSkillCompanies(userId);

  const statsBySkill = Object.fromEntries(stats.map((s) => [s.skill, s]));
  const weakSkillNames = new Set(learningPath.map((s) => s.skill));
  // Skills with no weak signals — things you're solid on. Shown separately, quietly.
  const strengths = stats.filter((s) => !weakSkillNames.has(s.skill));

  const hasData = stats.length > 0;
  const totalSignals = stats.reduce((n, s) => n + s.total, 0);

  return (
    <main className="min-h-screen bg-background px-3 py-6 sm:px-4 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-accent hover:underline">← Back to applications</Link>

        <div className="mb-6 mt-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Your skills</h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
            {hasData
              ? "Pulled from your interview analyses and ordered as a study plan — foundations first, biggest gaps prioritized."
              : "Once you analyze a few interviews, the skills that came up will appear here as a ranked study plan."}
          </p>
        </div>

        {!hasData ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-sm font-medium text-foreground">No skill data yet</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Analyze an interview on its detail page to get started.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap gap-4 text-[13px] text-muted-foreground">
              <span><span className="font-semibold text-foreground">{stats.length}</span> skills</span>
              <span><span className="font-semibold text-foreground">{learningPath.length}</span> to work on</span>
              <span><span className="font-semibold text-foreground">{totalSignals}</span> signals</span>
            </div>

            {learningPath.length > 0 && (
              <section className="mb-8">
                <div className="mb-2.5 flex items-baseline justify-between">
                  <h2 className="text-[13px] font-semibold text-foreground">Study plan</h2>
                  <span className="text-[12px] text-muted-foreground">foundations first</span>
                </div>
                <SkillList steps={learningPath} statsBySkill={statsBySkill} companies={companies} />
              </section>
            )}

            {strengths.length > 0 && (
              <section>
                <h2 className="mb-2.5 text-[13px] font-semibold text-foreground">Strengths</h2>
                <StrengthList stats={strengths} companies={companies} />
              </section>
            )}

            <p className="mt-8 text-[12px] leading-relaxed text-muted-foreground">
              Skills are extracted from your interview analyses. The more interviews you analyze, the sharper this gets.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
