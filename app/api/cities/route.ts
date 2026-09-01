import { NextRequest, NextResponse } from "next/server";
import citiesData from "@/lib/data/cities.json";

// Server-side only — this dataset never ships to the browser.
const ALL = citiesData as [string, string][];

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  const country = (req.nextUrl.searchParams.get("country") || "").trim();

  // When a country is chosen, return ONLY that country's cities, as bare city
  // names (the country is already known). This powers the "pick Germany → see
  // only German cities" flow. An empty query then lists that country's top cities.
  if (country) {
    const inCountry = ALL.filter(([, c]) => c.toLowerCase() === country.toLowerCase());
    const matches = q
      ? inCountry.filter(([name]) => name.toLowerCase().includes(q))
      : inCountry;
    // ALL is population-sorted, so the first hits are the largest cities.
    return NextResponse.json({ cities: matches.slice(0, 8).map(([name]) => name) });
  }

  // No country selected: original behavior — search all, return "City, Country".
  if (q.length < 2) return NextResponse.json({ cities: [] });
  const starts: string[] = [];
  const contains: string[] = [];
  for (const [name, c] of ALL) {
    const lname = name.toLowerCase();
    if (lname.startsWith(q)) {
      starts.push(`${name}, ${c}`);
      if (starts.length >= 8) break;
    } else if (contains.length < 8 && lname.includes(q)) {
      contains.push(`${name}, ${c}`);
    }
  }
  return NextResponse.json({ cities: [...starts, ...contains].slice(0, 8) });
}