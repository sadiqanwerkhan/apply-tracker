"use client";

import { useState, useRef, useEffect } from "react";
import { ExportFormat } from "@/lib/exporters";

type Props = {
  label: string;
  count: number;
  primary?: boolean;
  onExport: (format: ExportFormat) => Promise<void> | void;
};

const OPTIONS: { key: ExportFormat; label: string }[] = [
  { key: "pdf", label: "PDF  (.pdf)" },
  { key: "excel", label: "Excel  (.xlsx)" },
  { key: "word", label: "Word  (.docx)" },
];

export default function ExportMenu({ label, count, primary, onExport }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function pick(format: ExportFormat) {
    setOpen(false);
    setBusy(true);
    try {
      await onExport(format);
    } finally {
      setBusy(false);
    }
  }

  const btnClass = primary
    ? "bg-primary text-primary-foreground shadow-sm hover:brightness-110"
    : "bg-card text-foreground/80 border border-border hover:bg-secondary hover:text-foreground";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy || count === 0}
        className={`inline-flex h-10 items-center gap-2 rounded-lg px-3.5 text-[13px] font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${btnClass}`}
      >
        {busy ? "Exporting…" : label}
        <span className="tnum opacity-70">({count})</span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => pick(o.key)}
              className="w-full px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-secondary"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
