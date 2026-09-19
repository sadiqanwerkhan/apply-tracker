"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { Home, MessageSquare, BarChart3, User, Menu, X } from "lucide-react";

// Fixed bottom navigation for mobile, shared across every page via the root
// layout. Five tabs in a fixed order: Home, Ask, Skills, Profile, More. Home is
// always Home — tapping it while already on home refreshes the page. "More"
// opens a sheet with Settings, Re-check classifications, and Sign out. Rendered
// only for signed-in users.
export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [reclassifying, setReclassifying] = useState(false);
  const [reclassMsg, setReclassMsg] = useState("Re-check classifications");

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  // Tapping Home: navigate home, or refresh if already there.
  function goHome() {
    if (pathname === "/") router.refresh();
    else router.push("/");
  }

  // Self-contained reclassify so it works from any page (loops the API).
  async function reclassifyAll() {
    if (reclassifying) return;
    if (!confirm("Re-check all stored emails with the latest classification logic? This won't delete anything.")) return;
    setMoreOpen(false);
    setReclassifying(true);
    setReclassMsg("Re-checking…");
    let cursor: string | null = null;
    try {
      while (true) {
        const res: Response = await fetch("/api/reclassify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cursor }),
        });
        const d = await res.json();
        if (d.error) { setReclassMsg("Failed. Try again."); break; }
        cursor = d.nextCursor;
        if (d.done || !cursor) { setReclassMsg("Done ✓"); router.refresh(); break; }
      }
    } catch {
      setReclassMsg("Failed. Try again.");
    } finally {
      setReclassifying(false);
      setTimeout(() => setReclassMsg("Re-check classifications"), 3000);
    }
  }

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-lg md:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 py-1.5">
          <button
            onClick={goHome}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 transition-colors ${active("/") ? "text-accent" : "text-muted-foreground hover:text-accent"}`}
          >
            <Home className="size-5" />
            <span className="text-[10px] font-medium">Home</span>
          </button>
          <Tab href="/ask" label="Ask" active={active("/ask")} icon={<MessageSquare className="size-5" />} />
          <Tab href="/skills" label="Skills" active={active("/skills")} icon={<BarChart3 className="size-5" />} />
          <Tab href="/profile" label="Profile" active={active("/profile")} icon={<User className="size-5" />} />
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Menu className="size-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button aria-label="Close menu" onClick={() => setMoreOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
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
              onClick={reclassifyAll}
              disabled={reclassifying}
              className="w-full rounded-lg px-3 py-3 text-left text-sm text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
            >
              {reclassifying ? reclassMsg : "Re-check classifications"}
            </button>
            <button
              onClick={() => { setMoreOpen(false); signOut({ callbackUrl: "/" }); }}
              className="w-full rounded-lg px-3 py-3 text-left text-sm text-danger transition-colors hover:bg-secondary"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Tab({ href, label, icon, active }: { href: string; label: string; icon: React.ReactNode; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 transition-colors ${active ? "text-accent" : "text-muted-foreground hover:text-accent"}`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}
