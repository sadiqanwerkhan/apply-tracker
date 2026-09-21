"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { SkillStat } from "@/lib/skills/getSkillStats";
import type { LearningStep } from "@/lib/skills/learningPath";
import type { SkillCompanies } from "@/lib/skills/getSkillCompanies";
import type { SkillFrequency } from "@/lib/skills/getSkillFrequency";
import { SkillList } from "@/components/SkillList";
import { StrengthList } from "@/components/StrengthList";
import { SkillFrequency as SkillFrequencyChart } from "@/components/SkillFrequency";

type SkillsData = {
  stats: SkillStat[];
  learningPath: LearningStep[];
  companies: Record<string, SkillCompanies>;
  frequency: SkillFrequency[];
};

// Client-rendered skills page. Fetches its data through React Query, so the first
// visit loads it and every visit after is instant from cache (with fresh data
// quietly refreshed in the background). This is what makes switching to this tab
// fast, instead of a full server render every time.
export function SkillsView() {
  const { data, isLoading } = useQuery<SkillsData>({
    queryKey: ["skills-data"],
    queryFn: async () => {
      const res = await fetch("/api/skills/data");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    staleTime: 60_000, // treat cached data as fresh for a minute
  });

  const stats = data?.stats ?? [];
  const learningPath = data?.learningPath ?? [];
  const companies = data?.companies ?? {};
  const frequency = data?.frequency ?? [];

  const statsBySkill = Object.fromEntries(stats.map((s) => [s.skill, s]));
  const weakSkillNames = new Set(learningPath.map((s) => s.skill));
  const strengths = stats.filter((s) => !weakSkillNames.has(s.skill));
  const hasData = stats.length > 0;
  const totalSignals = stats.reduce((n, s) => n + s.total, 0);

  return (
    <main className="min-h-screen bg-background px-3 py-6 pb-24 sm:px-4 sm:py-10 md:pb-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-accent hover:underline">← Back to applications</Link>

        <div className="animate-fade-up mb-6 mt-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Your skills</h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
            {hasData
              ? "Pulled from your interview analyses and ordered as a study plan — foundations first, biggest gaps prioritized."
              : "Once you analyze a few interviews, the skills that came up will appear here as a ranked study plan."}
          </p>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">Loading your skills…</p>
          </div>
        ) : !hasData ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-sm font-medium text-foreground">No skill data yet</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Analyze an interview on its detail page to get started.</p>
          </div>
        ) : (
          <>
            <div className="animate-fade-up mb-5 flex flex-wrap gap-4 text-[13px] text-muted-foreground" style={{ animationDelay: "30ms" }}>
              <span><span className="font-semibold text-foreground">{stats.length}</span> skills</span>
              <span><span className="font-semibold text-foreground">{learningPath.length}</span> to work on</span>
              <span><span className="font-semibold text-foreground">{totalSignals}</span> signals</span>
            </div>

            {frequency.length > 0 && (
              <section className="animate-fade-up mb-8" style={{ animationDelay: "60ms" }}>
                <SkillFrequencyChart data={frequency} />
              </section>
            )}

            {learningPath.length > 0 && (
              <section className="animate-fade-up mb-8" style={{ animationDelay: "120ms" }}>
                <div className="mb-2.5 flex items-baseline justify-between">
                  <h2 className="text-[13px] font-semibold text-foreground">Study plan</h2>
                  <span className="text-[12px] text-muted-foreground">foundations first</span>
                </div>
                <SkillList steps={learningPath} statsBySkill={statsBySkill} companies={companies} />
              </section>
            )}

            {strengths.length > 0 && (
              <section className="animate-fade-up" style={{ animationDelay: "180ms" }}>
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
