import { describe, it, expect } from "vitest";
import { matchApplication, AppRef } from "./matchApplication";

// Helpers keep the tests readable.
const app = (id: string, ck: string, rk: string, dates: number[] = []): AppRef => ({
  id, ck, rk, dates,
});
const DAY = 86_400_000;

describe("matchApplication — the application-attachment cascade", () => {
  // ── step 1: exact role match ────────────────────────────────────────────────
  it("attaches to the app with the exact same company + role", () => {
    const apps = [app("a1", "tesla", "frontend engineer"), app("a2", "tesla", "backend engineer")];
    const d = matchApplication(apps, { ck: "tesla", rk: "backend engineer", date: 0 });
    expect(d).toEqual({ kind: "attach", appId: "a2" });
  });

  it("matches companies fuzzily (word-prefix), so 'tesla' matches 'tesla germany'", () => {
    const apps = [app("a1", "tesla germany", "frontend engineer")];
    const d = matchApplication(apps, { ck: "tesla", rk: "frontend engineer", date: 0 });
    expect(d).toEqual({ kind: "attach", appId: "a1" });
  });

  it("does NOT cross-match different companies", () => {
    const apps = [app("a1", "tesla", "frontend engineer")];
    const d = matchApplication(apps, { ck: "siemens", rk: "frontend engineer", date: 0 });
    expect(d).toEqual({ kind: "create" });
  });

  // ── step 2: role-less email -> nearest by date ─────────────────────────────
  it("attaches a role-less email to the company's nearest application by date", () => {
    const apps = [
      app("old", "tesla", "frontend engineer", [0]),            // day 0
      app("new", "tesla", "backend engineer", [10 * DAY]),      // day 10
    ];
    // email on day 9 -> closer to "new"
    const d = matchApplication(apps, { ck: "tesla", rk: "", date: 9 * DAY });
    expect(d).toEqual({ kind: "attach", appId: "new" });
  });

  it("role-less email with several candidate dates uses each app's closest email", () => {
    const apps = [
      app("a1", "tesla", "frontend engineer", [0, 20 * DAY]),   // closest: day 20 -> dist 1
      app("a2", "tesla", "backend engineer", [15 * DAY]),       // dist 6
    ];
    const d = matchApplication(apps, { ck: "tesla", rk: "", date: 21 * DAY });
    expect(d).toEqual({ kind: "attach", appId: "a1" });
  });

  it("role-less email still attaches (to the first app) when no app has any dates", () => {
    const apps = [app("a1", "tesla", "frontend engineer"), app("a2", "tesla", "backend engineer")];
    const d = matchApplication(apps, { ck: "tesla", rk: "", date: 5 * DAY });
    expect(d).toEqual({ kind: "attach", appId: "a1" });
  });

  it("a role-less email NEVER creates a new application when the company exists", () => {
    const apps = [app("a1", "tesla", "frontend engineer", [0])];
    const d = matchApplication(apps, { ck: "tesla", rk: "", date: 400 * DAY });
    expect(d.kind).toBe("attach");
  });

  it("a role-less email for an unknown company creates a new application", () => {
    const apps = [app("a1", "tesla", "frontend engineer", [0])];
    const d = matchApplication(apps, { ck: "unknown company", rk: "", date: 0 });
    expect(d).toEqual({ kind: "create" });
  });

  // ── step 3: adopt a role-less placeholder ──────────────────────────────────
  it("a roled email adopts the company's role-less placeholder instead of duplicating", () => {
    const apps = [app("ph", "tesla", "", [0])];
    const d = matchApplication(apps, { ck: "tesla", rk: "frontend engineer", date: DAY });
    expect(d).toEqual({ kind: "adopt", appId: "ph" });
  });

  it("prefers an exact role match over adopting a placeholder", () => {
    const apps = [app("ph", "tesla", ""), app("fe", "tesla", "frontend engineer")];
    const d = matchApplication(apps, { ck: "tesla", rk: "frontend engineer", date: 0 });
    expect(d).toEqual({ kind: "attach", appId: "fe" });
  });

  // ── step 4: new application ────────────────────────────────────────────────
  it("a genuinely new role at an existing company creates a second application", () => {
    const apps = [app("fe", "tesla", "frontend engineer")];
    const d = matchApplication(apps, { ck: "tesla", rk: "staff engineer", date: 0 });
    expect(d).toEqual({ kind: "create" });
  });

  it("empty app list always creates", () => {
    expect(matchApplication([], { ck: "tesla", rk: "x", date: 0 })).toEqual({ kind: "create" });
    expect(matchApplication([], { ck: "tesla", rk: "", date: 0 })).toEqual({ kind: "create" });
  });
});