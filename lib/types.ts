export type TimelineEntry = {
  date: string;
  stage: string;
  subject: string;
  reason?: string;
  label?: string; // custom label override (used for manual outcomes)
};

export type Row = {
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
  manual: boolean;        // true if a manual outcome has been applied
  manualChannel: string;  // channel of the manual outcome, if any
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