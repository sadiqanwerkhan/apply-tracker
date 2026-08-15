"use client";

import { useState, useRef, useEffect } from "react";

type Provider = "groq" | "gemini";
type Msg = { role: "user" | "assistant"; text: string; toolsUsed?: string[]; provider?: string; error?: boolean };

const PROVIDER_LABELS: Record<Provider, string> = {
  groq: "Groq (fast)",
  gemini: "Gemini",
};

export function AskChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [provider, setProvider] = useState<Provider>("groq");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, provider }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", text: friendlyError(data), error: true }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", text: data.answer, toolsUsed: data.toolsUsed, provider: data.provider }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Something went wrong. Please try again.", error: true }]);
    } finally {
      setLoading(false);
    }
  }

  function friendlyError(data: { error?: string; detail?: string }): string {
    if (data?.detail?.includes("Missing")) return "This model isn't configured yet. Add its API key to use it.";
    if (data?.error === "rate_limited") return "You've hit today's question limit. Try again tomorrow.";
    return "Sorry — I couldn't answer that. Please try again.";
  }

  const suggestions = [
    "Which companies did I apply to?",
    "Where was I rejected, and why?",
    "What stages was I in at my last interview?",
  ];

  return (
    <div className="flex h-[70vh] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-card">
      {/* header with model selector */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Ask about your applications</h2>
          <p className="text-[12px] text-muted-foreground">Answers use your real interview data.</p>
        </div>
        <label className="flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground">
          <span className="hidden sm:inline">Model</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
            className="rounded-lg border border-input bg-background px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-accent"
          >
            <option value="groq">{PROVIDER_LABELS.groq}</option>
            <option value="gemini">{PROVIDER_LABELS.gemini}</option>
          </select>
        </label>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="max-w-xs text-sm text-muted-foreground">
              Ask a question about your job search — like the ones below.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-[12.5px] text-foreground/80 transition-colors hover:bg-secondary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-sm text-accent-foreground"
                  : `max-w-[85%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm ${m.error ? "bg-danger-muted text-danger" : "bg-secondary text-foreground"}`
              }
            >
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
              {m.toolsUsed && m.toolsUsed.length > 0 && (
                <p className="mt-1.5 text-[11px] opacity-60">
                  looked up: {[...new Set(m.toolsUsed)].map((t) => t.replace(/_/g, " ")).join(", ")}
                </p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-secondary px-4 py-3">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* input */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Ask about your applications…"
            rows={1}
            className="max-h-32 flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/70 focus:border-accent focus:ring-4 focus:ring-accent/12"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground shadow-sm transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
