import { describe, it, expect } from "vitest";
import {
  normalizeCompanyKey,
  normalizeRoleKey,
  companyKeysMatch,
  aggregateApplications,
  type AppRecord,
} from "@/lib/aggregate";

describe("normalizeCompanyKey", () => {
  it("lowercases and trims", () => {
    expect(normalizeCompanyKey("  Tesla  ")).toBe("tesla");
  });

  it("strips legal suffixes", () => {
    expect(normalizeCompanyKey("Contexxt AG")).toBe("contexxt");
    expect(normalizeCompanyKey("Trusted Shops SE")).toBe("trusted shops");
    expect(normalizeCompanyKey("Acme GmbH")).toBe("acme");
  });

  it("strips country/region suffixes", () => {
    expect(normalizeCompanyKey("SAP Deutschland")).toBe("sap");
  });

  it("strips parenthetical content", () => {
    expect(normalizeCompanyKey("Google (EMEA)")).toBe("google");
  });

  it("never returns empty for a real name made only of suffixes", () => {
    // guards the fallback branch — a name that is all suffix words
    expect(normalizeCompanyKey("Tech")).toBeTruthy();
  });
});

describe("normalizeRoleKey", () => {
  it("collapses whitespace and hyphenation so variants match", () => {
    // this exact case caused the IXOPAY transcript-orphaning bug
    expect(normalizeRoleKey("Front-End Engineer")).toBe(normalizeRoleKey("Frontend Engineer"));
  });

  it("strips gender markers", () => {
    expect(normalizeRoleKey("Software Engineer (m/w/d)")).toBe("softwareengineer");
    expect(normalizeRoleKey("Developer all genders")).toBe("developer");
  });

  it("is case-insensitive", () => {
    expect(normalizeRoleKey("SENIOR Engineer")).toBe(normalizeRoleKey("senior engineer"));
  });
});

describe("companyKeysMatch", () => {
  it("matches a company with its longer location variant", () => {
    // Tesla vs Tesla Giga Berlin — the company-variant bug
    expect(companyKeysMatch("tesla", "tesla giga berlin")).toBe(true);
    expect(companyKeysMatch("eterno", "eterno health")).toBe(true);
  });

  it("matches identical keys", () => {
    expect(companyKeysMatch("stripe", "stripe")).toBe(true);
  });

  it("does NOT match different companies sharing a first word", () => {
    // the critical safety case — must never merge these
    expect(companyKeysMatch("deutsche bank", "deutsche telekom")).toBe(false);
  });

  it("does not match on empty input", () => {
    expect(companyKeysMatch("", "tesla")).toBe(false);
    expect(companyKeysMatch("tesla", "")).toBe(false);
  });
});

// ── helpers for building aggregate() inputs ──────────────────────────────────
const DAY = 86400000;
function email(overrides: Partial<AppRecord["emails"][number]> = {}) {
  return {
    company: "Tesla", role: "Engineer", sender: "jobs@tesla.com", isAts: false,
    status: "Pending", stage: "applied", date: 1_700_000_000_000, subject: "x", summary: null,
    ...overrides,
  };
}
function appRecord(overrides: Partial<AppRecord> = {}): AppRecord {
  return {
    id: "app1", company: "Tesla", role: "Engineer",
    manualStatus: null, manualChannel: null, manualReason: null, manualDate: null,
    mergedIntoId: null, emails: [email()],
    ...overrides,
  };
}

describe("aggregateApplications — status derivation", () => {
  it("marks an application with only an applied email as Pending", () => {
    const rows = aggregateApplications([appRecord()]);
    expect(rows[0].status).toBe("Pending");
  });

  it("marks Advancing when an interview email exists", () => {
    const rows = aggregateApplications([
      appRecord({ emails: [email({ status: "Advancing", stage: "interview" })] }),
    ]);
    expect(rows[0].status).toBe("Advancing");
  });

  it("a rejection wins over an earlier advance (the app must not lie)", () => {
    const rows = aggregateApplications([
      appRecord({
        emails: [
          email({ status: "Advancing", stage: "interview", date: 1_700_000_000_000 }),
          email({ status: "Rejected", stage: "rejected", date: 1_700_000_000_000 + DAY }),
        ],
      }),
    ]);
    expect(rows[0].status).toBe("Rejected");
  });
});

describe("aggregateApplications — merging", () => {
  it("folds a merged application into its root and pools the emails", () => {
    const root = appRecord({ id: "root", company: "Tesla" });
    const child = appRecord({
      id: "child", company: "Tesla", mergedIntoId: "root",
      emails: [email({ status: "Rejected", stage: "rejected" })],
    });
    const rows = aggregateApplications([root, child]);
    // one visible row (child folded in), and the rejection from the child counts
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("Rejected");
  });
});

describe("aggregateApplications — manual outcome overrides", () => {
  it("a manual Rejected outcome overrides the derived status", () => {
    const rows = aggregateApplications([
      appRecord({
        manualStatus: "Rejected",
        manualChannel: "LinkedIn",
        manualDate: 1_700_000_000_000 + DAY,
        emails: [email({ status: "Advancing", stage: "interview" })],
      }),
    ]);
    expect(rows[0].status).toBe("Rejected");
    expect(rows[0].manual).toBe(true);
  });
});