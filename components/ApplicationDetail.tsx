"use client";

import { useState, useCallback, useMemo, memo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import LocationSelect from "@/components/LocationSelect";
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

function Chevron({ open }: { open: boolean }) {
  return (
    <span className={`text-gray-400 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
    </span>
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
type StageT = { id: string; name: string; type: string; order: number; result: string | null; transcripts: TranscriptT[] };
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
    <main className="min-h-screen bg-gray-50 py-6 px-3 sm:py-10 sm:px-4">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => router.back()} className="text-sm text-indigo-600 hover:underline">← Back to applications</button>

        <div className="mt-4 mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">{application.company}</h1>
          {application.role && <p className="text-gray-500 mt-1 break-words">{application.role}</p>}
        </div>

        <JobDescriptionCard
          applicationId={application.id}
          jobTitle={application.jobTitle}
          jobLocation={application.jobLocation}
          jobDescription={application.jobDescription}
        />

        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Interview stages</h2>

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
          {application.stages.length === 0 && <p className="text-sm text-gray-400">No stages yet — add one below.</p>}
        </div>

        {/* add stage */}
        {addingStage ? (
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <input
              value={newStage}
              onChange={(e) => setNewStage(e.target.value)}
              placeholder="Stage name (e.g. Technical Interview)"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              autoFocus
            />
            <select
              value={newStageType}
              onChange={(e) => setNewStageType(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {STAGE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={addStage} disabled={busy} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60">Add</button>
              <button onClick={() => { setAddingStage(false); setNewStage(""); setNewStageType("technical"); }} className="text-sm text-gray-500 px-2">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingStage(true)} className="mt-4 inline-flex items-center gap-1.5 border border-gray-300 text-gray-700 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-gray-100">
            + Add stage
          </button>
        )}

        {/* AI analysis */}
        <div className="mt-8 bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Interview analysis</h2>
              <p className="text-xs text-gray-500 mt-0.5">AI reviews all your transcripts for this application and highlights patterns.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={runAnalysis}
                disabled={analyzing || totalTranscripts === 0}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60"
              >
                {analyzing ? "Analyzing…" : analysis ? "Re-analyze" : "Analyze my interviews"}
              </button>
              {analysis && (
                <button onClick={() => setAnalysisOpen((o) => !o)} className="p-2 rounded-lg hover:bg-gray-100" aria-label={analysisOpen ? "Collapse" : "Expand"}>
                  <Chevron open={analysisOpen} />
                </button>
              )}
            </div>
          </div>

          {totalTranscripts === 0 && (
            <p className="text-xs text-gray-400 mt-3">Add at least one transcript above to enable analysis.</p>
          )}

          {analysis && analysisOpen && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <AnalysisView raw={analysis} />
              <p className="text-[11px] text-gray-400 mt-4">
                Based on your recorded conversations, including the interviewers&apos; responses. It reflects how the discussions went, not any private post-interview decision.
              </p>
            </div>
          )}

          {analysis && !analysisOpen && (
            <button onClick={() => setAnalysisOpen(true)} className="mt-3 text-sm text-indigo-600 hover:underline">
              Show analysis
            </button>
          )}
        </div>

        {/* Interview insights */}
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Interview insights</h2>
              <p className="text-xs text-gray-500 mt-0.5">Key facts pulled from your transcripts — stack, team, product, comp, and next steps.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={runInsights}
                disabled={extracting || totalTranscripts === 0}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60"
              >
                {extracting ? "Extracting…" : insights ? "Refresh insights" : "Extract insights"}
              </button>
              {insights && (
                <button onClick={() => setInsightsOpen((o) => !o)} className="p-2 rounded-lg hover:bg-gray-100" aria-label={insightsOpen ? "Collapse" : "Expand"}>
                  <Chevron open={insightsOpen} />
                </button>
              )}
            </div>
          </div>

          {totalTranscripts === 0 && (
            <p className="text-xs text-gray-400 mt-3">Add at least one transcript above to enable insights.</p>
          )}

          {insights && insightsOpen && <InsightsView insights={insights} />}

          {insights && !insightsOpen && (
            <button onClick={() => setInsightsOpen(true)} className="mt-3 text-sm text-indigo-600 hover:underline">
              Show insights
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "phone_screen", label: "Phone screen" },
  { value: "technical", label: "Technical" },
  { value: "system_design", label: "System design" },
  { value: "cultural_fit", label: "Cultural fit" },
  { value: "hr", label: "HR" },
  { value: "final", label: "Final" },
  { value: "other", label: "Other" },
];
const typeLabel = (t: string) => TYPE_OPTIONS.find((o) => o.value === t)?.label || "";

const StageCard = memo(function StageCard({ stage, isFirst, isLast, busy, onCall, applicationId }: { stage: StageT; isFirst: boolean; isLast: boolean; busy: boolean; onCall: Caller; applicationId: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(stage.name);
  const [type, setType] = useState(stage.type || "other");
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
    await onCall("/api/stage", "PATCH", { id: stage.id, name: name.trim(), type });
    setEditing(false);
  }
  function cancelEdit() {
    setName(stage.name);
    setType(stage.type || "other");
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
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-2">
        {editing ? (
          <div className="flex-1 flex flex-col gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Round name (e.g. Technical round)" className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" autoFocus />
            <div className="flex items-center gap-2 flex-wrap">
              <select value={type} onChange={(e) => setType(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white">
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button onClick={saveEdit} disabled={busy} className="text-sm text-indigo-600 font-medium">Save</button>
              <button onClick={cancelEdit} className="text-sm text-gray-500">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="font-semibold text-gray-800 break-words">{stage.name}</span>
              {stage.type && stage.type !== "other" && (
                <span className="text-[11px] font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5 shrink-0">{typeLabel(stage.type)}</span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => onCall("/api/stage", "PATCH", { id: stage.id, move: "up" })} disabled={busy || isFirst} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Move up">▲</button>
              <button onClick={() => onCall("/api/stage", "PATCH", { id: stage.id, move: "down" })} disabled={busy || isLast} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Move down">▼</button>
              <button onClick={() => setEditing(true)} disabled={busy} className="px-1 text-xs text-gray-500 hover:text-gray-800">Edit</button>
              <button onClick={del} disabled={busy} className="px-1 text-xs text-gray-500 hover:text-red-600">Delete</button>
            </div>
          </>
        )}
      </div>

      {/* Prep card — only for upcoming rounds (no transcript yet) */}
      {isUpcoming && (
        <div className="mt-3">
          {!prep ? (
            <div className="rounded-lg border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-indigo-100 text-indigo-600 shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                </span>
                <p className="text-sm text-indigo-900 font-medium">Get ready for this round</p>
              </div>
              <button onClick={runPrep} disabled={prepping} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg disabled:opacity-60 shrink-0">
                {prepping ? "Preparing…" : "Prep me"}
              </button>
            </div>
          ) : prepOpen ? (
            <PrepView prep={prep} onRegenerate={runPrep} regenerating={prepping} onCollapse={() => setPrepOpen(false)} />
          ) : (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 flex items-center justify-between gap-3">
              <span className="text-sm text-indigo-900 font-medium">Interview prep ready</span>
              <button onClick={() => setPrepOpen(true)} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium shrink-0">Show prep</button>
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
        <div className="mt-3 border-t border-gray-100 pt-3">
          <input value={tLabel} onChange={(e) => setTLabel(e.target.value)} placeholder="Label (optional, e.g. interviewer name)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2" />
          <textarea value={tContent} onChange={(e) => setTContent(e.target.value)} placeholder="Paste the interview transcript here…" rows={6} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" autoFocus />
          <div className="flex gap-2 mt-2">
            <button onClick={addTranscript} disabled={busy} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60">Save transcript</button>
            <button onClick={() => { setAddingT(false); setTContent(""); setTLabel(""); }} className="text-sm text-gray-500 px-2">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAddingT(true)} disabled={busy} className="mt-3 text-sm text-indigo-600 hover:underline">+ Add transcript</button>
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
      <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2" />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <div className="flex gap-2 mt-2">
          <button onClick={save} disabled={busy} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60">Save</button>
          <button onClick={() => { setEditing(false); setContent(transcript.content); setLabel(transcript.label || ""); }} className="text-sm text-gray-500 px-2">Cancel</button>
        </div>
      </div>
    );
  }

  const preview = transcript.content.length > 140 ? transcript.content.slice(0, 140) + "…" : transcript.content;

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-700 break-words">{transcript.label || "Transcript"}</span>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setExpanded((e) => !e)} className="text-xs text-indigo-600 hover:underline">{expanded ? "Collapse" : "View"}</button>
          <button onClick={() => setEditing(true)} disabled={busy} className="text-xs text-gray-500 hover:text-gray-800">Edit</button>
          <button onClick={del} disabled={busy} className="text-xs text-gray-500 hover:text-red-600">Delete</button>
        </div>
      </div>
      {expanded ? (
        <pre className="text-sm text-gray-600 mt-2 whitespace-pre-wrap break-words font-sans max-h-96 overflow-y-auto">{transcript.content}</pre>
      ) : (
        <p className="text-sm text-gray-400 mt-1 break-words">{preview}</p>
      )}
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
              <span key={i} className="bg-indigo-50 text-indigo-700 rounded-full px-2.5 py-0.5 text-xs font-medium">{t}</span>
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
    return <p className="text-xs text-gray-400 mt-3">No specific details were found in the transcripts yet.</p>;
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 sm:w-32 shrink-0 pt-0.5">{r.label}</span>
          <div className="text-sm text-gray-700 break-words flex-1">{r.value}</div>
        </div>
      ))}
      {hasNotes && (
        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 sm:w-32 shrink-0 pt-0.5">Notes</span>
          <ul className="text-sm text-gray-700 space-y-1 flex-1">
            {insights.notes!.map((n, i) => (
              <li key={i} className="flex gap-2"><span className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400" /><span className="break-words">{n}</span></li>
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
  strengths: { label: "What you did well", badge: "bg-green-100 text-green-600", dot: "bg-green-500", ring: "border-green-200" },
  struggles: { label: "Where you struggled", badge: "bg-amber-100 text-amber-600", dot: "bg-amber-500", ring: "border-amber-200" },
  unsure: { label: "Questions you were unsure of", badge: "bg-red-100 text-red-600", dot: "bg-red-500", ring: "border-red-200" },
  patterns: { label: "Recurring patterns", badge: "bg-purple-100 text-purple-600", dot: "bg-purple-500", ring: "border-purple-200" },
  actions: { label: "Do differently next time", badge: "bg-indigo-100 text-indigo-600", dot: "bg-indigo-500", ring: "border-indigo-300" },
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
      strong: { label: "Strong", wrap: "bg-green-50 border-green-200", text: "text-green-700", seg: "bg-green-500", filled: 3 },
      mixed: { label: "Mixed", wrap: "bg-amber-50 border-amber-200", text: "text-amber-700", seg: "bg-amber-500", filled: 2 },
      needs_work: { label: "Needs work", wrap: "bg-red-50 border-red-200", text: "text-red-700", seg: "bg-red-500", filled: 1 },
    } as Record<string, { label: string; wrap: string; text: string; seg: string; filled: number }>)[readiness.band] ||
    { label: readiness.band, wrap: "bg-gray-50 border-gray-200", text: "text-gray-700", seg: "bg-gray-400", filled: 0 };

  return (
    <div className={`rounded-xl border ${meta.wrap} p-4 mb-4`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Interview readiness</p>
          <p className={`text-lg font-bold ${meta.text}`}>{meta.label}</p>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-2 w-8 rounded-full ${i < meta.filled ? meta.seg : "bg-gray-200"}`} />
          ))}
        </div>
      </div>
      {readiness.reason && <p className="text-sm text-gray-600 mt-2 break-words">{readiness.reason}</p>}
    </div>
  );
}

function CollapsibleSection({ section, defaultOpen }: { section: AnalysisSection; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = SECTION_META[section.type] || { label: section.type, badge: "bg-gray-100 text-gray-600", dot: "bg-gray-400", ring: "border-gray-200" };
  const emphasize = section.type === "actions";

  return (
    <div className={`rounded-xl border ${meta.ring} ${emphasize ? "bg-indigo-50/40" : "bg-white"} overflow-hidden`}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 p-4 text-left hover:bg-black/[0.02] transition">
        <span className={`inline-flex items-center justify-center h-6 w-6 rounded-lg shrink-0 ${meta.badge}`}>
          <SectionIcon type={section.type} />
        </span>
        <h3 className="text-sm font-semibold text-gray-800 flex-1 break-words">{meta.label}</h3>
        <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5 shrink-0">{section.points.length}</span>
        <span className={`text-gray-400 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </span>
      </button>
      {open && (
        <ul className="px-4 pb-4 space-y-1.5">
          {section.points.map((p, j) => (
            <li key={j} className="flex gap-2.5 text-sm text-gray-700 leading-relaxed">
              <span className={`shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full ${meta.dot}`} />
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
      <div className="mb-6 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-medium text-indigo-900">
            {hasJD ? "Job description added" : "Add the job description for sharper results"}
          </p>
          <p className="text-xs text-indigo-700/70 mt-0.5">
            {hasJD
              ? "Your analysis and interview prep use it."
              : "Optional — paste the JD and your analysis and prep become tailored to this role."}
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50 text-sm font-medium px-4 py-2 rounded-lg shrink-0"
        >
          {hasJD ? "Edit job description" : "Add job description"}
        </button>
      </div>
    );
  }

  // expanded editor
  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Job description</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Job title (optional)" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <LocationSelect value={location} onChange={setLocation} />
      </div>
      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Paste the full job description here…"
        rows={8}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-3"
      />
      <div className="flex gap-2 mt-3">
        <button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60">
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setOpen(false)} disabled={saving} className="text-sm text-gray-500 px-3">Cancel</button>
      </div>
    </div>
  );
}

function PrepView({ prep, onRegenerate, regenerating, onCollapse }: { prep: Prep; onRegenerate: () => void; regenerating: boolean; onCollapse: () => void }) {
  const blocks: { label: string; items: string[]; badge: string; dot: string }[] = [];
  if (prep.focusAreas?.length) blocks.push({ label: "What to cover", items: prep.focusAreas, badge: "bg-indigo-100 text-indigo-600", dot: "bg-indigo-500" });
  if (prep.questionsToAsk?.length) blocks.push({ label: "Smart questions to ask", items: prep.questionsToAsk, badge: "bg-emerald-100 text-emerald-600", dot: "bg-emerald-500" });
  if (prep.watchOuts?.length) blocks.push({ label: "Watch out for", items: prep.watchOuts, badge: "bg-amber-100 text-amber-600", dot: "bg-amber-500" });

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-white p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-indigo-100 text-indigo-600 shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/></svg>
          </span>
          <h4 className="text-sm font-semibold text-indigo-900">Interview prep</h4>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onRegenerate} disabled={regenerating} className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50">
            {regenerating ? "Refreshing…" : "Regenerate"}
          </button>
          <button onClick={onCollapse} className="p-1.5 rounded-lg hover:bg-indigo-100/60" aria-label="Collapse">
            <Chevron open={true} />
          </button>
        </div>
      </div>

      {prep.encouragement && (
        <p className="text-sm text-gray-700 mb-3 break-words">{prep.encouragement}</p>
      )}

      <div className="space-y-3">
        {blocks.map((b, i) => (
          <div key={i}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">{b.label}</p>
            <ul className="space-y-1">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
                  <span className={`shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full ${b.dot}`} />
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
    return <pre className="text-sm text-gray-700 whitespace-pre-wrap break-words font-sans leading-relaxed">{raw}</pre>;
  }

  const sections = parsed.sections
    .filter((s) => s.points && s.points.length > 0)
    .sort((a, b) => SECTION_ORDER.indexOf(a.type) - SECTION_ORDER.indexOf(b.type));

  return (
    <div>
      {parsed.readiness && parsed.readiness.band && <ReadinessBand readiness={parsed.readiness} />}
      {parsed.headline && <p className="text-base text-gray-800 font-medium mb-4 break-words">{parsed.headline}</p>}
      <div className="space-y-2.5">
        {sections.map((s) => (
          <CollapsibleSection key={s.type} section={s} defaultOpen={s.type === "actions"} />
        ))}
      </div>
    </div>
  );
}
