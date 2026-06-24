"use client";

import { Row, StatusFilter } from "@/lib/types";
import ExportMenu from "@/components/ExportMenu";
import { runExport, ExportFormat } from "@/lib/exporters";

type Props = {
  allRows: Row[];
  visibleRows: Row[];
  statusFilter: StatusFilter;
  search: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExportControls({ allRows, visibleRows, statusFilter, search }: Props) {
  const showingEverything = statusFilter === "All" && search.trim() === "";
  const scope = statusFilter !== "All" ? statusFilter.toLowerCase() : "results";

  function exportAll(format: ExportFormat) {
    return runExport(format, allRows, `apply-tracker-all-${today()}`);
  }
  function exportVisible(format: ExportFormat) {
    return runExport(format, visibleRows, `apply-tracker-${scope}-${today()}`);
  }

  if (showingEverything) {
    return <ExportMenu label="Export" count={allRows.length} primary onExport={exportAll} />;
  }

  const visibleLabel = statusFilter !== "All" ? `Export ${statusFilter.toLowerCase()}` : "Export results";

  return (
    <div className="flex items-center gap-2">
      <ExportMenu label="Export all" count={allRows.length} onExport={exportAll} />
      <ExportMenu label={visibleLabel} count={visibleRows.length} primary onExport={exportVisible} />
    </div>
  );
}
