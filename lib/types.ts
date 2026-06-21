export type Row = {
  company: string;
  role: string;
  status: string;
  confidence: string;
  sender: string;
  firstSeen: string;
  lastSeen: string;
  note: string;
};

export type StatusFilter = "All" | "Advancing" | "Pending" | "Rejected";