"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppT, Caller, Insights, STAGE_TYPES, fieldBase, btnPrimary } from "../components/application-detail/shared";
import { Chevron, RefreshIcon } from "../components/application-detail/icons";
import { StageCard } from "../components/application-detail/StageCard";
import { InsightsView } from "../components/application-detail/InsightsView";
import { AnalysisView } from "../components/application-detail/AnalysisView";
import { JobDescriptionCard } from "../components/application-detail/JobDescriptionCard";

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
      else if (data.error === "no_analysis") alert("The AI analysis service is busy or rate-limited right now. Please wait a moment and try again."); else if (data.error === "rate_limited") alert("Daily analysis limit reached. Please try again tomorrow."); else alert("Analysis failed. Please try again.");
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
      else if (data.error === "no_insights") alert("The AI service is busy or rate-limited right now. Please wait a moment and try again."); else alert("Could not extract insights. Please try again.");
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
