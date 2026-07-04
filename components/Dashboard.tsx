"use client";

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
};

export default function Dashboard({ userEmail, onSignOut }: Props) {
  const app = useApplications();
  const busy = app.initialLoading || app.scanning;

  const emptyMessage =
    app.counts.All === 0
      ? "No applications yet — run a scan to pull them in."
      : "No applications match your filters.";

  return (
    <main className="min-h-screen bg-gray-50 py-6 px-3 sm:py-10 sm:px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Apply Tracker</h1>
            <p className="text-gray-500 mt-1 text-sm break-words">Signed in as {userEmail}</p>
          </div>
          <form action={onSignOut}>
            <button type="submit" className="text-sm text-gray-400 hover:text-gray-600 shrink-0">Sign out</button>
          </form>
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

        {!busy && <StatsSummary rows={app.allRows} />}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
            <FilterPills active={app.statusFilter} counts={app.counts} scanning={busy} onChange={app.setStatusFilter} />
            {!busy && (
              <ExportControls allRows={app.allRows} visibleRows={app.filtered} statusFilter={app.statusFilter} search={app.search} />
            )}
          </div>

          <SearchSort search={app.search} sortBy={app.sortBy} scanning={busy} onSearch={app.setSearch} onSort={app.setSortBy} />
          {app.scanning && <ScanningQuote />}
          <ApplicationsTable items={app.pageItems} allRows={app.allRows} scanning={busy} emptyMessage={emptyMessage} />
          {!busy && <Pagination page={app.page} totalPages={app.totalPages} onChange={app.setPage} />}
        </div>
      </div>
    </main>
  );
}