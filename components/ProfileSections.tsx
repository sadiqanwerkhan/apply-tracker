"use client";

import { useState, useEffect, useCallback } from "react";
import { fieldBase, btnPrimary } from "@/components/application-detail/shared";

type Section = "work" | "education" | "language" | "certification";
type Item = Record<string, unknown> & { id: string };

const LANG_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "Native"];
const WORK_MODES = [
  { value: "onsite", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
];

// Build a human location string from the optional parts, so people who hide the
// city or country still get a sensible display.
function locationText(it: Item): string {
  const parts = [it.city, it.country].filter(Boolean) as string[];
  const place = parts.join(", ");
  const mode = it.workMode === "remote" ? "Remote" : it.workMode === "hybrid" ? "Hybrid" : "";
  if (place && mode) return `${place} · ${mode}`;
  return place || mode || "";
}
function dateRange(it: Item): string {
  const start = (it.startDate as string) || "";
  const end = it.current ? "Present" : (it.endDate as string) || "";
  if (start && end) return `${start} – ${end}`;
  return start || end || "";
}

function useSection(section: Section) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    fetch(`/api/profile/sections?section=${section}`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.items)) setItems(d.items); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [section]);
  useEffect(() => { load(); }, [load]);
  return { items, loading, reload: load };
}

async function save(section: Section, data: Record<string, unknown>, id?: string) {
  await fetch("/api/profile/sections", {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section, id, ...data }),
  });
}
async function remove(section: Section, id: string) {
  await fetch("/api/profile/sections", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section, id }),
  });
}

function SectionShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {subtitle && <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

// ── Work experience ──────────────────────────────────────────────────────────
export function WorkSection() {
  const { items, loading, reload } = useSection("work");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  return (
    <SectionShell title="Work experience" subtitle="The real roles you've held. Add what you actually did — this powers gap analysis later.">
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : items.map((it) =>
        editing === it.id
          ? <WorkForm key={it.id} initial={it} onDone={() => { setEditing(null); reload(); }} onCancel={() => setEditing(null)} />
          : (
            <div key={it.id} className="rounded-lg border border-border/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{String(it.title)}</p>
                  <p className="text-[13px] text-muted-foreground">{String(it.company)}{locationText(it) ? ` · ${locationText(it)}` : ""}</p>
                  {dateRange(it) && <p className="text-[12px] text-muted-foreground/80">{dateRange(it)}</p>}
                  {it.description ? <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-foreground/80">{String(it.description)}</p> : null}
                </div>
                <div className="flex shrink-0 gap-2 text-[12px]">
                  <button onClick={() => setEditing(it.id)} className="text-accent hover:underline">Edit</button>
                  <button onClick={() => remove("work", it.id).then(reload)} className="text-muted-foreground hover:text-danger">Delete</button>
                </div>
              </div>
            </div>
          )
      )}
      {editing === "new"
        ? <WorkForm onDone={() => { setEditing(null); reload(); }} onCancel={() => setEditing(null)} />
        : <button onClick={() => setEditing("new")} className="text-sm font-medium text-accent hover:underline">+ Add role</button>}
    </SectionShell>
  );
}

function WorkForm({ initial, onDone, onCancel }: { initial?: Item; onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({
    title: (initial?.title as string) || "", company: (initial?.company as string) || "",
    workMode: (initial?.workMode as string) || "onsite",
    country: (initial?.country as string) || "", city: (initial?.city as string) || "",
    startDate: (initial?.startDate as string) || "", endDate: (initial?.endDate as string) || "",
    current: (initial?.current as boolean) || false, description: (initial?.description as string) || "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  async function submit() { setBusy(true); await save("work", f, initial?.id); setBusy(false); onDone(); }
  return (
    <div className="rounded-lg border border-accent/30 bg-accent/[0.04] p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Job title" className={fieldBase} />
        <input value={f.company} onChange={(e) => set("company", e.target.value)} placeholder="Company" className={fieldBase} />
        <select value={f.workMode} onChange={(e) => set("workMode", e.target.value)} className={fieldBase}>
          {WORK_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <input value={f.country} onChange={(e) => set("country", e.target.value)} placeholder="Country (optional)" className={fieldBase} />
        <input value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="City (optional)" className={fieldBase} />
        <div />
        <input value={f.startDate} onChange={(e) => set("startDate", e.target.value)} placeholder="Start (YYYY-MM)" className={fieldBase} />
        <div className="flex items-center gap-2">
          <input value={f.endDate} onChange={(e) => set("endDate", e.target.value)} placeholder="End (YYYY-MM)" disabled={f.current} className={`${fieldBase} flex-1 ${f.current ? "opacity-50" : ""}`} />
          <label className="flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground">
            <input type="checkbox" checked={f.current} onChange={(e) => set("current", e.target.checked)} className="accent-accent" /> Current
          </label>
        </div>
      </div>
      <textarea value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="What did you actually do here? Projects, tools, responsibilities…" rows={4} className={`${fieldBase} mt-3 w-full`} />
      <div className="mt-3 flex gap-2">
        <button onClick={submit} disabled={busy || !f.title.trim() || !f.company.trim()} className={btnPrimary}>{busy ? "Saving…" : "Save"}</button>
        <button onClick={onCancel} className="px-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
      </div>
    </div>
  );
}

// ── Education ────────────────────────────────────────────────────────────────
export function EducationSection() {
  const { items, loading, reload } = useSection("education");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  return (
    <SectionShell title="Education" subtitle="Your degrees and qualifications.">
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : items.map((it) =>
        editing === it.id
          ? <EduForm key={it.id} initial={it} onDone={() => { setEditing(null); reload(); }} onCancel={() => setEditing(null)} />
          : (
            <div key={it.id} className="rounded-lg border border-border/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{String(it.degree)}</p>
                  <p className="text-[13px] text-muted-foreground">{String(it.institution)}{locationText(it) ? ` · ${locationText(it)}` : ""}</p>
                  {dateRange(it) && <p className="text-[12px] text-muted-foreground/80">{dateRange(it)}</p>}
                </div>
                <div className="flex shrink-0 gap-2 text-[12px]">
                  <button onClick={() => setEditing(it.id)} className="text-accent hover:underline">Edit</button>
                  <button onClick={() => remove("education", it.id).then(reload)} className="text-muted-foreground hover:text-danger">Delete</button>
                </div>
              </div>
            </div>
          )
      )}
      {editing === "new"
        ? <EduForm onDone={() => { setEditing(null); reload(); }} onCancel={() => setEditing(null)} />
        : <button onClick={() => setEditing("new")} className="text-sm font-medium text-accent hover:underline">+ Add education</button>}
    </SectionShell>
  );
}

function EduForm({ initial, onDone, onCancel }: { initial?: Item; onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({
    degree: (initial?.degree as string) || "", institution: (initial?.institution as string) || "",
    country: (initial?.country as string) || "", city: (initial?.city as string) || "",
    startDate: (initial?.startDate as string) || "", endDate: (initial?.endDate as string) || "",
    current: (initial?.current as boolean) || false,
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  async function submit() { setBusy(true); await save("education", f, initial?.id); setBusy(false); onDone(); }
  return (
    <div className="rounded-lg border border-accent/30 bg-accent/[0.04] p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input value={f.degree} onChange={(e) => set("degree", e.target.value)} placeholder="Degree / qualification" className={fieldBase} />
        <input value={f.institution} onChange={(e) => set("institution", e.target.value)} placeholder="Institution" className={fieldBase} />
        <input value={f.country} onChange={(e) => set("country", e.target.value)} placeholder="Country (optional)" className={fieldBase} />
        <input value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="City (optional)" className={fieldBase} />
        <input value={f.startDate} onChange={(e) => set("startDate", e.target.value)} placeholder="Start (YYYY)" className={fieldBase} />
        <div className="flex items-center gap-2">
          <input value={f.endDate} onChange={(e) => set("endDate", e.target.value)} placeholder="End (YYYY)" disabled={f.current} className={`${fieldBase} flex-1 ${f.current ? "opacity-50" : ""}`} />
          <label className="flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground">
            <input type="checkbox" checked={f.current} onChange={(e) => set("current", e.target.checked)} className="accent-accent" /> Current
          </label>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={submit} disabled={busy || !f.degree.trim() || !f.institution.trim()} className={btnPrimary}>{busy ? "Saving…" : "Save"}</button>
        <button onClick={onCancel} className="px-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
      </div>
    </div>
  );
}

// ── Languages ────────────────────────────────────────────────────────────────
export function LanguageSection() {
  const { items, loading, reload } = useSection("language");
  const [name, setName] = useState("");
  const [level, setLevel] = useState("B2");
  const [busy, setBusy] = useState(false);
  async function add() { if (!name.trim()) return; setBusy(true); await save("language", { name, level }); setName(""); setBusy(false); reload(); }
  return (
    <SectionShell title="Spoken languages" subtitle="Languages you speak and your level (CEFR, or Native).">
      {loading ? null : (
        <div className="flex flex-wrap gap-2">
          {items.map((it) => (
            <span key={it.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 py-1 pl-3 pr-2 text-[13px]">
              <span className="text-foreground">{String(it.name)}</span>
              <span className="text-muted-foreground">{String(it.level)}</span>
              <button onClick={() => remove("language", it.id).then(reload)} className="text-muted-foreground hover:text-danger" aria-label="Remove">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Language (e.g. German)" className={`${fieldBase} flex-1`} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <select value={level} onChange={(e) => setLevel(e.target.value)} className={fieldBase}>
          {LANG_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <button onClick={add} disabled={busy || !name.trim()} className={btnPrimary}>Add</button>
      </div>
    </SectionShell>
  );
}

// ── Certifications ───────────────────────────────────────────────────────────
export function CertificationSection() {
  const { items, loading, reload } = useSection("certification");
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  async function add() { if (!name.trim()) return; setBusy(true); await save("certification", { name, issuer, year }); setName(""); setIssuer(""); setYear(""); setBusy(false); reload(); }
  return (
    <SectionShell title="Certifications" subtitle="Professional certifications, if any.">
      {loading ? null : items.map((it) => (
        <div key={it.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-3">
          <div className="min-w-0">
            <p className="font-medium text-foreground">{String(it.name)}</p>
            <p className="text-[13px] text-muted-foreground">{[it.issuer, it.year].filter(Boolean).join(" · ")}</p>
          </div>
          <button onClick={() => remove("certification", it.id).then(reload)} className="shrink-0 text-[12px] text-muted-foreground hover:text-danger">Delete</button>
        </div>
      ))}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.4fr_1fr_0.6fr_auto]">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Certification name" className={fieldBase} />
        <input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="Issuer (optional)" className={fieldBase} />
        <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year" className={fieldBase} />
        <button onClick={add} disabled={busy || !name.trim()} className={btnPrimary}>Add</button>
      </div>
    </SectionShell>
  );
}
