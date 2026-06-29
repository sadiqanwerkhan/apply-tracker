/**
 * Classification logic — ported from the Express version.
 * Keep this separate so we can later swap keyword matching for AI
 * by changing only this file.
 */

export const REJECT_PHRASES = [
  "unfortunately", "we have decided to", "not be moving forward", "will not be proceeding",
  "decided to move forward with other", "other candidates", "not selected", "regret to inform",
  "we will not be progressing", "won't be moving forward", "decided not to proceed",
  "unable to offer", "position has been filled", "pursue other candidates",
  "not be progressing your application", "no longer under consideration",
  "decided to proceed with other",
  "decided not to move forward with your application",
  "not to move forward with your application",
  "decided to proceed with another candidate",
  "proceed with another candidate",
  "moving forward with another candidate",
  "moved forward with another candidate",
  "ended up moving forward with another",
  "move forward with another candidate", "with other candidates", "another applicant",
  "proceed with other candidates", "decided to move forward with another",
  "leider müssen wir ihnen mitteilen", "leider können wir", "haben wir uns für andere",
  "andere kandidaten entschieden", "nicht berücksichtigen", "nicht erfolgreich",
  "anderweitig entschieden", "leider eine absage", "müssen wir ihnen leider",
];

export const ADVANCE_PHRASES = [
  "we would like to invite", "we'd like to invite", "invite you to", "next round", "next step",
  "schedule a call", "schedule an interview", "phone screen", "technical interview",
  "coding challenge", "technical assessment", "take-home", "take home", "live coding",
  "system design", "would like to speak", "would like to meet", "move forward with your application",
  "happy to inform", "pleased to inform", "interview with", "book a time", "set up a call",
  "available for a call", "first interview", "get to know you", "hiring manager",
];

export const CONFIRM_PHRASES = [
  "thank you for applying", "thank you for your application", "we have received your application",
  "application received", "received your application", "thanks for applying", "successfully applied",
  "your application has been received", "we appreciate your interest", "application was sent",
];

const ATS_DOMAINS = [
  "greenhouse.io", "lever.co", "myworkday.com", "workday.com", "smartrecruiters.com",
  "personio.de", "personio.com", "ashbyhq.com", "jobvite.com", "icims.com", "bamboohr.com",
  "recruitee.com", "teamtailor.com", "join.com", "workable.com", "breezy.hr",
  "gmail.com", "googlemail.com", "linkedin.com", "indeed.com", "indeedemail.com",
  "glassdoor.com", "xing.com", "stepstone.de", "notifications.", "noreply.", "no-reply.",
];

export type Status = "Rejected" | "Advancing" | "Confirmed" | "None";

function matchesAny(text: string, list: string[]): boolean {
  return list.some((w) => text.indexOf(w) !== -1);
}

export function classify(text: string): Status {
  if (matchesAny(text, REJECT_PHRASES)) return "Rejected";
  if (matchesAny(text, ADVANCE_PHRASES)) return "Advancing";
  if (matchesAny(text, CONFIRM_PHRASES)) return "Confirmed";
  return "None";
}

export function extractCompany(from: string): { name: string; isAts: boolean; sender: string } {
  if (!from) return { name: "", isAts: false, sender: "" };
  let displayName = "";
  let email = "";
  const m = from.match(/^(.*?)<(.+?)>$/);
  if (m) {
    displayName = m[1].trim().replace(/["']/g, "");
    email = m[2].trim().toLowerCase();
  } else {
    email = from.trim().toLowerCase();
  }

  const domain = email.split("@")[1] || "";
  const isAts = ATS_DOMAINS.some((d) => domain.indexOf(d) !== -1);

  if (domain && !isAts) return { name: cleanDomain(domain), isAts: false, sender: email };
  if (displayName) {
    const cleaned = cleanDisplayName(displayName);
    if (cleaned) return { name: cleaned, isAts: true, sender: email };
  }
  return { name: "", isAts: true, sender: email };
}

export function extractRole(subject: string): string {
  if (!subject) return "";
  const s = subject.replace(/\s+/g, " ").trim();
  const patterns = [
    /applying (?:to|for)(?: the)? (.+?)(?: position| role| at | \(| -|$)/i,
    /application for(?: the)? (.+?)(?: position| role| at | \(| -|$)/i,
    /your application[:\-]\s*(.+?)(?: at | \(| -|$)/i,
    /application received[:\-]\s*(.+?)(?: at | \(| -|$)/i,
    /interview for(?: the)? (.+?)(?: position| role| at | \(| -|$)/i,
    /regarding(?: the)? (.+?)(?: position| role| at | \(| -|$)/i,
  ];
  for (const p of patterns) {
    const mm = s.match(p);
    if (mm && mm[1]) {
      const role = mm[1].trim().replace(/[",.]+$/, "");
      if (role.length >= 3 && role.length <= 60) return capWords(role);
    }
  }
  return "";
}

function cleanDomain(domain: string): string {
  const parts = domain.split(".");
  const noise = ["careers", "jobs", "mail", "email", "no-reply", "noreply", "notifications", "apply", "recruiting", "www", "eu", "us"];
  while (parts.length > 2 && noise.indexOf(parts[0]) !== -1) parts.shift();
  const label = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  return cap(label);
}

function cleanDisplayName(name: string): string {
  const noise = /\b(careers?|recruiting|recruitment|recruiter|talent|hiring|team|hr|people|jobs?|no[- ]?reply|notifications?|via greenhouse|via lever|via workday|the)\b/gi;
  return name.replace(noise, "").replace(/\s+/g, " ").replace(/[|,\-]/g, " ").trim();
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
function capWords(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---- personal / consumer email providers to ignore (not real recruiters) ----
const PERSONAL_DOMAINS = [
  // Google
  "gmail.com", "googlemail.com",
  // Microsoft
  "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com", "live.co.uk", "msn.com",
  // Yahoo
  "yahoo.com", "yahoo.co.uk", "yahoo.de", "ymail.com", "rocketmail.com",
  // Apple
  "icloud.com", "me.com", "mac.com",
  // AOL
  "aol.com",
  // Proton
  "proton.me", "protonmail.com",
  // German consumer providers (common where the user is based)
  "gmx.com", "gmx.de", "gmx.net", "web.de", "t-online.de", "freenet.de", "arcor.de",
  // other consumer mail
  "mail.com", "yandex.com", "yandex.ru", "zoho.com", "tutanota.com", "tuta.io",
];

/**
 * True if the sender is a personal/consumer email address (Gmail, Outlook, etc.),
 * which we treat as personal correspondence rather than a recruiter/company.
 */
export function isPersonalSender(from: string): boolean {
  if (!from) return false;
  const m = from.match(/<(.+?)>/);
  const email = (m ? m[1] : from).trim().toLowerCase();
  const domain = email.split("@")[1] || "";
  return PERSONAL_DOMAINS.includes(domain);
}