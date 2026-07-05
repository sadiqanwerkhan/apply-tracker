"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type TranscriptT = { id: string; label: string | null; content: string };
type StageT = { id: string; name: string; order: number; result: string | null; transcripts: TranscriptT[] };
type AppT = { id: string; company: string; role: string; analysis: string | null; analysisAt: string | null; stages: StageT[] };

type Caller = (url: string, method: string, body: object) => Promise<void>;

export default function ApplicationDetail({ application }: { application: AppT }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [newStage, setNewStage] = useState("");
  const [addingStage, setAddingStage] = useState(false);

  const call: Caller = async (url, method, body) => {
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
  };

  const [analysis, setAnalysis] = useState<string | null>(application.analysis);
  const [analyzing, setAnalyzing] = useState(false);

  const totalTranscripts = application.stages.reduce((n, s) => n + s.transcripts.length, 0);

  async function runAnalysis() {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/application/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: application.id }),
      });
      const data = await res.json();
      if (res.ok && data.analysis) setAnalysis(data.analysis);
      else alert(data.error === "no_analysis" ? "Add at least one transcript first." : "Analysis failed. Please try again.");
    } catch {
      alert("Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function addStage() {
    if (!newStage.trim()) return;
    await call("/api/stage", "POST", { applicationId: application.id, name: newStage.trim() });
    setNewStage("");
    setAddingStage(false);
  }

  return (
    <main className="min-h-screen bg-gray-50 py-6 px-3 sm:py-10 sm:px-4">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-sm text-indigo-600 hover:underline">← Back to applications</Link>

        <div className="mt-4 mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">{application.company}</h1>
          {application.role && <p className="text-gray-500 mt-1 break-words">{application.role}</p>}
        </div>

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
            />
          ))}
          {application.stages.length === 0 && <p className="text-sm text-gray-400">No stages yet — add one below.</p>}
        </div>

        {/* AI analysis */}
        <div className="mt-8 bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Interview analysis</h2>
              <p className="text-xs text-gray-500 mt-0.5">AI reviews all your transcripts for this application and highlights patterns.</p>
            </div>
            <button
              onClick={runAnalysis}
              disabled={analyzing || totalTranscripts === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60 shrink-0"
            >
              {analyzing ? "Analyzing…" : analysis ? "Re-analyze" : "Analyze my interviews"}
            </button>
          </div>

          {totalTranscripts === 0 && (
            <p className="text-xs text-gray-400 mt-3">Add at least one transcript above to enable analysis.</p>
          )}

          {analysis && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap break-words font-sans leading-relaxed">{analysis}</pre>
              <p className="text-[11px] text-gray-400 mt-3">
                This reflects how the conversations went, based only on your transcripts — not the interviewers&apos; private reasons.
              </p>
            </div>
          )}
        </div>

        {addingStage ? (
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <input
              value={newStage}
              onChange={(e) => setNewStage(e.target.value)}
              placeholder="Stage name (e.g. Technical Interview)"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={addStage} disabled={busy} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60">Add</button>
              <button onClick={() => { setAddingStage(false); setNewStage(""); }} className="text-sm text-gray-500 px-2">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingStage(true)} className="mt-4 inline-flex items-center gap-1.5 border border-gray-300 text-gray-700 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-gray-100">
            + Add stage
          </button>
        )}
      </div>
    </main>
  );
}

function StageCard({ stage, isFirst, isLast, busy, onCall }: { stage: StageT; isFirst: boolean; isLast: boolean; busy: boolean; onCall: Caller }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(stage.name);
  const [addingT, setAddingT] = useState(false);
  const [tContent, setTContent] = useState("");
  const [tLabel, setTLabel] = useState("");

  async function rename() {
    if (!name.trim()) return;
    await onCall("/api/stage", "PATCH", { id: stage.id, name: name.trim() });
    setRenaming(false);
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
        {renaming ? (
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 min-w-[140px] border border-gray-300 rounded-lg px-3 py-1.5 text-sm" autoFocus />
            <button onClick={rename} disabled={busy} className="text-sm text-indigo-600 font-medium">Save</button>
            <button onClick={() => { setRenaming(false); setName(stage.name); }} className="text-sm text-gray-500">Cancel</button>
          </div>
        ) : (
          <>
            <span className="font-semibold text-gray-800 break-words">{stage.name}</span>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => onCall("/api/stage", "PATCH", { id: stage.id, move: "up" })} disabled={busy || isFirst} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Move up">▲</button>
              <button onClick={() => onCall("/api/stage", "PATCH", { id: stage.id, move: "down" })} disabled={busy || isLast} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Move down">▼</button>
              <button onClick={() => setRenaming(true)} disabled={busy} className="px-1 text-xs text-gray-500 hover:text-gray-800">Rename</button>
              <button onClick={del} disabled={busy} className="px-1 text-xs text-gray-500 hover:text-red-600">Delete</button>
            </div>
          </>
        )}
      </div>

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
}

function TranscriptItem({ transcript, busy, onCall }: { transcript: TranscriptT; busy: boolean; onCall: Caller }) {
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
}