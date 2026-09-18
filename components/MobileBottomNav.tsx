"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Home, MessageSquare, BarChart3, User, Menu, X, Settings } from "lucide-react";
import { signOut } from "next-auth/react";

// Fixed bottom navigation for mobile, shared across every page via the root
// layout. Highlights the active tab. The Home tab only appears when you are NOT
// already on the home page (on home it would be redundant). "More" opens a sheet
// with the secondary items. Rendered only for signed-in users.
export function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isHome = pathname === "/";
  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-lg md:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 py-1.5">
          {/* First slot swaps: Home when you are away from home, Settings when you
              are already home — so the bar is always full and useful. */}
          {isHome ? (
            <Tab href="/settings" label="Settings" active={active("/settings")} icon={<Settings className="size-5" />} />
          ) : (
            <Tab href="/" label="Home" active={active("/")} icon={<Home className="size-5" />} />
          )}
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
            {!isHome && (
              <Link href="/settings" onClick={() => setMoreOpen(false)} className="block w-full rounded-lg px-3 py-3 text-left text-sm text-foreground transition-colors hover:bg-secondary">
                Settings
              </Link>
            )}
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
