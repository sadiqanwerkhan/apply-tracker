"use client";

import Link from "next/link";
import { useState } from "react";
import { Zap, RefreshCw, LogOut, Bell, Home, MessageSquare, BarChart3, User, Menu, X } from "lucide-react";
import { useApplications } from "@/hooks/useApplications";
import ScanControls from "@/components/ScanControls";
import FilterPills from "@/components/FilterPills";
import SearchSort from "@/components/SearchSort";
import ApplicationsTable from "@/components/ApplicationsTable";
import Pagination from "@/components/Pagination";
import ExportControls from "@/components/ExportControls";
import ScanningQuote from "@/components/ScanningQuote";
import StatsSummary from "@/components/StatsSummary";
import ThemeToggle from "./ThemeToggle";
import Button from "@/components/ui/Button";

type Props = {
  userEmail: string;
  onSignOut: () => Promise<void>;
  onReconnect: () => Promise<void>;
};

export default function Dashboard({ userEmail, onSignOut, onReconnect }: Props) {
  const app = useApplications();
  const busy = app.initialLoading || app.scanning;

  const [reclassifying, setReclassifying] = useState(false);
  const [reclassMsg, setReclassMsg] = useState("");

  const [moreOpen, setMoreOpen] = useState(false); // mobile bottom-bar "More" sheet

  async function reclassifyAll() {
    if (!confirm("Re-check all stored emails with the latest classification logic? This won't delete anything.")) return;

    setReclassifying(true);
    setReclassMsg("Re-checking…");

    let cursor: string | null = null;
    let total = 0;

    try {
      while (true) {
        const res: Response = await fetch("/api/reclassify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cursor }),
        });

        const d = await res.json();

        if (d.error) {
          setReclassMsg("Failed. Try again.");
          break;
        }

        total += d.updated || 0;
        setReclassMsg(`Re-checked… ${total} corrected so far`);

        if (d.done) {
          setReclassMsg(`Done — ${total} emails corrected. Refreshing…`);
          break;
        }

        cursor = d.nextCursor;
      }

      setTimeout(() => window.location.reload(), 1000);
    } catch {
      setReclassMsg("Failed. Try again.");
    } finally {
      setReclassifying(false);
    }
  }

  const emptyMessage =
    app.counts.All === 0
      ? "No applications yet — run a scan to pull them in."
      : "No applications match your filters.";

  return (
    <main className="min-h-screen overflow-x-clip bg-background px-3 py-6 pb-24 sm:px-4 sm:py-10 md:pb-10">
      <div className="mx-auto max-w-6xl">
        {app.needsReconnect && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-warning/30 bg-warning-muted p-4">
            <div className="min-w-0">
              <p className="font-semibold text-warning-foreground">Your Gmail connection expired</p>
              <p className="mt-0.5 text-sm text-warning-foreground/80">
                Reconnect to keep scanning. This just refreshes your Google sign-in — your data stays intact.
              </p>
            </div>

            <form action={onReconnect}>
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-warning px-4 py-2 text-sm font-medium text-warning-foreground shadow-sm transition-all hover:brightness-105 active:scale-[0.98]"
              >
                Reconnect Gmail
              </button>
            </form>
          </div>
        )}

        <header className="animate-fade-up mb-6 flex items-start justify-between gap-3 sm:mb-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Zap className="size-5" fill="currentColor" strokeWidth={0} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Apply Tracker
              </h1>
              <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                Signed in as <span className="text-foreground/80">{userEmail}</span>
              </p>
            </div>
          </div>

          {/* DESKTOP: buttons inline */}
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <Link href="/ask" className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground">
              Ask
            </Link>
            <Link href="/skills" className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground">
              Skills
            </Link>
            <Link href="/profile" className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground">
              Profile
            </Link>
            <Link href="/settings" className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground">
              Settings
            </Link>
          <Button onClick={reclassifyAll} disabled={reclassifying} loading={reclassifying} variant="secondary" size="sm">
              {!reclassifying && <RefreshCw className="size-3.5" />}
              {reclassifying ? reclassMsg : "Re-check classifications"}
            </Button>
            <form action={onSignOut}>
              <Button type="submit" variant="secondary" size="sm">
                <LogOut className="size-3.5" />
                Sign out
              </Button>
            </form>
            <ThemeToggle />
          </div>

          {/* MOBILE: theme toggle only — navigation lives in the fixed bottom bar */}
          <div className="flex shrink-0 items-center gap-2 md:hidden">
            <ThemeToggle />
          </div>
        </header>

        <ScanControls
          startDate={app.startDate}
          endDate={app.endDate}
          scanning={app.scanning}
          error={app.error}
          progress={app.progress}
          onStart={app.setStartDate}
          onEnd={app.setEndDate}
          onScan={app.runScan}
        />

        {!busy && (
          <StatsSummary
            rows={app.allRows}
            onFilterStatus={(s) => {
              app.setInterviewedOnly(false);
              app.setStatusFilter(s);
            }}
            onFilterInterviewed={() => {
              app.setStatusFilter("All");
              app.setInterviewedOnly(true);
            }}
          />
        )}

        <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <FilterPills
              active={app.statusFilter}
              counts={app.counts}
              scanning={busy}
              onChange={app.setStatusFilter}
            />

            {!busy && (
              <ExportControls
                allRows={app.allRows}
                visibleRows={app.filtered}
                statusFilter={app.statusFilter}
                search={app.search}
              />
            )}
          </div>

          {!busy && app.newCount > 0 && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-accent/15 bg-accent/[0.06] px-3 py-2.5">
              <span className="flex items-center gap-2 text-[13px] text-foreground/80">
                <Bell className="size-3.5 text-accent" />
                <span className="tnum font-medium text-foreground">{app.newCount}</span>
                {app.newCount === 1 ? "application has" : "applications have"} new activity
              </span>

              <button
                onClick={app.markAllSeen}
                className="shrink-0 text-[13px] font-medium text-accent transition-opacity hover:opacity-70"
              >
                Mark all as read
              </button>
            </div>
          )}

          <SearchSort
            search={app.search}
            sortBy={app.sortBy}
            scanning={busy}
            onSearch={app.setSearch}
            onSort={app.setSortBy}
          />

          {app.scanning && <ScanningQuote />}

          <ApplicationsTable
            items={app.pageItems}
            allRows={app.allRows}
            scanning={busy}
            emptyMessage={emptyMessage}
            isNewRow={app.isNewRow}
            onSeen={app.markSeen}
          />

          {!busy && (
            <Pagination
              page={app.page}
              totalPages={app.totalPages}
              onChange={app.setPage}
            />
          )}
        </div>
      </div>

      {/* MOBILE: fixed bottom navigation bar (hidden on desktop) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-lg md:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 py-1.5">
          <BottomTab href="/" label="Home" icon={<Home className="size-5" />} />
          <BottomTab href="/ask" label="Ask" icon={<MessageSquare className="size-5" />} />
          <BottomTab href="/skills" label="Skills" icon={<BarChart3 className="size-5" />} />
          <BottomTab href="/profile" label="Profile" icon={<User className="size-5" />} />
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Menu className="size-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* MOBILE: "More" sheet with blurred backdrop */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-popover p-2 pb-6 shadow-2xl">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" />
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm font-semibold text-foreground">More</span>
              <button onClick={() => setMoreOpen(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>
            <Link href="/settings" onClick={() => setMoreOpen(false)} className="block w-full rounded-lg px-3 py-3 text-left text-sm text-foreground transition-colors hover:bg-secondary">
              Settings
            </Link>
            <button
              onClick={() => { setMoreOpen(false); reclassifyAll(); }}
              disabled={reclassifying}
              className="w-full rounded-lg px-3 py-3 text-left text-sm text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
            >
              {reclassifying ? reclassMsg : "Re-check classifications"}
            </button>
            <form action={onSignOut}>
              <button type="submit" className="w-full rounded-lg px-3 py-3 text-left text-sm text-danger transition-colors hover:bg-secondary">
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

// A single tab in the mobile bottom bar.
function BottomTab({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-muted-foreground transition-colors hover:text-accent">
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}
