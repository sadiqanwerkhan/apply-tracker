"use client";

import { useState, useCallback, useMemo, memo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import LocationSelect from "@/components/LocationSelect";
import DateTimePicker from "@/components/DateTimePicker";

const STAGE_TYPES: { value: string; label: string }[] = [
  { value: "phone_screen", label: "Phone / Recruiter Screen" },
  { value: "technical", label: "Technical" },
  { value: "system_design", label: "System Design" },
  { value: "cultural_fit", label: "Cultural Fit" },
  { value: "hr", label: "HR" },
  { value: "final", label: "Final / Leadership" },
  { value: "other", label: "Other" },
];
function stageTypeLabel(v: string) {
  return STAGE_TYPES.find((t) => t.value === v)?.label || "Other";
}
// Format a stored ISO date for a <input type="datetime-local"> (which needs local wall-clock, no timezone).
function toLocalInput(d: string | Date | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

const fieldBase =
  "rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/70 focus:border-accent focus:ring-4 focus:ring-accent/12";
const btnPrimary =
  "rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-sm transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-60";

function Chevron({ open }: { open: boolean }) {
  return (
    <span className={`text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
    </span>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}
function ChevronUpDown({ dir }: { dir: "up" | "down" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {dir === "up" ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
    </svg>
  );
}
function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
  );
}

type Insights = {
  techStack?: string[];
  teamSize?: string;
  teamStructure?: string;
  product?: string;
  payRange?: string;
  nextSteps?: string;
  notes?: string[];
};
type TranscriptT = { id: string; label: string | null; content: string };
type StageT = { id: string; name: string; type: string; order: number; result: string | null; scheduledAt: string | null; transcripts: TranscriptT[] };
type AppT = {
  id: string;
  company: string;
  role: string;
  analysis: string | null;
  analysisAt: string | null;
  insights: Insights | null;
  insightsAt: string | null;
  jobTitle: string | null;
  jobLocation: string | null;
  jobDescription: string | null;
  stages: StageT[];
};

type Prep = {
  encouragement?: string;
  focusAreas?: string[];
  questionsToAsk?: string[];
  watchOuts?: string[];
};

type Caller = (url: string, method: string, body: object) => Promise<void>;

export default function ApplicationDetail({ application }: { application: AppT }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [newStage, setNewStage] = useState("");
  const [addingStage, setAddingStage] = useState(false);
  const [newStageType, setNewStageType] = useState("technical");

  // Stable identity so memoized StageCard/TranscriptItem children don't re-render
  // on every parent render — only when they actually receive changed props.
  const call = useCallback<Caller>(async (url, method, body) => {
    setBusy(true);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) router.refresh();
      else alert("Something went wrong. Please try again.");
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [router]);

  const [analysis, setAnalysis] = useState<string | null>(application.analysis);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);

  const [insights, setInsights] = useState<Insights | null>(application.insights);
  const [extracting, setExtracting] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);

  const totalTranscripts = useMemo(
    () => application.stages.reduce((n, s) => n + s.transcripts.length, 0),
    [application.stages]
  );

  async function runAnalysis() {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/application/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: application.id }),
      });
      const data = await res.json();
      if (res.ok && data.analysis) { setAnalysis(data.analysis); setAnalysisOpen(true); }
      else alert(data.error === "no_analysis" ? "Add at least one transcript first." : "Analysis failed. Please try again.");
    } catch {
      alert("Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function runInsights() {
    setExtracting(true);
    try {
      const res = await fetch("/api/application/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: application.id }),
      });
      const data = await res.json();
      if (res.ok && data.insights) { setInsights(data.insights); setInsightsOpen(true); }
      else alert(data.error === "no_insights" ? "Add at least one transcript first." : "Could not extract insights. Please try again.");
    } catch {
      alert("Could not extract insights. Please try again.");
    } finally {
      setExtracting(false);
    }
  }

  async function addStage() {
    if (!newStage.trim()) return;
    await call("/api/stage", "POST", { applicationId: application.id, name: newStage.trim(), type: newStageType });
    setNewStage("");
    setNewStageType("technical");
    setAddingStage(false);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background px-3 py-6 sm:px-4 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <button onClick={() => router.back()} className="text-sm text-accent hover:underline">← Back to applications</button>

        <div className="mb-8 mt-4">
          <h1 className="break-words text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{application.company}</h1>
          {application.role && <p className="mt-1 break-words text-muted-foreground">{application.role}</p>}
        </div>

        <JobDescriptionCard
          applicationId={application.id}
          jobTitle={application.jobTitle}
          jobLocation={application.jobLocation}
          jobDescription={application.jobDescription}
        />

        <h2 className="label-mono mb-3 text-[10px] text-muted-foreground">Interview stages</h2>

        <div className="space-y-4">
          {application.stages.map((stage, i) => (
            <StageCard
              key={stage.id}
              stage={stage}
              isFirst={i === 0}
              isLast={i === application.stages.length - 1}
              busy={busy}
              onCall={call}
              applicationId={application.id}
            />
          ))}
          {application.stages.length === 0 && <p className="text-sm text-muted-foreground">No stages yet — add one below.</p>}
        </div>

        {/* add stage */}
        {addingStage ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={newStage}
              onChange={(e) => setNewStage(e.target.value)}
              placeholder="Stage name (e.g. Technical Interview)"
              className={`${fieldBase} flex-1`}
              autoFocus
            />
            <select
              value={newStageType}
              onChange={(e) => setNewStageType(e.target.value)}
              className={fieldBase}
            >
              {STAGE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={addStage} disabled={busy} className={btnPrimary}>Add</button>
              <button onClick={() => { setAddingStage(false); setNewStage(""); setNewStageType("technical"); }} className="px-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingStage(true)} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground">
            + Add stage
          </button>
        )}

        {/* AI analysis */}
        <div className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">Interview analysis</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">AI reviews all your transcripts for this application and highlights patterns.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={runAnalysis}
                disabled={analyzing || totalTranscripts === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-sm transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
              >
                <RefreshIcon />
                {analyzing ? "Analyzing…" : analysis ? "Re-analyze" : "Analyze"}
              </button>
              {analysis && (
                <button onClick={() => setAnalysisOpen((o) => !o)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary" aria-label={analysisOpen ? "Collapse" : "Expand"}>
                  <Chevron open={analysisOpen} />
                </button>
              )}
            </div>
          </div>

          {totalTranscripts === 0 && (
            <p className="mt-3 text-xs text-muted-foreground">Add at least one transcript above to enable analysis.</p>
          )}

          {analysis && analysisOpen && (
            <div className="mt-4 border-t border-border pt-4">
              <AnalysisView raw={analysis} />
              <p className="mt-4 text-[11px] text-muted-foreground">
                Based on your recorded conversations, including the interviewers&apos; responses. It reflects how the discussions went, not any private post-interview decision.
              </p>
            </div>
          )}

          {analysis && !analysisOpen && (
            <button onClick={() => setAnalysisOpen(true)} className="mt-3 text-sm text-accent hover:underline">
              Show analysis
            </button>
          )}
        </div>

        {/* Interview insights */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">Interview insights</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Key facts pulled from your transcripts — stack, team, product, comp, and next steps.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={runInsights}
                disabled={extracting || totalTranscripts === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-sm transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
              >
                <RefreshIcon />
                {extracting ? "Extracting…" : insights ? "Refresh insights" : "Extract insights"}
              </button>
              {insights && (
                <button onClick={() => setInsightsOpen((o) => !o)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary" aria-label={insightsOpen ? "Collapse" : "Expand"}>
                  <Chevron open={insightsOpen} />
                </button>
              )}
            </div>
          </div>

          {totalTranscripts === 0 && (
            <p className="mt-3 text-xs text-muted-foreground">Add at least one transcript above to enable insights.</p>
          )}

          {insights && insightsOpen && <InsightsView insights={insights} />}

          {insights && !insightsOpen && (
            <button onClick={() => setInsightsOpen(true)} className="mt-3 text-sm text-accent hover:underline">
              Show insights
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

const StageCard = memo(function StageCard({ stage, isFirst, isLast, busy, onCall, applicationId }: { stage: StageT; isFirst: boolean; isLast: boolean; busy: boolean; onCall: Caller; applicationId: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(stage.name);
  const [type, setType] = useState(stage.type || "other");
  const [scheduledLocal, setScheduledLocal] = useState(toLocalInput(stage.scheduledAt));
  const [addingT, setAddingT] = useState(false);
  const [tContent, setTContent] = useState("");
  const [tLabel, setTLabel] = useState("");

  const [prep, setPrep] = useState<Prep | null>(null);
  const [prepping, setPrepping] = useState(false);
  const [prepOpen, setPrepOpen] = useState(false);

  const isUpcoming = stage.transcripts.length === 0;

  async function runPrep() {
    setPrepping(true);
    try {
      const res = await fetch("/api/application/prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, stageId: stage.id }),
      });
      const data = await res.json();
      if (res.ok && data.prep) { setPrep(data.prep); setPrepOpen(true); }
      else alert("Could not generate prep. Please try again.");
    } catch {
      alert("Could not generate prep. Please try again.");
    } finally {
      setPrepping(false);
    }
  }

  async function saveEdit() {
    if (!name.trim()) return;
    await onCall("/api/stage", "PATCH", { id: stage.id, name: name.trim(), type, scheduledAt: scheduledLocal ? new Date(scheduledLocal).toISOString() : null });
    setEditing(false);
  }
  function cancelEdit() {
    setName(stage.name);
    setType(stage.type || "other");
    setScheduledLocal(toLocalInput(stage.scheduledAt));
    setEditing(false);
  }
  async function del() {
    if (!window.confirm(`Delete the "${stage.name}" stage and its transcripts?`)) return;
    await onCall("/api/stage", "DELETE", { id: stage.id });
  }
  async function addTranscript() {
    if (!tContent.trim()) return;
    await onCall("/api/transcript", "POST", { stageId: stage.id, content: tContent, label: tLabel || undefined });
    setTContent(""); setTLabel(""); setAddingT(false);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-2">
        {editing ? (
          <div className="flex flex-1 flex-col gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Round name (e.g. Technical round)" className={`${fieldBase} w-full !py-1.5`} autoFocus />
            <div className="flex flex-wrap items-center gap-2">
              <DateTimePicker value={scheduledLocal} onChange={setScheduledLocal} />
              <select value={type} onChange={(e) => setType(e.target.value)} className={`${fieldBase} !px-2 !py-1.5`}>
                {STAGE_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button onClick={saveEdit} disabled={busy} className="text-sm font-medium text-accent">Save</button>
              <button onClick={cancelEdit} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="break-words font-semibold text-foreground">{stage.name}</span>
              {stage.type && stage.type !== "other" && (
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{stageTypeLabel(stage.type)}</span>
              )}
              {stage.scheduledAt && (
                <span className="shrink-0 rounded-full bg-success-muted px-2 py-0.5 text-[11px] font-medium text-success">
                  {new Date(stage.scheduledAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button onClick={() => onCall("/api/stage", "PATCH", { id: stage.id, move: "up" })} disabled={busy || isFirst} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent" title="Move up"><ChevronUpDown dir="up" /></button>
              <button onClick={() => onCall("/api/stage", "PATCH", { id: stage.id, move: "down" })} disabled={busy || isLast} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent" title="Move down"><ChevronUpDown dir="down" /></button>
              <span className="mx-1 h-5 w-px bg-border" />
              <button onClick={() => { setName(stage.name); setType(stage.type || "other"); setScheduledLocal(toLocalInput(stage.scheduledAt)); setEditing(true); }} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"><PencilIcon /> Rename</button>
              <button onClick={del} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-danger-muted hover:text-danger"><TrashIcon /> Delete</button>
            </div>
          </>
        )}
      </div>

      {/* Prep card — only for upcoming rounds (no transcript yet) */}
      {isUpcoming && (
        <div className="mt-3">
          {!prep ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/20 bg-gradient-to-br from-accent/10 to-transparent p-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                </span>
                <p className="text-sm font-medium text-foreground">Get ready for this round</p>
              </div>
              <button onClick={runPrep} disabled={prepping} className="shrink-0 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground shadow-sm transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-60">
                {prepping ? "Preparing…" : "Prep me"}
              </button>
            </div>
          ) : prepOpen ? (
            <PrepView prep={prep} onRegenerate={runPrep} regenerating={prepping} onCollapse={() => setPrepOpen(false)} />
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-accent/20 bg-accent/[0.06] p-3">
              <span className="text-sm font-medium text-foreground">Interview prep ready</span>
              <button onClick={() => setPrepOpen(true)} className="shrink-0 text-sm font-medium text-accent hover:opacity-70">Show prep</button>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {stage.transcripts.map((t) => (
          <TranscriptItem key={t.id} transcript={t} busy={busy} onCall={onCall} />
        ))}
      </div>

      {addingT ? (
        <div className="mt-3 border-t border-border pt-3">
          <input value={tLabel} onChange={(e) => setTLabel(e.target.value)} placeholder="Label (optional, e.g. interviewer name)" className={`${fieldBase} mb-2 w-full`} />
          <textarea value={tContent} onChange={(e) => setTContent(e.target.value)} placeholder="Paste the interview transcript here…" rows={6} className={`${fieldBase} w-full`} autoFocus />
          <div className="mt-2 flex gap-2">
            <button onClick={addTranscript} disabled={busy} className={btnPrimary}>Save transcript</button>
            <button onClick={() => { setAddingT(false); setTContent(""); setTLabel(""); }} className="px-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAddingT(true)} disabled={busy} className="mt-3 text-sm text-accent hover:underline">+ Add transcript</button>
      )}
    </div>
  );
});

const TranscriptItem = memo(function TranscriptItem({ transcript, busy, onCall }: { transcript: TranscriptT; busy: boolean; onCall: Caller }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(transcript.content);
  const [label, setLabel] = useState(transcript.label || "");

  async function save() {
    await onCall("/api/transcript", "PATCH", { id: transcript.id, content, label });
    setEditing(false);
  }
  async function del() {
    if (!window.confirm("Delete this transcript?")) return;
    await onCall("/api/transcript", "DELETE", { id: transcript.id });
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-border bg-secondary p-3">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" className={`${fieldBase} mb-2 w-full`} />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} className={`${fieldBase} w-full`} />
        <div className="mt-2 flex gap-2">
          <button onClick={save} disabled={busy} className={btnPrimary}>Save</button>
          <button onClick={() => { setEditing(false); setContent(transcript.content); setLabel(transcript.label || ""); }} className="px-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
        </div>
      </div>
    );
  }

  const preview = transcript.content.length > 140 ? transcript.content.slice(0, 140) + "…" : transcript.content;

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" /></svg>
          </span>
          <div className="min-w-0">
            <span className="block break-words text-sm font-medium text-foreground">{transcript.label || "Transcript"}</span>
            {expanded ? (
              <pre className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm text-muted-foreground">{transcript.content}</pre>
            ) : (
              <p className="mt-1 break-words text-sm text-muted-foreground">{preview}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => setExpanded((e) => !e)} className="text-xs font-medium text-accent hover:underline">{expanded ? "Collapse" : "View"}</button>
          <button onClick={() => setEditing(true)} disabled={busy} className="text-xs text-muted-foreground hover:text-foreground">Edit</button>
          <button onClick={del} disabled={busy} className="text-xs text-muted-foreground hover:text-danger">Delete</button>
        </div>
      </div>
    </div>
  );
});

// ---------- Insights rendering ----------

function InsightsView({ insights }: { insights: Insights }) {
  const rows = useMemo(() => {
    const out: { label: string; value: ReactNode }[] = [];
    if (insights.techStack && insights.techStack.length > 0)
      out.push({
        label: "Tech stack",
        value: (
          <div className="flex flex-wrap gap-1.5">
            {insights.techStack.map((t, i) => (
              <span key={i} className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">{t}</span>
            ))}
          </div>
        ),
      });
    if (insights.teamSize) out.push({ label: "Team size", value: insights.teamSize });
    if (insights.teamStructure) out.push({ label: "Team structure", value: insights.teamStructure });
    if (insights.product) out.push({ label: "Product", value: insights.product });
    if (insights.payRange) out.push({ label: "Pay range", value: insights.payRange });
    if (insights.nextSteps) out.push({ label: "Next steps", value: insights.nextSteps });
    return out;
  }, [insights]);

  const hasNotes = !!(insights.notes && insights.notes.length > 0);

  if (rows.length === 0 && !hasNotes) {
    return <p className="mt-3 text-xs text-muted-foreground">No specific details were found in the transcripts yet.</p>;
  }

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      {rows.map((r, i) => (
        <div key={i} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
          <span className="label-mono shrink-0 pt-0.5 text-[10px] text-muted-foreground sm:w-32">{r.label}</span>
          <div className="flex-1 break-words text-sm text-foreground">{r.value}</div>
        </div>
      ))}
      {hasNotes && (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
          <span className="label-mono shrink-0 pt-0.5 text-[10px] text-muted-foreground sm:w-32">Notes</span>
          <ul className="flex-1 space-y-1 text-sm text-foreground">
            {insights.notes!.map((n, i) => (
              <li key={i} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" /><span className="break-words">{n}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------- Analysis rendering (readiness + collapsible cards) ----------

type AnalysisSection = { type: string; points: string[] };
type Readiness = { band: string; reason?: string };
type ParsedAnalysis = { readiness?: Readiness; headline?: string; sections: AnalysisSection[] };

function parseAnalysis(raw: string): ParsedAnalysis | null {
  try {
    const p = JSON.parse(raw);
    if (p && Array.isArray(p.sections)) return p as ParsedAnalysis;
  } catch {
    // not JSON
  }
  return null;
}

const SECTION_META: Record<string, { label: string; badge: string; dot: string; ring: string }> = {
  strengths: { label: "What you did well", badge: "bg-success-muted text-success", dot: "bg-success", ring: "border-success/25" },
  struggles: { label: "Where you struggled", badge: "bg-warning-muted text-warning", dot: "bg-warning", ring: "border-warning/25" },
  unsure: { label: "Questions you were unsure of", badge: "bg-danger-muted text-danger", dot: "bg-danger", ring: "border-danger/25" },
  patterns: { label: "Recurring patterns", badge: "bg-secondary text-muted-foreground", dot: "bg-muted-foreground", ring: "border-border" },
  actions: { label: "Do differently next time", badge: "bg-accent/10 text-accent", dot: "bg-accent", ring: "border-accent/30" },
};

const SECTION_ORDER = ["strengths", "struggles", "unsure", "patterns", "actions"];

function SectionIcon({ type }: { type: string }) {
  const c = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "strengths") return <svg {...c}><path d="M20 6 9 17l-5-5" /></svg>;
  if (type === "struggles") return <svg {...c}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
  if (type === "unsure") return <svg {...c}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
  if (type === "patterns") return <svg {...c}><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>;
  if (type === "actions") return <svg {...c}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
  return <svg {...c}><circle cx="12" cy="12" r="10" /></svg>;
}

function ReadinessBand({ readiness }: { readiness: Readiness }) {
  const meta =
    ({
      strong: { label: "Strong", wrap: "bg-success-muted border-success/25", text: "text-success", seg: "bg-success", filled: 3 },
      mixed: { label: "Mixed", wrap: "bg-warning-muted border-warning/25", text: "text-warning", seg: "bg-warning", filled: 2 },
      needs_work: { label: "Needs work", wrap: "bg-danger-muted border-danger/25", text: "text-danger", seg: "bg-danger", filled: 1 },
    } as Record<string, { label: string; wrap: string; text: string; seg: string; filled: number }>)[readiness.band] ||
    { label: readiness.band, wrap: "bg-secondary border-border", text: "text-foreground", seg: "bg-muted-foreground", filled: 0 };

  return (
    <div className={`mb-4 rounded-2xl border ${meta.wrap} p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-mono text-[11px] text-muted-foreground">Interview readiness</p>
          <p className={`text-lg font-bold ${meta.text}`}>{meta.label}</p>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-2 w-8 rounded-full ${i < meta.filled ? meta.seg : "bg-secondary"}`} />
          ))}
        </div>
      </div>
      {readiness.reason && <p className="mt-2 break-words text-sm text-muted-foreground">{readiness.reason}</p>}
    </div>
  );
}

function CollapsibleSection({ section, defaultOpen }: { section: AnalysisSection; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = SECTION_META[section.type] || { label: section.type, badge: "bg-secondary text-muted-foreground", dot: "bg-muted-foreground", ring: "border-border" };
  const emphasize = section.type === "actions";

  return (
    <div className={`overflow-hidden rounded-xl border ${meta.ring} ${emphasize ? "bg-accent/[0.05]" : "bg-card"}`}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 p-4 text-left transition hover:bg-foreground/[0.02]">
        <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${meta.badge}`}>
          <SectionIcon type={section.type} />
        </span>
        <h3 className="flex-1 break-words text-sm font-semibold text-foreground">{meta.label}</h3>
        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{section.points.length}</span>
        <span className={`text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </span>
      </button>
      {open && (
        <ul className="space-y-1.5 px-4 pb-4">
          {section.points.map((p, j) => (
            <li key={j} className="flex gap-2.5 text-sm leading-relaxed text-foreground/80">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
              <span className="break-words">{p}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function JobDescriptionCard({
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

function PrepView({ prep, onRegenerate, regenerating, onCollapse }: { prep: Prep; onRegenerate: () => void; regenerating: boolean; onCollapse: () => void }) {
  const blocks: { label: string; items: string[]; dot: string }[] = [];
  if (prep.focusAreas?.length) blocks.push({ label: "What to cover", items: prep.focusAreas, dot: "bg-accent" });
  if (prep.questionsToAsk?.length) blocks.push({ label: "Smart questions to ask", items: prep.questionsToAsk, dot: "bg-success" });
  if (prep.watchOuts?.length) blocks.push({ label: "Watch out for", items: prep.watchOuts, dot: "bg-warning" });

  return (
    <div className="rounded-xl border border-accent/20 bg-gradient-to-br from-accent/[0.08] to-transparent p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/></svg>
          </span>
          <h4 className="text-sm font-semibold text-foreground">Interview prep</h4>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={onRegenerate} disabled={regenerating} className="text-xs text-accent hover:opacity-70 disabled:opacity-50">
            {regenerating ? "Refreshing…" : "Regenerate"}
          </button>
          <button onClick={onCollapse} className="rounded-lg p-1.5 hover:bg-accent/10" aria-label="Collapse">
            <Chevron open={true} />
          </button>
        </div>
      </div>

      {prep.encouragement && (
        <p className="mb-3 break-words text-sm text-foreground/80">{prep.encouragement}</p>
      )}

      <div className="space-y-3">
        {blocks.map((b, i) => (
          <div key={i}>
            <p className="label-mono mb-1.5 text-[11px] text-muted-foreground">{b.label}</p>
            <ul className="space-y-1">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2 text-sm leading-relaxed text-foreground/80">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${b.dot}`} />
                  <span className="break-words">{it}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalysisView({ raw }: { raw: string }) {
  const parsed = parseAnalysis(raw);

  // fallback for old plain-text analyses (still fully readable)
  if (!parsed) {
    return <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground/90">{raw}</pre>;
  }

  const sections = parsed.sections
    .filter((s) => s.points && s.points.length > 0)
    .sort((a, b) => SECTION_ORDER.indexOf(a.type) - SECTION_ORDER.indexOf(b.type));

  return (
    <div>
      {parsed.readiness && parsed.readiness.band && <ReadinessBand readiness={parsed.readiness} />}
      {parsed.headline && <p className="mb-4 break-words text-base font-medium text-foreground">{parsed.headline}</p>}
      <div className="space-y-2.5">
        {sections.map((s) => (
          <CollapsibleSection key={s.type} section={s} defaultOpen={s.type === "actions"} />
        ))}
      </div>
    </div>
  );
}