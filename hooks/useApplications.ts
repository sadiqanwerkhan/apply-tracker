"use client";

import { useState, useMemo, useEffect } from "react";
import { Row, StatusFilter } from "@/lib/types";

const PAGE_SIZE = 20;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
const TODAY = isoDate(new Date());
const SIXTY_AGO = isoDate(new Date(Date.now() - 60 * 86400000));

/**
 * Holds all application state and logic: scanning, filtering,
 * sorting, and pagination. The UI components just read from this.
 */
export function useApplications() {
  const [startDate, setStartDate] = useState(SIXTY_AGO);
  const [endDate, setEndDate] = useState(TODAY);

  const [rows, setRows] = useState<Row[]>([]);
  const [scanning, setScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [sortBy, setSortBy] = useState("date-desc");
  const [page, setPage] = useState(1);

  // whenever a filter changes, jump back to page 1
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortBy]);

  async function runScan() {
    setScanning(true);
    setError("");
    setHasScanned(true);
    setPage(1);
    try {
      const res = await fetch(`/api/scan?start=${startDate}&end=${endDate}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error === "not_connected" ? "Please reconnect Gmail." : "Scan failed. Try again.");
        setRows([]);
      } else {
        setRows(data.rows);
      }
    } catch {
      setError("Scan failed. Try again.");
    } finally {
      setScanning(false);
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

  // filter + search + sort (the one place memoization is genuinely idiomatic)
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
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return {
    startDate, setStartDate, endDate, setEndDate,
    scanning, hasScanned, error,
    search, setSearch, statusFilter, setStatusFilter, sortBy, setSortBy,
    page, setPage, totalPages, pageItems, filtered,
    counts, runScan,
  };
}