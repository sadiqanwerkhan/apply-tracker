"use client";

import { useState, useEffect } from "react";
import { useApplications } from "@/hooks/useApplications";
import ScanControls from "@/components/ScanControls";
import FilterPills from "@/components/FilterPills";
import SearchSort from "@/components/SearchSort";
import ApplicationsTable from "@/components/ApplicationsTable";
import Pagination from "@/components/Pagination";
import ExportControls from "@/components/ExportControls";

export default function Home() {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);

  const app = useApplications();
  const busy = app.initialLoading || app.scanning;

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((d) => {
        setConnected(d.connected);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  async function connectGmail() {
    const res = await fetch("/api/auth/url");
    const { url } = await res.json();
    window.location.href = url;
  }

  if (checking) {
    return <main className="min-h-screen flex items-center justify-center text-gray-500">Loading…</main>;
  }

  if (!connected) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Apply Tracker</h1>
          <p className="text-gray-500 mb-6">
            Connect your Gmail to scan and track your job applications automatically.
          </p>
          <button
            onClick={connectGmail}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 rounded-xl transition"
          >
            Connect Gmail
          </button>
        </div>
      </main>
    );
  }

  const emptyMessage =
    app.counts.All === 0
      ? "No applications yet — run a scan to pull them in."
      : "No applications match your filters.";

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Apply Tracker</h1>
            <p className="text-gray-500 mt-1">Your job applications, sorted automatically.</p>
          </div>
          <a href="/api/auth/logout" className="text-sm text-gray-400 hover:text-gray-600">
            Disconnect
          </a>
        </div>

        <ScanControls
          startDate={app.startDate}
          endDate={app.endDate}
          scanning={app.scanning}
          error={app.error}
          onStart={app.setStartDate}
          onEnd={app.setEndDate}
          onScan={app.runScan}
        />

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <FilterPills
              active={app.statusFilter}
              counts={app.counts}
              scanning={busy}
              onChange={app.setStatusFilter}
            />
            {!busy && (
              <ExportControls
                allRows={app.allRows}
                visibleRows={app.filtered}
                statusFilter={app.statusFilter}
                search={app.search}
              />
            )}
          </div>

          <SearchSort
            search={app.search}
            sortBy={app.sortBy}
            scanning={busy}
            onSearch={app.setSearch}
            onSort={app.setSortBy}
          />
          <ApplicationsTable items={app.pageItems} scanning={busy} emptyMessage={emptyMessage} />
          {!busy && <Pagination page={app.page} totalPages={app.totalPages} onChange={app.setPage} />}
        </div>
      </div>
    </main>
  );
}
