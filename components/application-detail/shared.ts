import type { ReactNode } from "react";

// ── Shared types for the ApplicationDetail component and its sub-parts ──
export type Insights = {
  techStack?: string[];
  teamSize?: string;
  teamStructure?: string;
  product?: string;
  payRange?: string;
  nextSteps?: string;
  notes?: string[];
};
export type TranscriptT = { id: string; label: string | null; content: string };
export type StageT = {
  id: string;
  name: string;
  type: string;
  order: number;
  result: string | null;
  scheduledAt: string | null;
  transcripts: TranscriptT[];
};
export type AppT = {
  id: string;
  company: string;
  role: string;
  analysis: string | null;
  analysisAt: string | null;
  insights: Insights | null;
  insightsAt: string | null;
  jobTitle: string | null;
  jobLocation: string | null;
  jobDescription: string | null;
  stages: StageT[];
};
export type Prep = {
  encouragement?: string;
  focusAreas?: string[];
  questionsToAsk?: string[];
  watchOuts?: string[];
};

// A single fetch helper passed down to stage/transcript children.
export type Caller = (url: string, method: string, body: object) => Promise<void>;

export type AnalysisSection = { type: string; points: string[] };
export type Readiness = { band: string; reason?: string };
export type ParsedAnalysis = { readiness?: Readiness; headline?: string; sections: AnalysisSection[] };

// ── Shared UI constants ──
export const STAGE_TYPES: { value: string; label: string }[] = [
  { value: "phone_screen", label: "Phone / Recruiter Screen" },
  { value: "technical", label: "Technical" },
  { value: "system_design", label: "System Design" },
  { value: "cultural_fit", label: "Cultural Fit" },
  { value: "hr", label: "HR" },
  { value: "final", label: "Final / Leadership" },
  { value: "other", label: "Other" },
];

export function stageTypeLabel(v: string) {
  return STAGE_TYPES.find((t) => t.value === v)?.label || "Other";
}

// Format a stored ISO date for a <input type="datetime-local"> (local wall-clock, no timezone).
export function toLocalInput(d: string | Date | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export const fieldBase =
  "rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/70 focus:border-accent focus:ring-4 focus:ring-accent/12";
export const btnPrimary =
  "rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-sm transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-60";

// re-export for convenience where a ReactNode value list is built
export type { ReactNode };