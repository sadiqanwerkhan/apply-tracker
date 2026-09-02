"use client";

import { useEffect, useRef, useState } from "react";
import { fieldBase } from "@/components/application-detail/shared";

// A linked country + city picker.
// - Country autocompletes from /api/countries.
// - City autocompletes from /api/cities; when a country is chosen, only that
//   country's cities are suggested (bare names).
// - When no country is set and the user picks a "City, Country" suggestion, it is
//   split so the city field holds just the city and the country field is filled.
// - An always-available "Other" lets the user type a city not in the list.
export function CountryCitySelect({
  country, city, onCountry, onCity,
}: {
  country: string; city: string;
  onCountry: (v: string) => void; onCity: (v: string) => void;
}) {
  return (
    <>
      <CountryInput value={country} onChange={onCountry} />
      <CityInput country={country} city={city} onCity={onCity} onCountry={onCountry} />
    </>
  );
}

function CountryInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/countries?q=${encodeURIComponent(query.trim())}`);
        const d = await res.json();
        setResults(Array.isArray(d.countries) ? d.countries : []);
      } catch { setResults([]); }
    }, 150);
    return () => clearTimeout(t);
  }, [query, open]);

  function pick(v: string) { onChange(v); setQuery(""); setOpen(false); }

  return (
    <div className="relative">
      <input
        type="text"
        value={open ? query : value}
        placeholder="Country (optional)"
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

function CityInput({
  country, city, onCity, onCountry,
}: {
  country: string; city: string;
  onCity: (v: string) => void; onCountry: (v: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [freeText, setFreeText] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (country.trim()) params.set("country", country.trim());
        const res = await fetch(`/api/cities?${params.toString()}`);
        const d = await res.json();
        setResults(Array.isArray(d.cities) ? d.cities : []);
      } catch { setResults([]); }
    }, 150);
    return () => clearTimeout(t);
  }, [query, open, country]);

  // Picking a suggestion. If it's "City, Country" (no country chosen yet), split
  // it: city field gets the city, country field gets the country.
  function pick(v: string) {
    const commaIdx = v.lastIndexOf(", ");
    if (!country.trim() && commaIdx > -1) {
      onCity(v.slice(0, commaIdx));
      onCountry(v.slice(commaIdx + 2));
    } else {
      onCity(v);
    }
    setQuery(""); setOpen(false);
  }

  if (freeText) {
    return (
      <div className="relative">
        <input value={city} onChange={(e) => onCity(e.target.value)} placeholder="City (type it in)" className={`${fieldBase} w-full`} autoFocus />
        <button type="button" onClick={() => { setFreeText(false); onCity(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground hover:text-accent">↩ list</button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={open ? query : city}
        placeholder="City (optional)"
        onFocus={() => { setQuery(city); setOpen(true); }}
        onChange={(e) => { setQuery(e.target.value); onCity(e.target.value); setOpen(true); }}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
        className={`${fieldBase} w-full`}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg" onMouseDown={(e) => e.preventDefault()}>
          <ul className="max-h-52 overflow-auto">
            {results.map((opt) => (
              <li key={opt} onClick={() => pick(opt)} className="cursor-pointer px-3 py-2 text-sm text-foreground hover:bg-accent/10">{opt}</li>
            ))}
            {results.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">No match — use “Other” below</li>
            )}
          </ul>
          {/* Pinned "Other" for cities not in the list. */}
          <button type="button" onClick={() => { setFreeText(true); onCity(""); setOpen(false); }}
            className="block w-full border-t border-border bg-secondary/40 px-3 py-2 text-left text-sm font-medium text-accent hover:bg-secondary">
            + Other (type your own)
          </button>
        </div>
      )}
    </div>
  );
}
