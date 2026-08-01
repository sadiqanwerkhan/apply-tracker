"use client";

import { useEffect, useRef, useState } from "react";

interface LocationSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function LocationSelect({ value, onChange, placeholder }: LocationSelectProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced fetch against your own /api/cities endpoint.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cities?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(Array.isArray(data.cities) ? data.cities : []);
      } catch {
        setResults([]);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [query]);

  // "Remote" is always offered, pinned to the top — it's an option, not a lookup.
  const showRemote = "remote".startsWith(query.trim().toLowerCase()) || query.trim() === "";
  const options = showRemote ? ["Remote", ...results] : results;

  function pick(v: string) {
    onChange(v);
    setQuery("");
    setOpen(false);
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        value={open ? query : value}
        placeholder={placeholder || "City, or Remote"}
        onFocus={() => {
          setQuery(value === "Remote" ? "" : value);
          setActive(0);
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value); // free-typed values still work — nothing is blocked
          setActive(0);
          setOpen(true);
        }}
        onBlur={() => {
          // Delay close so a click on an option registers first.
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(e) => {
          if (!open || options.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(options[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />

      {open && options.length > 0 && (
        <ul
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
          onMouseDown={(e) => e.preventDefault()} // keep the input focused through the click
        >
          {options.map((opt, i) => (
            <li
              key={opt}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(opt)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === active ? "bg-indigo-50 text-indigo-700" : "text-gray-700"
              } ${opt === "Remote" ? "font-medium" : ""}`}
            >
              {opt === "Remote" ? "🌐 Remote" : opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}