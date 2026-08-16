import { useRouter } from "next/navigation";
import { Row, STAGE_LABELS } from "@/lib/types";

// ── Status / stage visual helpers ──
const STATUS_META: Record<string, { pill: string; dot: string }> = {
  Advancing: { pill: "bg-success-muted text-success", dot: "bg-success" },
  Pending: { pill: "bg-warning-muted text-warning", dot: "bg-warning" },
  Rejected: { pill: "bg-danger-muted text-danger", dot: "bg-danger" },
};
export function statusMeta(status: string) {
  return STATUS_META[status] ?? STATUS_META.Pending;
}
export function stageClasses(stage: string) {
  if (stage === "rejected") return "bg-danger-muted text-danger";
  if (stage === "offer") return "bg-success-muted text-success";
  if (stage === "interview" || stage === "assessment" || stage === "screening") return "bg-accent/10 text-accent";
  return "bg-secondary text-muted-foreground";
}
export function dotClasses(stage: string) {
  if (stage === "rejected") return "bg-danger";
  if (stage === "offer") return "bg-success";
  if (stage === "interview" || stage === "assessment" || stage === "screening") return "bg-accent";
  return "bg-muted-foreground";
}

export function initials(name: string) {
  return (
    name
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}

// An application should offer "Interview details & transcripts" only when a real
// interview happened — i.e. a timeline event beyond "applied"/"rejected"/"update".
const NON_INTERVIEW_STAGES = new Set(["applied", "rejected", "update"]);
export function hasRealInterview(row: Row): boolean {
  // Prefer the authoritative signal: does the application actually have interview
  // Stage records in the database? This is set from the Stage table and can't be
  // corrupted by email re-classification. Fall back to the email timeline only
  // when the flag isn't present (older data paths).
  if (row.hasStages) return true;
  return (row.timeline || []).some((t) => !NON_INTERVIEW_STAGES.has(t.stage));
}

// Category labels for the hand-entered round type (mirrors the detail page's options).
export const STAGE_TYPE_LABELS: Record<string, string> = {
  phone_screen: "Phone screen",
  technical: "Technical",
  system_design: "System design",
  cultural_fit: "Cultural fit",
  hr: "HR",
  final: "Final",
  other: "Other",
};

// "Soon" = a scheduled round within the next 2 days that hasn't passed.
const INTERVIEW_SOON_MS = 48 * 60 * 60 * 1000; // 2 days
export function interviewSoon(row: Row, now: number): boolean {
  return row.nextInterviewAt != null && row.nextInterviewAt >= now && row.nextInterviewAt - now <= INTERVIEW_SOON_MS;
}
export function formatInterview(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
export function shortWhen(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

export const CHANNELS = ["LinkedIn", "WhatsApp", "Phone", "Indeed", "Email", "Other"];

const INTERVIEW_STAGE_KEYS = ["screening", "assessment", "interview", "offer"];

// Seed the detail page's stages from the email timeline, then navigate there.
export async function seedAndOpen(row: Row, router: ReturnType<typeof useRouter>) {
  sessionStorage.setItem("appsScroll", String(window.scrollY));
  sessionStorage.setItem("appsExpandedKey", `${row.company}|||${row.role}`);
  const seen = new Set<string>();
  const seedStages: string[] = [];
  for (const t of row.timeline || []) {
    if (INTERVIEW_STAGE_KEYS.includes(t.stage) && !seen.has(t.stage)) {
      seen.add(t.stage);
      seedStages.push(STAGE_LABELS[t.stage] || t.stage);
    }
  }
  try {
    await fetch("/api/applications/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: row.id, seedStages }),
    });
  } catch {
    /* stages will seed on next open */
  }
  router.push(`/application/${row.id}`);
}

// ── Shared button styles ──
export const btnGhost = "text-xs text-muted-foreground hover:text-foreground transition-colors";

const triggerBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors";
export function triggerClass(active: boolean) {
  return `${triggerBtn} ${
    active
      ? "border-accent bg-accent/10 text-accent"
      : "border-border bg-card text-foreground/80 hover:bg-secondary hover:text-foreground"
  }`;
}