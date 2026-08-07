"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Row, StatusFilter } from "@/lib/types";

const PAGE_SIZE = 20;
const SEEN_KEY = "appsSeenActivity";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
const TODAY = isoDate(new Date());
const SIXTY_AGO = isoDate(new Date(Date.now() - 60 * 86400000));

const VALID_STATUS: StatusFilter[] = ["All", "Advancing", "Pending", "Rejected"];

// Real activity time for a row. Falls back to parsing the date string for rows
// that only have a manual outcome (no email timestamp).
function activityTime(r: Row): number {
  if (r.lastActivityAt) return r.lastActivityAt;
  const t = new Date(`${r.lastSeen}T00:00:00`).getTime();
  return Number.isNaN(t) ? 0 : t;
}

const INTERVIEW_SOON_MS = 48 * 60 * 60 * 1000; // 2 days

// If a row has an imminent, unfilled interview (within 2 days and not yet passed),
// return its timestamp so it can be floated to the top; otherwise null.
function interviewSoonAt(r: Row, now: number): number | null {
  if (r.nextInterviewAt == null) return null;
  if (r.nextInterviewAt < now) return null;
  if (r.nextInterviewAt - now > INTERVIEW_SOON_MS) return null;
  return r.nextInterviewAt;
}

export function useApplications() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [progress, setProgress] = useState<{ processed: number; remaining: number } | null>(null);
  const [startDate, setStartDate] = useState(SIXTY_AGO);
  const [endDate, setEndDate] = useState(TODAY);
  const [interviewedOnly, setInterviewedOnly] = useState(false);

  const [rows, setRows] = useState<Row[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [needsReconnect, setNeedsReconnect] = useState(false);

  // Ticks every minute so imminent-interview rows re-sort to the top as their
  // 2-day window opens or closes, without a page reload.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // ── "New activity" tracking ──────────────────────────────────────────────
  // Per-application seen state: applicationId -> the activity timestamp at the
  // moment the row was last opened. A row is "new" when its latest activity is
  // newer than that. This survives refreshes (unlike a global last-viewed
  // clock) and re-highlights a company when fresh mail arrives.
  // null = not loaded yet, so nothing highlights during the initial load.
  const [seen, setSeen] = useState<Record<string, number> | null>(null);
  const pendingBaseline = useRef(false);

  function persistSeen(next: Record<string, number>) {
    setSeen(next);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    } catch {
      // localStorage unavailable — highlights just won't persist
    }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      if (raw) {
        setSeen(JSON.parse(raw));
        return;
      }
    } catch {
      // fall through to baseline
    }
    // First ever use: wait for rows, then mark everything as already seen so
    // the user isn't greeted by 170 highlighted rows.
    pendingBaseline.current = true;
  }, []);

  useEffect(() => {
    if (!pendingBaseline.current || rows.length === 0) return;
    pendingBaseline.current = false;
    const base: Record<string, number> = {};
    for (const r of rows) base[r.id] = activityTime(r);
    persistSeen(base);
  }, [rows]);

  function markSeen(id: string) {
    if (!seen) return;
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const t = activityTime(row);
    if (seen[id] === t) return; // already up to date
    persistSeen({ ...seen, [id]: t });
  }

  function isNewRow(r: Row): boolean {
    if (!seen) return false;
    const seenAt = seen[r.id];
    if (seenAt === undefined) return true; // an application you've never seen
    return activityTime(r) > seenAt;
  }

  function markAllSeen() {
    const next: Record<string, number> = { ...(seen || {}) };
    for (const r of rows) next[r.id] = activityTime(r);
    persistSeen(next);
  }
  // ─────────────────────────────────────────────────────────────────────────

  // initialize filter/search/sort FROM the URL so returning restores them
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [statusFilter, setStatusFilterState] = useState<StatusFilter>(
    VALID_STATUS.includes(searchParams.get("status") as StatusFilter)
      ? (searchParams.get("status") as StatusFilter)
      : "All"
  );
  const [sortBy, setSortBy] = useState(searchParams.get("sort") || "date-desc");
  const [page, setPage] = useState(1);

  // write filter/search/sort into the URL — but NOT on the first render
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (statusFilter !== "All") params.set("status", statusFilter);
    if (sortBy !== "date-desc") params.set("sort", sortBy);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [search, statusFilter, sortBy, pathname, router]);

  // load stored applications on first render
  useEffect(() => {
    fetch("/api/applications")
      .then((r) => r.json())
      .then((d) => {
        if (d.rows) setRows(d.rows);
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, []);

  // restore scroll position after the list has loaded (set when opening a detail page)
  useEffect(() => {
    if (initialLoading) return;
    const saved = sessionStorage.getItem("appsScroll");
    if (saved) {
      const y = parseInt(saved, 10);
      sessionStorage.removeItem("appsScroll");
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
  }, [initialLoading]);

  async function runScan() {
    setScanning(true);
    setError("");
    setNeedsReconnect(false);
    setProgress(null);
    setPage(1);
    setSearch("");
    setStatusFilterState("All");
    setSortBy("date-desc");

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: startDate, end: endDate }),
      });
      const data = await res.json();

      if (!res.ok || data.error || !data.jobId) {
        setError("Could not start the scan. Please try again.");
        setScanning(false);
        return;
      }

      const jobId: string = data.jobId;
      let guard = 0;

      // Poll until the job finishes. The browser can close — the job keeps running.
      while (guard < 600) {
        guard++;
        await new Promise((r) => setTimeout(r, 2000));

        const withRows = guard % 5 === 0;
        const s = await fetch(`/api/scan/status?jobId=${jobId}${withRows ? "&rows=1" : ""}`);        // Only skip on a genuine HTTP failure of the status endpoint itself.
        // A FAILED job carries an error field — that's the signal we act on below.
        if (!s.ok) continue;
        const j = await s.json();

        if (j.rows) setRows(j.rows);
        setProgress({ processed: j.processed || 0, remaining: j.remaining || 0 });
        if (j.truncated) {
          setError("Reached the 1000 email limit — narrow your date range to see everything.");
        }

        if (j.status === "complete") break;
        if (j.status === "failed") {
          if (j.error === "reconnect_required") {
            setNeedsReconnect(true);
            setError("");
          } else {
            setError(j.error || "Scan failed. Please try again.");
          }
          break;
        }
      }
    } catch {
      setError("Scan failed. Please try again.");
    } finally {
      setScanning(false);
      setProgress(null);
    }
  }

  const counts = useMemo(
    () => ({
      All: rows.length,
      Advancing: rows.filter((r) => r.status === "Advancing").length,
      Pending: rows.filter((r) => r.status === "Pending").length,
      Rejected: rows.filter((r) => r.status === "Rejected").length,
    }),
    [rows]
  );

  const filtered = useMemo(() => {
    const INTERVIEW_STAGES = new Set(["screening", "assessment", "interview", "offer"]);
    return rows
      .filter((r) => statusFilter === "All" || r.status === statusFilter)
      .filter((r) => !interviewedOnly || (r.timeline || []).some((t) => INTERVIEW_STAGES.has(t.stage)))
      .filter((r) => r.company.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        // Imminent interviews (within 2 days, still unfilled) float to the very top,
        // soonest first — regardless of the chosen sort. Once the interview passes or
        // a transcript is added, the row drops back into the normal order.
        const ia = interviewSoonAt(a, now);
        const ib = interviewSoonAt(b, now);
        if (ia !== null && ib !== null) return ia - ib;
        if (ia !== null) return -1;
        if (ib !== null) return 1;

        if (sortBy === "company-asc") return a.company.localeCompare(b.company);
        // Sort by the REAL timestamp so same-day items order by time of arrival.
        if (sortBy === "date-asc") return activityTime(a) - activityTime(b);
        return activityTime(b) - activityTime(a);
      });
  }, [rows, statusFilter, search, sortBy, interviewedOnly, now]);

  const newCount = useMemo(
    () => filtered.filter((r) => isNewRow(r)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, seen]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // clamp the page to the valid range during render (no effect, no setState-in-effect)
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // when the user changes a filter/search/sort, reset to page 1 at the event source
  function updateSearch(v: string) { setSearch(v); setPage(1); }
  function updateStatusFilter(v: StatusFilter) { setStatusFilterState(v); setPage(1); }
  function updateSortBy(v: string) { setSortBy(v); setPage(1); }

  return {
    startDate, setStartDate, endDate, setEndDate,
    initialLoading, scanning, error,
    search, setSearch: updateSearch,
    statusFilter, setStatusFilter: updateStatusFilter,
    sortBy, setSortBy: updateSortBy,
    page: safePage, setPage, totalPages, pageItems, filtered,
    allRows: rows,
    counts, runScan, progress,
    interviewedOnly, setInterviewedOnly,
    needsReconnect,
    isNewRow, markSeen, markAllSeen, newCount,
  };
}