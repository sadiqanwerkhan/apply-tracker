import { NextRequest, NextResponse } from "next/server";
import citiesData from "@/lib/data/cities.json";

// Country suggestions, derived once from the existing cities dataset (no extra
// data file). The unique country list is small (~171), computed at module load
// and cached for the warm instance.
const ALL = citiesData as [string, string][];
const COUNTRIES: string[] = [...new Set(ALL.map(([, country]) => country))].sort();

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  if (!q) return NextResponse.json({ countries: COUNTRIES.slice(0, 8) });

  const starts = COUNTRIES.filter((c) => c.toLowerCase().startsWith(q));
  const contains = COUNTRIES.filter((c) => !c.toLowerCase().startsWith(q) && c.toLowerCase().includes(q));
  return NextResponse.json({ countries: [...starts, ...contains].slice(0, 8) });
}