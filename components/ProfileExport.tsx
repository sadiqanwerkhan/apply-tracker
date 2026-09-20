"use client";

import { useState } from "react";
import { exportMarkdown, exportPdf, exportDocx, ProfileData } from "@/lib/profileExport";

// Download the whole profile as Markdown, Word, or PDF. Fetches the full profile
// on demand, then builds the file in the browser (no server round-trip). The idea:
// this is your honest "root" profile you can hand to any tool or recruiter.
export function ProfileExport() {
  const [busy, setBusy] = useState<string | null>(null);

  async function run(kind: "md" | "pdf" | "docx") {
    setBusy(kind);
    try {
      const res = await fetch("/api/profile/full");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as ProfileData;
      if (kind === "md") exportMarkdown(data);
      else if (kind === "pdf") await exportPdf(data);
      else await exportDocx(data);
    } catch {
      alert("Couldn't generate the file. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const btn = "rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-60";

  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 p-4 text-left sm:p-6">
        <span className="text-base font-semibold text-foreground">Download your profile</span>
        <svg className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
      <div className="px-4 pb-4 sm:px-6 sm:pb-6">
      <p className="-mt-1 text-[13px] leading-relaxed text-muted-foreground">
        Export your complete profile. Hand the Markdown to any AI tool as &ldquo;this is the real me&rdquo; when tailoring a CV,
        or share the PDF/Word version directly.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => run("pdf")} disabled={busy !== null} className={btn}>{busy === "pdf" ? "Preparing…" : "Download PDF"}</button>
        <button onClick={() => run("docx")} disabled={busy !== null} className={btn}>{busy === "docx" ? "Preparing…" : "Download Word"}</button>
        <button onClick={() => run("md")} disabled={busy !== null} className={btn}>{busy === "md" ? "Preparing…" : "Download Markdown"}</button>
      </div>
      </div>
      )}
    </div>
  );
}
