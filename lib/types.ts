export type TimelineEntry = {
  date: string;
  stage: string;
  subject: string;
  reason?: string;
  label?: string;
};

export type Row = {
  id: string;              // stable Application id
  company: string;
  role: string;
  status: string;
  confidence: string;
  sender: string;
  firstSeen: string;
  lastSeen: string;
  lastActivityAt: number;
  // Soonest upcoming interview that still has no transcript — the round the user
  // scheduled on the detail page. null/undefined when there's no scheduled,
  // unfilled, future round. Optional so aggregateApplications needn't set them —
  // rows.ts fills them in.
  nextInterviewAt?: number | null;   // ms epoch
  nextInterviewName?: string | null; // the round's name, e.g. "Recruiter call"
  nextInterviewType?: string | null; // the round's category, e.g. "phone_screen"
  note: string;
  currentStage: string;
  timeline: TimelineEntry[];
  rejectionReason: string;
  manual: boolean;
  manualChannel: string;
  merged: boolean;
  mergedWith: string[];
};

export type StatusFilter = "All" | "Advancing" | "Pending" | "Rejected";

export const STAGE_LABELS: Record<string, string> = {
  applied: "Applied",
  screening: "Phone screen",
  assessment: "Assessment",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  update: "Update",
};