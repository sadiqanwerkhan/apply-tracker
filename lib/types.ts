export type TimelineEntry = {
  date: string;   // ISO yyyy-mm-dd, when this stage was first reached
  stage: string;  // stage key
  subject: string;
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
  currentStage: string;       // latest stage key (for the collapsed row)
  timeline: TimelineEntry[];  // ordered journey (for the expandable view, Stage 2)
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