import { NextRequest, NextResponse } from "next/server";
import citiesData from "@/lib/data/cities.json";

// Imported once, cached by the module system for the life of the warm instance.
// Server-side only — this 575KB file never ships to the browser.
const ALL = citiesData as [string, string][];

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  if (q.length < 2) return NextResponse.json({ cities: [] });

  const starts: string[] = [];
  const contains: string[] = [];

  for (const [name, country] of ALL) {
    const lname = name.toLowerCase();
    if (lname.startsWith(q)) {
      starts.push(`${name}, ${country}`);
      // ALL is population-sorted, so the first 8 prefix hits are the 8 largest.
      if (starts.length >= 8) break;
    } else if (contains.length < 8 && lname.includes(q)) {
      contains.push(`${name}, ${country}`);
    }
  }

  return NextResponse.json({ cities: [...starts, ...contains].slice(0, 8) });
}