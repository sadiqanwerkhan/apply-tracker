"use client";

import { useState, useRef, useEffect, useMemo } from "react";

// Value format matches the old <input type="datetime-local">: "YYYY-MM-DDTHH:mm"
// (local wall-clock). Empty string = nothing selected.
function parseLocal(v: string): Date | null {
  if (!v) return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
}
function toLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function DateTimePicker({ value, onChange, placeholder }: Props) {
  const selected = useMemo(() => parseLocal(value), [value]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(() => selected ?? new Date());
  const ref = useRef<HTMLDivElement>(null);

  // keep the visible month in step with an externally-set value
  useEffect(() => {
    if (selected) setView(new Date(selected.getFullYear(), selected.getMonth(), 1));
  }, [selected]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const hour24 = selected ? selected.getHours() : 9;
  const minute = selected ? selected.getMinutes() : 0;
  const hour12 = ((hour24 + 11) % 12) + 1;
  const ampm: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";

  const minuteOptions = useMemo(() => {
    const base = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    if (!base.includes(minute)) base.push(minute);
    return base.sort((a, b) => a - b);
  }, [minute]);

  function fallback(): Date {
    if (selected) return selected;
    const n = new Date();
    n.setSeconds(0, 0);
    return n;
  }
  function emit(next: Date) {
    onChange(toLocal(next));
  }

  function pickDay(day: number) {
    const base = fallback();
    emit(new Date(year, month, day, selected ? base.getHours() : 9, selected ? base.getMinutes() : 0));
  }
  function setHour12(h: number) {
    const base = fallback();
    let h24 = h % 12;
    if (ampm === "PM") h24 += 12;
    emit(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h24, base.getMinutes()));
  }
  function setMinute(mi: number) {
    const base = fallback();
    emit(new Date(base.getFullYear(), base.getMonth(), base.getDate(), base.getHours(), mi));
  }
  function setAmPm(p: "AM" | "PM") {
    const base = fallback();
    let h = base.getHours();
    if (p === "AM" && h >= 12) h -= 12;
    if (p === "PM" && h < 12) h += 12;
    emit(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, base.getMinutes()));
  }

  const label = selected
    ? selected.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : placeholder || "Set date & time";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-4 focus:ring-accent/12"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground">
          <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
        </svg>
        <span className={selected ? "" : "text-muted-foreground"}>{label}</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setView(new Date(year, month - 1, 1))} className="h-7 w-7 rounded-md text-lg leading-none text-muted-foreground hover:bg-secondary">‹</button>
            <span className="text-sm font-medium text-foreground">{MONTHS[month]} {year}</span>
            <button type="button" onClick={() => setView(new Date(year, month + 1, 1))} className="h-7 w-7 rounded-md text-lg leading-none text-muted-foreground hover:bg-secondary">›</button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[11px] font-medium text-muted-foreground">{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />;
              const isSel = !!selected && selected.getFullYear() === year && selected.getMonth() === month && selected.getDate() === d;
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => pickDay(d)}
                  className={`h-8 rounded-md text-sm ${isSel ? "bg-accent font-medium text-accent-foreground" : "text-foreground hover:bg-accent/10"}`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">Time</span>
            <select value={hour12} onChange={(e) => setHour12(Number(e.target.value))} className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <span className="text-muted-foreground">:</span>
            <select value={minute} onChange={(e) => setMinute(Number(e.target.value))} className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground">
              {minuteOptions.map((mi) => (
                <option key={mi} value={mi}>{String(mi).padStart(2, "0")}</option>
              ))}
            </select>
            <div className="inline-flex overflow-hidden rounded-md border border-input">
              <button type="button" onClick={() => setAmPm("AM")} className={`px-2.5 py-1 text-xs ${ampm === "AM" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary"}`}>AM</button>
              <button type="button" onClick={() => setAmPm("PM")} className={`px-2.5 py-1 text-xs ${ampm === "PM" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary"}`}>PM</button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="text-xs text-muted-foreground hover:text-danger">Clear</button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs font-medium text-accent">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}