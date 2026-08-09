"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LocationSelect from "@/components/LocationSelect";
import { fieldBase, btnPrimary } from "./shared";

export function JobDescriptionCard({
  applicationId, jobTitle, jobLocation, jobDescription,
}: {
  applicationId: string;
  jobTitle: string | null;
  jobLocation: string | null;
  jobDescription: string | null;
}) {
  const router = useRouter();
  const hasJD = !!(jobDescription && jobDescription.trim());
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(jobTitle || "");
  const [location, setLocation] = useState(jobLocation || "");
  const [desc, setDesc] = useState(jobDescription || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/application/job-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, jobTitle: title, jobLocation: location, jobDescription: desc }),
      });
      if (res.ok) { setOpen(false); router.refresh(); }
      else alert("Could not save. Please try again.");
    } catch {
      alert("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // collapsed state
  if (!open) {
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-accent/25 bg-accent/[0.06] p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {hasJD ? "Job description added" : "Add the job description for sharper results"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {hasJD
              ? "Your analysis and interview prep use it."
              : "Optional — paste the JD and your analysis and prep become tailored to this role."}
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-lg border border-accent/25 bg-card px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/10"
        >
          {hasJD ? "Edit job description" : "Add job description"}
        </button>
      </div>
    );
  }

  // expanded editor
  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Job description</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Job title (optional)" className={fieldBase} />
        <LocationSelect value={location} onChange={setLocation} />
      </div>
      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Paste the full job description here…"
        rows={8}
        className={`${fieldBase} mt-3 w-full`}
      />
      <div className="mt-3 flex gap-2">
        <button onClick={save} disabled={saving} className={btnPrimary}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setOpen(false)} disabled={saving} className="px-3 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
      </div>
    </div>
  );
}
