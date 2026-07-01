"use client";

import { Fragment, useState } from "react";
import { Row, STAGE_LABELS } from "@/lib/types";

type Props = {
  items: Row[];
  scanning: boolean;
  emptyMessage?: string;
};

function statusClasses(status: string) {
  if (status === "Advancing") return "bg-green-100 text-green-700";
  if (status === "Rejected") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}

function stageClasses(stage: string) {
  if (stage === "rejected") return "bg-red-50 text-red-600";
  if (stage === "offer") return "bg-emerald-50 text-emerald-700";
  if (stage === "interview" || stage === "assessment" || stage === "screening") return "bg-blue-50 text-blue-600";
  return "bg-gray-100 text-gray-500";
}

function dotClasses(stage: string) {
  if (stage === "rejected") return "bg-red-500";
  if (stage === "offer") return "bg-emerald-500";
  if (stage === "interview" || stage === "assessment" || stage === "screening") return "bg-blue-500";
  return "bg-gray-400";
}

function Timeline({ row }: { row: Row }) {
  if (!row.timeline || row.timeline.length === 0) {
    return <p className="text-sm text-gray-400 px-6 py-4">No timeline details available.</p>;
  }
  return (
    <div className="px-6 py-5 bg-gray-50">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">Application timeline</p>
      <ol className="relative border-l-2 border-gray-200 ml-2">
        {row.timeline.map((e, idx) => (
          <li key={idx} className="mb-5 last:mb-0 ml-6">
            <span className={`absolute -left-[9px] mt-1 h-4 w-4 rounded-full border-2 border-white ${dotClasses(e.stage)}`} />
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-gray-800">{STAGE_LABELS[e.stage] || "Update"}</span>
              <span className="text-xs text-gray-400">{e.date}</span>
            </div>
            {e.subject && <p className="text-sm text-gray-500 mt-1">{e.subject}</p>}
            {e.stage === "rejected" && e.reason && (
              <p className="text-sm text-red-600 mt-1.5">
                <span className="font-medium">Why:</span> {e.reason}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b border-gray-100">
          <td className="py-4 px-3"><div className="h-3.5 bg-gray-200 rounded animate-pulse" style={{ width: "70%" }} /></td>
          <td className="py-4 px-3"><div className="h-3.5 bg-gray-200 rounded animate-pulse" style={{ width: "85%" }} /></td>
          <td className="py-4 px-3"><div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" /></td>
          <td className="py-4 px-3"><div className="h-3.5 bg-gray-200 rounded animate-pulse" style={{ width: "70%" }} /></td>
          <td className="py-4 px-3"><div className="h-3.5 bg-gray-200 rounded animate-pulse" style={{ width: "70%" }} /></td>
          <td className="py-4 px-3"><div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" /></td>
        </tr>
      ))}
    </>
  );
}

export default function ApplicationsTable({ items, scanning, emptyMessage = "No applications match your filters." }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="py-3 px-3 font-medium">Company</th>
            <th className="py-3 px-3 font-medium">Role</th>
            <th className="py-3 px-3 font-medium">Status</th>
            <th className="py-3 px-3 font-medium">Applied</th>
            <th className="py-3 px-3 font-medium">Last update</th>
            <th className="py-3 px-3 font-medium">Current stage</th>
          </tr>
        </thead>
        <tbody>
          {scanning ? (
            <SkeletonRows />
          ) : (
            items.map((r, i) => {
              const isOpen = expanded === i;
              return (
                <Fragment key={i}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : i)}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="py-3 px-3 font-medium text-gray-900">
                      <span className="inline-flex items-center gap-2">
                        <span className={`text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}>▸</span>
                        {r.company}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-600">{r.role || "—"}</td>
                    <td className="py-3 px-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusClasses(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-500">{r.firstSeen}</td>
                    <td className="py-3 px-3 text-gray-500">{r.lastSeen}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${stageClasses(r.currentStage)}`}>
                        {STAGE_LABELS[r.currentStage] || "Update"}
                      </span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={6} className="p-0 border-b border-gray-100">
                        <Timeline row={r} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
      {!scanning && items.length === 0 && (
        <p className="text-center text-gray-400 py-8">{emptyMessage}</p>
      )}
    </div>
  );
}
