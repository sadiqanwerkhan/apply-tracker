import { companyKeysMatch } from "./aggregate";

/**
 * The application-matching cascade, extracted from runScanChunk as a PURE
 * function so it can be unit-tested without a database.
 *
 * Given the user's existing applications and one classified email, decide
 * where the email belongs. The caller performs any DB writes.
 *
 * The cascade (order matters — behavior is identical to the original inline
 * logic in scanChunk):
 *   1. exact role match at a matching company        -> attach
 *   2. email has NO role, company has apps           -> attach to nearest by date
 *   3. email HAS a role, company has a role-less
 *      placeholder app                               -> adopt (caller updates
 *                                                       the placeholder's role)
 *   4. otherwise                                     -> create a new application
 */

export type AppRef = {
  id: string;
  /** normalized company key */
  ck: string;
  /** normalized role key ("" = role-less placeholder) */
  rk: string;
  /** epoch ms of this app's known emails (used for nearest-by-date) */
  dates: number[];
};

export type MatchDecision =
  | { kind: "attach"; appId: string }
  | { kind: "adopt"; appId: string }
  | { kind: "create" };

export function matchApplication(
  apps: AppRef[],
  email: { ck: string; rk: string; date: number }
): MatchDecision {
  const { ck, rk, date } = email;
  const sameCompany = apps.filter((a) => companyKeysMatch(a.ck, ck));

  // 1) exact role match at this company
  if (rk) {
    const exact = sameCompany.find((a) => a.rk === rk);
    if (exact) return { kind: "attach", appId: exact.id };
  }

  // 2) NO role on this email -> attach to the company's nearest application by date
  if (!rk && sameCompany.length > 0) {
    let best = sameCompany[0];
    let bestDist = Infinity;
    for (const a of sameCompany) {
      const d = a.dates.length
        ? Math.min(...a.dates.map((t) => Math.abs(t - date)))
        : Infinity;
      if (d < bestDist) {
        bestDist = d;
        best = a;
      }
    }
    return { kind: "attach", appId: best.id };
  }

  // 3) HAS a role, and this company has a role-less placeholder -> adopt it
  if (rk) {
    const placeholder = sameCompany.find((a) => a.rk === "");
    if (placeholder) return { kind: "adopt", appId: placeholder.id };
  }

  // 4) genuinely a new role (or a new company) -> new application
  return { kind: "create" };
}