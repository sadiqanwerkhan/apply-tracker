"use client";

import { useState } from "react";
import { useApplications } from "@/hooks/useApplications";
import ScanControls from "@/components/ScanControls";
import FilterPills from "@/components/FilterPills";
import SearchSort from "@/components/SearchSort";
import ApplicationsTable from "@/components/ApplicationsTable";
import Pagination from "@/components/Pagination";
import ExportControls from "@/components/ExportControls";
import ScanningQuote from "@/components/ScanningQuote";
import StatsSummary from "@/components/StatsSummary";

type Props = {
  userEmail: string;
  onSignOut: () => Promise<void>;
  onReconnect: () => Promise<void>;
};

export default function Dashboard({ userEmail, onSignOut, onReconnect }: Props) {
  const app = useApplications();
  const busy = app.initialLoading || app.scanning;

  const [reclassifying, setReclassifying] = useState(false);
  const [reclassMsg, setReclassMsg] = useState("");

  async function reclassifyAll() {
    if (!confirm("Re-check all stored emails with the latest classification logic? This won't delete anything.")) return;

    setReclassifying(true);
    setReclassMsg("Re-checking…");

    let cursor: string | null = null;
    let total = 0;

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const res: Response = await fetch("/api/reclassify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cursor }),
        });

        const d = await res.json();

        if (d.error) {
          setReclassMsg("Failed. Try again.");
          break;
        }

        total += d.updated || 0;
        setReclassMsg(`Re-checked… ${total} corrected so far`);

        if (d.done) {
          setReclassMsg(`Done — ${total} emails corrected. Refreshing…`);
          break;
        }

        cursor = d.nextCursor;
      }

      setTimeout(() => window.location.reload(), 1000);
    } catch {
      setReclassMsg("Failed. Try again.");
    } finally {
      setReclassifying(false);
    }
  }

  const emptyMessage =
    app.counts.All === 0
      ? "No applications yet — run a scan to pull them in."
      : "No applications match your filters.";

  return (
    <main className="min-h-screen bg-gray-50 py-6 px-3 sm:py-10 sm:px-4">
      <div className="max-w-6xl mx-auto">
        {app.needsReconnect && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="font-semibold text-amber-900">Your Gmail connection expired</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Reconnect to keep scanning. This just refreshes your Google sign-in — your data stays intact.
              </p>
            </div>

            <form action={onReconnect}>
              <button
                type="submit"
                className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-lg shrink-0"
              >
                Reconnect Gmail
              </button>
            </form>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Apply Tracker
            </h1>
            <p className="text-gray-500 mt-1 text-sm break-words">
              Signed in as {userEmail}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={reclassifyAll}
              disabled={reclassifying}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              {reclassifying ? reclassMsg : "Re-check classifications"}
            </button>

            <form action={onSignOut}>
              <button
                type="submit"
                className="text-sm text-gray-400 hover:text-gray-600 shrink-0"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <ScanControls
          startDate={app.startDate}
          endDate={app.endDate}
          scanning={app.scanning}
          error={app.error}
          progress={app.progress}
          onStart={app.setStartDate}
          onEnd={app.setEndDate}
          onScan={app.runScan}
        />

        {!busy && (
          <StatsSummary
            rows={app.allRows}
            onFilterStatus={(s) => {
              app.setInterviewedOnly(false);
              app.setStatusFilter(s);
            }}
            onFilterInterviewed={() => {
              app.setStatusFilter("All");
              app.setInterviewedOnly(true);
            }}
          />
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
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

          {!busy && app.newCount > 0 && (
            <div className="flex items-center justify-between gap-3 mb-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
              <span className="inline-flex items-center gap-2 text-sm text-blue-800">
                <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                {app.newCount} {app.newCount === 1 ? "application has" : "applications have"} new activity
              </span>

              <button
                onClick={app.markAllSeen}
                className="text-sm font-medium text-blue-700 hover:text-blue-900 shrink-0"
              >
                Mark all as read
              </button>
            </div>
          )}

          <SearchSort
            search={app.search}
            sortBy={app.sortBy}
            scanning={busy}
            onSearch={app.setSearch}
            onSort={app.setSortBy}
          />

          {app.scanning && <ScanningQuote />}

          <ApplicationsTable
            items={app.pageItems}
            allRows={app.allRows}
            scanning={busy}
            emptyMessage={emptyMessage}
            isNewRow={app.isNewRow}
            onSeen={app.markSeen}
          />

          {!busy && (
            <Pagination
              page={app.page}
              totalPages={app.totalPages}
              onChange={app.setPage}
            />
          )}
        </div>
      </div>
    </main>
  );
}