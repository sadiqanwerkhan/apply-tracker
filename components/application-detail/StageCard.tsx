"use client";

import { useState, memo } from "react";
import DateTimePicker from "@/components/DateTimePicker";
import { StageT, TranscriptT, Prep, Caller, STAGE_TYPES, stageTypeLabel, toLocalInput, fieldBase, btnPrimary } from "./shared";
import { PencilIcon, TrashIcon, ChevronUpDown } from "./icons";
import { PrepView } from "../application-detail/PrepView";

export const StageCard = memo(function StageCard({ stage, isFirst, isLast, busy, onCall, applicationId }: { stage: StageT; isFirst: boolean; isLast: boolean; busy: boolean; onCall: Caller; applicationId: string }) {
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
                  {new Date(stage.scheduledAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" })}
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
