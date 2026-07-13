"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Row, StatusFilter } from "@/lib/types";

const PAGE_SIZE = 20;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
const TODAY = isoDate(new Date());
const SIXTY_AGO = isoDate(new Date(Date.now() - 60 * 86400000));

const VALID_STATUS: StatusFilter[] = ["All", "Advancing", "Pending", "Rejected"];

export function useApplications() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [progress, setProgress] = useState<{ processed: number; remaining: number } | null>(null);
  const [startDate, setStartDate] = useState(SIXTY_AGO);
  const [endDate, setEndDate] = useState(TODAY);

  const [rows, setRows] = useState<Row[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

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

  function setStatusFilter(v: StatusFilter) {
    setStatusFilterState(v);
  }

async function runScan() {
    setScanning(true);
    setError("");
    setProgress(null);
    setPage(1);
    setSearch("");
    setStatusFilterState("All");
    setSortBy("date-desc");

    let totalProcessed = 0;
    let guard = 0; // safety: never loop forever

    try {
      let done = false;
      while (!done && guard < 200) {
        guard++;
        const res = await fetch(`/api/scan?start=${startDate}&end=${endDate}`);
        const data = await res.json();

        if (!res.ok || data.error) {
          setError(data.error === "not_connected" ? "Please reconnect Gmail." : "Scan failed. Try again.");
          break;
        }

        setRows(data.rows);
        totalProcessed += data.processed || 0;
        setProgress({ processed: totalProcessed, remaining: data.remaining || 0 });

        if (data.truncated) {
          setError("Reached the 1000 email limit — narrow your date range to see everything.");
        }
        done = !!data.done;
      }
    } catch {
      setError("Scan failed. Try again.");
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
    return rows
      .filter((r) => statusFilter === "All" || r.status === statusFilter)
      .filter((r) => r.company.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === "company-asc") return a.company.localeCompare(b.company);
        if (sortBy === "date-asc") return a.lastSeen.localeCompare(b.lastSeen);
        return b.lastSeen.localeCompare(a.lastSeen);
      });
  }, [rows, statusFilter, search, sortBy]);

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
  };
}