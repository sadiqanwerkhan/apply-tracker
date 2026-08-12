import Link from "next/link";
import { auth } from "@/auth";
import LandingPage from "@/components/LandingPage";
import { signIn } from "@/auth";
import { getSkillStats } from "@/lib/skills/getSkillStats";
import { SkillBars } from "@/components/SkillBars";
import { LearningPath } from "@/components/LearningPath";
import { buildLearningPath } from "@/lib/skills/learningPath";
import { getSkillCompanies } from "@/lib/skills/getSkillCompanies";

export default async function SkillsPage() {
  const session = await auth();

  if (!session?.user) {
    async function handleSignIn() {
      "use server";
      await signIn("google", { redirectTo: "/skills" });
    }
    return <LandingPage onSignIn={handleSignIn} />;
  }

  const stats = await getSkillStats(session.user.id as string);
  const learningPath = buildLearningPath(stats);
  const companies = await getSkillCompanies(session.user.id as string);
  const totalSignals = stats.reduce((n, s) => n + s.total, 0);
  const interviewsWithData = stats.length > 0;

  return (
    <main className="min-h-screen bg-background px-3 py-6 sm:px-4 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-accent hover:underline">← Back to applications</Link>

        <div className="mb-8 mt-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Your skills</h1>
          <p className="mt-1 text-muted-foreground">
            {interviewsWithData
              ? "Ranked by where you struggled most across your interviews — your biggest weaknesses first."
              : "Skills pulled from your interview analyses will show up here."}
          </p>
        </div>

        {interviewsWithData && (
          <div className="mb-6 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-secondary px-3 py-1">{stats.length} skills tracked</span>
            <span className="rounded-full bg-secondary px-3 py-1">{totalSignals} signals</span>
          </div>
        )}

        {learningPath.length > 0 && (
          <div className="mb-6">
            <LearningPath steps={learningPath} companies={companies} />
          </div>
        )}

        <h2 className="label-mono mb-3 text-[10px] text-muted-foreground">All skills, ranked by weakness</h2>
        <SkillBars stats={stats} companies={companies} />

        {interviewsWithData && (
          <p className="mt-8 text-[11px] text-muted-foreground">
            Skills are extracted from your interview analyses. The more interviews you analyze, the sharper this gets.
          </p>
        )}
      </div>
    </main>
  );
}
