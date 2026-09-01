"use client";

import { useEffect, useRef, useState } from "react";
import { fieldBase } from "@/components/application-detail/shared";

// A linked country + city picker. Country autocompletes from /api/countries.
// City autocompletes from /api/cities — and when a country is chosen, only that
// country's cities are suggested (bare names). Free typing is always allowed, so
// nothing is blocked if a place isn't in the dataset.
export function CountryCitySelect({
  country, city, onCountry, onCity,
}: {
  country: string; city: string;
  onCountry: (v: string) => void; onCity: (v: string) => void;
}) {
  return (
    <>
      <AutocompleteInput
        value={country}
        onChange={onCountry}
        placeholder="Country (optional)"
        fetchOptions={async (q) => {
          const res = await fetch(`/api/countries?q=${encodeURIComponent(q)}`);
          const d = await res.json();
          return Array.isArray(d.countries) ? d.countries : [];
        }}
      />
      <AutocompleteInput
        value={city}
        onChange={onCity}
        placeholder="City (optional)"
        // Re-fetch whenever the country changes so suggestions stay in sync.
        dep={country}
        fetchOptions={async (q) => {
          const params = new URLSearchParams();
          if (q) params.set("q", q);
          if (country.trim()) params.set("country", country.trim());
          // Without a country and <2 chars, the endpoint returns nothing — that's fine.
          const res = await fetch(`/api/cities?${params.toString()}`);
          const d = await res.json();
          return Array.isArray(d.cities) ? d.cities : [];
        }}
      />
    </>
  );
}

function AutocompleteInput({
  value, onChange, placeholder, fetchOptions, dep,
}: {
  value: string; onChange: (v: string) => void; placeholder: string;
  fetchOptions: (q: string) => Promise<string[]>; dep?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      try { setResults(await fetchOptions(query.trim())); } catch { setResults([]); }
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, dep]);

  function pick(v: string) { onChange(v); setQuery(""); setOpen(false); }

  return (
    <div className="relative">
      <input
        type="text"
        value={open ? query : value}
        placeholder={placeholder}
        onFocus={() => { setQuery(value); setActive(0); setOpen(true); }}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setActive(0); setOpen(true); }}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
        onKeyDown={(e) => {
          if (!open || results.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); pick(results[active]); }
          else if (e.key === "Escape") { setOpen(false); }
        }}
        className={`${fieldBase} w-full`}
      />
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-popover shadow-lg" onMouseDown={(e) => e.preventDefault()}>
          {results.map((opt, i) => (
            <li key={opt} onMouseEnter={() => setActive(i)} onClick={() => pick(opt)}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-accent/10 text-accent" : "text-foreground"}`}>
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
