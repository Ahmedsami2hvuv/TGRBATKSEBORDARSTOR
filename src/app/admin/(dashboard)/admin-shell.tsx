"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "./actions";
import { AdminLiveSearchInput } from "./live-search-input";
import { adminSidebarTiles, tileHref } from "@/lib/admin-nav";
import { ThemeSwitcher } from "@/components/theme-switcher";

function navItemActive(pathname: string, href: string): boolean {
  const base = href.split("#")[0] ?? href;
  if (base === "/admin") return pathname === "/admin";
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function AdminShell({
  children,
  pendingInitialCount = 0,
}: {
  children: React.ReactNode;
  pendingInitialCount?: number;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(pendingInitialCount);
  const pathname = usePathname() ?? "";

  useEffect(() => {
    // We optionally closenavOpen on resize if needed, but since CSS handles lg breakpoint via lg:translate-x-0, we don't strictly need this unless we want to reset it.
    // Keeping it simple!
  }, []);

  useEffect(() => {
    let cancelled = false;
    const POLL_MS = 8000;
    async function poll() {
      try {
        const res = await fetch("/api/notifications/admin-pending", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { pendingCount?: number };
        if (cancelled) return;
        if (typeof data.pendingCount === "number" && Number.isFinite(data.pendingCount)) {
          setPendingCount(Math.max(0, data.pendingCount));
        }
      } catch {}
    }
    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const NavLinks = () => (
    <>
      <Link
        href="/admin"
        title="الرئيسية"
        onClick={() => setNavOpen(false)}
        className={
          navItemActive(pathname, "/admin")
            ? `flex items-center gap-3 px-3 w-full h-12 rounded-xl bg-sky-100 dark:bg-[#002a3a] border border-sky-400 dark:border-[#00f3ff] text-sky-700 dark:text-[#00f3ff] shadow-sm dark:shadow-[0_0_15px_rgba(0,243,255,0.4)] transition-all`
            : `flex items-center gap-3 px-3 w-full h-12 rounded-xl bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-all`
        }
      >
        <span className="text-xl shrink-0" aria-hidden>🏠</span>
        <span className="leading-snug font-medium text-sm block">الرئيسية</span>
      </Link>
      <p className="mt-5 px-3 text-[11px] font-bold tracking-wider text-sky-700 dark:text-[#00f3ff] block">الأقسام</p>
      
      <div className="mt-4 flex flex-col gap-3">
        {adminSidebarTiles().map((tile) => {
          const href = tileHref(tile);
          const active = navItemActive(pathname, href);
          const showPendingBadge = tile.slug === "new-orders" && pendingCount > 0;
          return (
            <Link
              key={tile.slug}
              href={href}
              title={tile.label}
              onClick={() => setNavOpen(false)}
              className={
                active
                  ? `flex items-center gap-3 px-3 w-full h-12 rounded-xl bg-purple-100 dark:bg-[#1e102a] border border-purple-400 dark:border-[#e028ff] text-purple-700 dark:text-[#e028ff] shadow-sm dark:shadow-[0_0_15px_rgba(224,40,255,0.4)] transition-all relative`
                  : `flex items-center gap-3 px-3 w-full h-12 rounded-xl bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-all relative`
              }
            >
              <span className="text-xl shrink-0 relative flex justify-center items-center">
                {tile.emoji}
                {showPendingBadge ? (
                  <span className="absolute -top-2 -right-2 inline-flex min-w-[1.2rem] items-center justify-center rounded-full bg-orange-600 px-1 py-0.5 text-[10px] font-black leading-none text-white shadow-[0_0_10px_orange]">
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                ) : null}
              </span>
              <span className="leading-snug font-medium text-sm text-slate-700 dark:text-slate-200 block">{tile.label}</span>
            </Link>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="kse-app-bg min-h-screen flex text-slate-900 dark:text-slate-100 flex-col lg:flex-row">
      <button
        type="button"
        onClick={() => setNavOpen((o) => !o)}
        className="fixed start-4 top-4 z-[110] flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-[#09090b] text-[#00f3ff] shadow-[0_0_10px_rgba(0,243,255,0.2)]"
      >
        <span className="sr-only">القائمة</span>
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Cyberpunk Compact Sidebar */}
      <aside
        className={`fixed inset-y-0 start-0 z-[120] flex flex-col border-e border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.1)] bg-white/95 dark:bg-[#09090b]/95 shadow-[4px_0_20px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_20px_rgba(0,0,0,0.8)] backdrop-blur-md transition-all duration-300 ease-out ${
          navOpen ? "w-64 translate-x-0" : "w-64 translate-x-full"
        }`}
      >
        <div className="flex h-16 w-full items-center justify-between px-4 border-b border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.1)]">
          <button onClick={() => setNavOpen(false)} className="text-slate-500 dark:text-slate-400 p-2 text-xl font-black">✕</button>
          <div className="flex w-8 h-8 rounded-full bg-gradient-to-br from-[#00f3ff] to-[#e028ff] items-center justify-center shadow-[0_0_10px_rgba(224,40,255,0.5)]">
            <span className="text-black font-black text-xs">OR</span>
          </div>
        </div>
        <nav className="flex flex-1 flex-col overflow-y-auto px-2 py-6 gap-2">
          <NavLinks />
        </nav>
        <div className="border-t border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.1)] p-2">
          <form action={logout}>
            <button
              type="submit"
              title="خروج"
              className="flex w-10 h-10 mx-auto items-center justify-center rounded-xl border border-[#ff3b30]/50 bg-transparent text-[#ff3b30] transition hover:bg-[#ff3b30]/20 shadow-[0_0_8px_rgba(255,59,48,0.2)]"
            >
              ⏻
            </button>
          </form>
        </div>
      </aside>

      <div className="kse-app-inner relative min-h-screen min-w-0 flex-1 flex flex-col">
        {/* Sleek Top Bar matching Mockup */}
         <header className="h-16 w-full bg-white/80 dark:bg-[#131418]/80 backdrop-blur-md border-b border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.05)] px-4 sm:px-8 flex items-center justify-between z-40 relative">
            <div className="absolute top-0 bottom-0 left-0 w-32 bg-gradient-to-r from-[rgba(0,243,255,0.1)] to-transparent pointer-events-none" />
            <div className="flex items-center gap-4 w-full h-full justify-between ms-12">
              <div className="flex items-center gap-3">
                <ThemeSwitcher />
                <AdminLiveSearchInput
                   id="admin-super-search-header"
                   ariaLabel="البحث"
                   placeholder="ابحث بأي شيء: كسر، رقم طلب، وارد..."
                   className="rounded-full border border-slate-300 dark:border-[rgba(255,255,255,0.1)] bg-slate-100 dark:bg-[#09090b] px-4 py-2 w-[240px] text-sm text-slate-900 dark:text-[#f8fafc] placeholder:text-slate-500 shadow-inner focus:border-sky-500 dark:focus:border-[#00f3ff] focus:ring-1 focus:ring-sky-500 dark:focus:ring-[#00f3ff] outline-none transition-all hidden md:block"
                 />
              </div>
            </div>
         </header>

        <main className="w-full flex-1 px-2 py-6 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px]">
            {/* The inner children wrapper is totally transparent so dashboard grid displays natively */}
            <div className="relative z-10 w-full h-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
