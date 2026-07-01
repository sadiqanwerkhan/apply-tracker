export type TimelineEntry = {
  date: string;    // ISO yyyy-mm-dd, when this stage was first reached
  stage: string;   // stage key
  subject: string;
  reason?: string; // short "why" (only meaningful on a rejected entry)
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
  currentStage: string;       // latest stage key (collapsed row)
  timeline: TimelineEntry[];  // ordered journey (expandable view)
  rejectionReason: string;    // AI "why" summary, when rejected
};

export type StatusFilter = "All" | "Advancing" | "Pending" | "Rejected";

// Human-readable labels for stage keys, shared by aggregation and the UI.
export const STAGE_LABELS: Record<string, string> = {
  applied: "Applied",
  screening: "Phone screen",
  assessment: "Assessment",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  update: "Update",
};