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