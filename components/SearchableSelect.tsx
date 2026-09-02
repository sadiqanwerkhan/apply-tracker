"use client";

import { useRef, useState } from "react";
import { fieldBase } from "@/components/application-detail/shared";

// A dropdown you can type to filter, with an always-available "Other" that lets
// the user enter a value not in the list. "Other" stays pinned at the bottom
// (sticky) while the rest of the options scroll, so it's always one click away.
// When "Other" is active, the field becomes a free-text input.
export function SearchableSelect({
  value, onChange, options, placeholder,
}: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [freeText, setFreeText] = useState(false); // true after picking "Other"
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // If the current value isn't in the list (and isn't empty), the user is in
  // free-text mode (e.g. they picked Other earlier, or loaded a custom value).
  const valueIsCustom = value !== "" && !options.includes(value);
  const inFreeText = freeText || valueIsCustom;

  const filtered = query.trim()
    ? options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  if (inFreeText) {
    return (
      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${fieldBase} w-full`}
          autoFocus
        />
        <button
          type="button"
          onClick={() => { setFreeText(false); onChange(""); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground hover:text-accent"
        >
          ↩ list
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={open ? query : value}
        placeholder={placeholder}
        onFocus={() => { setQuery(""); setOpen(true); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
        className={`${fieldBase} w-full`}
        readOnly={false}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg" onMouseDown={(e) => e.preventDefault()}>
          <ul className="max-h-52 overflow-auto">
            {filtered.map((opt) => (
              <li
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`cursor-pointer px-3 py-2 text-sm hover:bg-accent/10 ${opt === value ? "text-accent" : "text-foreground"}`}
              >
                {opt}
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">No match — use “Other” below</li>
            )}
          </ul>
          {/* Pinned "Other" — always visible while the list above scrolls. */}
          <button
            type="button"
            onClick={() => { setFreeText(true); onChange(""); setOpen(false); }}
            className="block w-full border-t border-border bg-secondary/40 px-3 py-2 text-left text-sm font-medium text-accent hover:bg-secondary"
          >
            + Other (type your own)
          </button>
        </div>
      )}
    </div>
  );
}
