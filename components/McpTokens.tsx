"use client";

import { useState, useEffect } from "react";

type TokenMeta = { id: string; label: string | null; createdAt: string; lastUsedAt: string | null };

export function McpTokens() {
  const [tokens, setTokens] = useState<TokenMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null); // shown once
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/mcp-tokens")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.tokens)) setTokens(d.tokens); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function create() {
    setCreating(true);
    setNewToken(null);
    try {
      const res = await fetch("/api/mcp-tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: "MCP client" }) });
      const d = await res.json();
      if (d.token) {
        setNewToken(d.token);
        // refresh list
        const list = await (await fetch("/api/mcp-tokens")).json();
        if (Array.isArray(list.tokens)) setTokens(list.tokens);
      }
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this token? Any MCP client using it will stop working.")) return;
    await fetch("/api/mcp-tokens", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setTokens((t) => t.filter((x) => x.id !== id));
  }

  function copyToken() {
    if (!newToken) return;
    navigator.clipboard.writeText(newToken).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 className="text-[15px] font-semibold text-foreground">MCP access tokens</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
        Generate a token to let an external AI client (like Claude Desktop) securely access your applications through this app&apos;s MCP server.
      </p>

      {/* freshly created token — shown once */}
      {newToken && (
        <div className="mt-4 rounded-lg border border-accent/30 bg-accent/[0.06] p-3">
          <p className="text-[12px] font-medium text-foreground">Your new token — copy it now, it won&apos;t be shown again:</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1.5 text-[12px] text-foreground">{newToken}</code>
            <button onClick={copyToken} className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-foreground">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={create}
        disabled={creating}
        className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-all hover:brightness-105 disabled:opacity-50"
      >
        {creating ? "Generating…" : "Generate new token"}
      </button>

      {/* existing tokens */}
      <div className="mt-5">
        {loading ? (
          <p className="text-[13px] text-muted-foreground">Loading…</p>
        ) : tokens.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No tokens yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-foreground">{t.label || "MCP token"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Created {new Date(t.createdAt).toLocaleDateString()}
                    {t.lastUsedAt ? ` · last used ${new Date(t.lastUsedAt).toLocaleDateString()}` : " · never used"}
                  </p>
                </div>
                <button onClick={() => revoke(t.id)} className="shrink-0 text-[12px] text-muted-foreground transition-colors hover:text-danger">
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
