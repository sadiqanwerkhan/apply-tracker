"use client";

import { Row, StatusFilter } from "@/lib/types";
import {
  Layers,
  TrendingUp,
  CalendarCheck,
  Sparkles,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import AnimatedNumber from "@/components/ui/AnimatedNumber";

type Props = {
  rows: Row[];
  onFilterStatus: (s: StatusFilter) => void;
  onFilterInterviewed: () => void;
};

const INTERVIEW_STAGES = new Set(["screening", "assessment", "interview", "offer"]);

type Tone = "neutral" | "accent" | "success" | "danger";

const TONE: Record<Tone, { icon: string; bar: string }> = {
  neutral: { icon: "text-foreground/70 bg-secondary", bar: "bg-foreground/25" },
  accent: { icon: "text-accent bg-accent/10", bar: "bg-accent" },
  success: { icon: "text-success bg-success-muted", bar: "bg-success" },
  danger: { icon: "text-danger bg-danger-muted", bar: "bg-danger" },
};

function Sparkbars({ bars, className }: { bars: number[]; className: string }) {
  const max = Math.max(...bars, 1);
  return (
    <div className="flex h-7 items-end gap-[3px]" aria-hidden="true">
      {bars.map((b, i) => (
        <span
          key={i}
          style={{ height: `${(b / max) * 100}%`, animationDelay: `${0.3 + i * 0.04}s` }}
          className={`sparkbar w-1 rounded-full ${className}`}
        />
      ))}
    </div>
  );
}

export default function StatsSummary({ rows, onFilterStatus, onFilterInterviewed }: Props) {
  const total = rows.length;
  if (total === 0) return null;

  const advancing = rows.filter((r) => r.status === "Advancing").length;
  const rejected = rows.filter((r) => r.status === "Rejected").length;
  const responded = advancing + rejected;
  const responseRate = Math.round((responded / total) * 100);
  const reachedInterview = rows.filter((r) => r.timeline?.some((t) => INTERVIEW_STAGES.has(t.stage))).length;

  const stats: {
    label: string;
    value: number;
    suffix?: string;
    icon: LucideIcon;
    tone: Tone;
    bars: number[];
    onClick?: () => void;
  }[] = [
    { label: "Applications", value: total, icon: Layers, tone: "neutral", bars: [4, 6, 5, 8, 7, 9, 11, 10], onClick: () => onFilterStatus("All") },
    { label: "Response rate", value: responseRate, suffix: "%", icon: TrendingUp, tone: "accent", bars: [3, 5, 4, 6, 7, 6, 8, 9] },
    { label: "Reached interview", value: reachedInterview, icon: CalendarCheck, tone: "accent", bars: [1, 2, 2, 3, 4, 3, 5, 6], onClick: onFilterInterviewed },
    { label: "Advancing", value: advancing, icon: Sparkles, tone: "success", bars: [1, 1, 2, 2, 3, 3, 4, 5], onClick: () => onFilterStatus("Advancing") },
    { label: "Rejected", value: rejected, icon: XCircle, tone: "danger", bars: [2, 4, 5, 6, 7, 8, 9, 10], onClick: () => onFilterStatus("Rejected") },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-5 mb-6">
      {stats.map((s, i) => {
        const tone = TONE[s.tone];
        const Icon = s.icon;
        return (
          <button
            key={s.label}
            onClick={s.onClick}
            disabled={!s.onClick}
            style={{ animationDelay: `${0.1 + i * 0.06}s` }}
            className={`animate-fade-up group relative overflow-hidden rounded-2xl border border-border bg-card p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all ${
              s.onClick
                ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.2)]"
                : "cursor-default"
            }`}
          >
            <div className="flex items-start justify-between">
              <span className={`flex size-8 items-center justify-center rounded-lg ${tone.icon}`}>
                <Icon className="size-4" />
              </span>
              <Sparkbars bars={s.bars} className={tone.bar} />
            </div>
            <div className="mt-4">
              <AnimatedNumber
                value={s.value}
                suffix={s.suffix}
                className="tnum text-[28px] font-semibold leading-none tracking-tight text-foreground"
              />
              <p className="label-mono mt-2 text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
