"use client";

import { Row } from "@/lib/types";

type Props = { rows: Row[] };

const INTERVIEW_STAGES = new Set(["screening", "assessment", "interview", "offer"]);

export default function StatsSummary({ rows }: Props) {
  const total = rows.length;
  if (total === 0) return null;

  const advancing = rows.filter((r) => r.status === "Advancing").length;
  const rejected = rows.filter((r) => r.status === "Rejected").length;
  const responded = advancing + rejected;
  const responseRate = Math.round((responded / total) * 100);
  const reachedInterview = rows.filter((r) => r.timeline?.some((t) => INTERVIEW_STAGES.has(t.stage))).length;

  const stats = [
    { label: "Applications", value: String(total), accent: "text-gray-900", ring: "border-gray-200" },
    { label: "Response rate", value: `${responseRate}%`, accent: "text-indigo-600", ring: "border-indigo-100" },
    { label: "Reached interview", value: String(reachedInterview), accent: "text-blue-600", ring: "border-blue-100" },
    { label: "Advancing", value: String(advancing), accent: "text-green-600", ring: "border-green-100" },
    { label: "Rejected", value: String(rejected), accent: "text-red-600", ring: "border-red-100" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 mb-6">
      {stats.map((s) => (
        <div key={s.label} className={`bg-white rounded-xl border ${s.ring} p-3 sm:p-4`}>
          <div className={`text-xl sm:text-2xl font-bold ${s.accent}`}>{s.value}</div>
          <div className="text-xs text-gray-500 mt-1">{s.label}</div>
        </div>
      ))}
    </div>
  );
}