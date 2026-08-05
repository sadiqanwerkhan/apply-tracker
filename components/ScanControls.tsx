"use client";

import { CalendarDays, ArrowRight, Search, Loader2 } from "lucide-react";

type Props = {
  startDate: string;
  endDate: string;
  scanning: boolean;
  error: string;
  progress: { processed: number; remaining: number } | null;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
  onScan: () => void;
};

export default function ScanControls({ startDate, endDate, scanning, error, progress, onStart, onEnd, onScan }: Props) {
  const total = progress ? progress.processed + progress.remaining : 0;
  const pct = total > 0 ? Math.round((progress!.processed / total) * 100) : 0;

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
      <div className="flex h-10 w-full items-center gap-1.5 rounded-lg border border-input bg-background pl-2.5 pr-2 text-xs text-foreground sm:w-auto">
          <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStart(e.target.value)}
            aria-label="From date"
            className="tnum w-full min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none sm:w-[116px] sm:flex-none"
          />
          <ArrowRight className="size-3 shrink-0 text-muted-foreground/60" />
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEnd(e.target.value)}
            aria-label="To date"
            className="tnum w-full min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none sm:w-[116px] sm:flex-none"
          />
        </div>

        <button
          type="button"
          onClick={onScan}
          disabled={scanning}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground shadow-sm transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-90 sm:w-auto"
        >
          {scanning ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          {scanning ? "Scanning…" : "Scan my applications"}
        </button>
      </div>

      {scanning && progress && total > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
            <span>Processing your inbox…</span>
            <span className="tnum">{progress.processed} of {total} emails</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-accent transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
