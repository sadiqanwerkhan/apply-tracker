"use client";

import { useState, useEffect, useCallback } from "react";
import { fieldBase, btnPrimary } from "@/components/application-detail/shared";
import { CountryCitySelect } from "@/components/CountryCitySelect";
import { LANGUAGES } from "@/lib/data/languages";

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
        <CountryCitySelect country={f.country} city={f.city} onCountry={(v) => set("country", v)} onCity={(v) => set("city", v)} />
        <div />
        <input type="month" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} className={fieldBase} />
        <div className="flex items-center gap-2">
          <input type="month" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} disabled={f.current} className={`${fieldBase} flex-1 ${f.current ? "opacity-50" : ""}`} />
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
        <CountryCitySelect country={f.country} city={f.city} onCountry={(v) => set("country", v)} onCity={(v) => set("city", v)} />
        <input type="month" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} className={fieldBase} />
        <div className="flex items-center gap-2">
          <input type="month" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} disabled={f.current} className={`${fieldBase} flex-1 ${f.current ? "opacity-50" : ""}`} />
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
function flagFor(name: string): string {
  return LANGUAGES.find((l) => l.name.toLowerCase() === name.toLowerCase())?.flag || "";
}
export function LanguageSection() {
  const { items, loading, reload } = useSection("language");
  const [name, setName] = useState("");
  const [level, setLevel] = useState("B2");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  // Language suggestions filtered by what's typed (small bundled list, no API).
  const suggestions = name.trim()
    ? LANGUAGES.filter((l) => l.name.toLowerCase().includes(name.trim().toLowerCase())).slice(0, 6)
    : [];

  async function add(langName?: string) {
    const value = (langName ?? name).trim();
    if (!value) return;
    setBusy(true);
    await save("language", { name: value, level });
    setName(""); setOpen(false); setBusy(false); setAdding(false);
    reload();
  }

  return (
    <SectionShell title="Spoken languages" subtitle="Languages you speak and your level (CEFR, or Native).">
      {loading ? null : (
        <div className="flex flex-wrap gap-2">
          {items.map((it) => (
            <span key={it.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 py-1 pl-3 pr-2 text-[13px]">
              {flagFor(String(it.name)) && <span aria-hidden>{flagFor(String(it.name))}</span>}
              <span className="text-foreground">{String(it.name)}</span>
              <span className="text-muted-foreground">{String(it.level)}</span>
              <button onClick={() => remove("language", it.id).then(reload)} className="text-muted-foreground hover:text-danger" aria-label="Remove">×</button>
            </span>
          ))}
        </div>
      )}
      {adding ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="Language (e.g. German)"
              className={`${fieldBase} w-full`}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            />
            {open && suggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-popover shadow-lg" onMouseDown={(e) => e.preventDefault()}>
                {suggestions.map((l) => (
                  <li key={l.name} onClick={() => { setName(l.name); setOpen(false); }} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent/10">
                    <span aria-hidden>{l.flag}</span> {l.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <select value={level} onChange={(e) => setLevel(e.target.value)} className={fieldBase}>
            {LANG_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <button onClick={() => add()} disabled={busy || !name.trim()} className={btnPrimary}>Add</button>
          <button onClick={() => { setAdding(false); setName(""); }} className="px-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="text-sm font-medium text-accent hover:underline">+ Add language</button>
      )}
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
  const [adding, setAdding] = useState(false);
  async function add() { if (!name.trim()) return; setBusy(true); await save("certification", { name, issuer, year }); setName(""); setIssuer(""); setYear(""); setBusy(false); setAdding(false); reload(); }
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
      {adding ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Certification name" className={fieldBase} autoFocus />
          <input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="Issuer (optional)" className={fieldBase} />
          <input type="number" min={1950} max={2100} value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year" className={`${fieldBase} w-full sm:w-32`} />
          <div className="flex items-end gap-2 sm:justify-start">
            <button onClick={add} disabled={busy || !name.trim()} className={btnPrimary}>Add certification</button>
            <button onClick={() => { setAdding(false); setName(""); setIssuer(""); setYear(""); }} className="px-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="text-sm font-medium text-accent hover:underline">+ Add certification</button>
      )}
    </SectionShell>
  );
}
