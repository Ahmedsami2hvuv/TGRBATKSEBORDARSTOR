"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "./actions";
import { AdminLiveSearchInput } from "./live-search-input";
import { adminSidebarTiles, tileHref } from "@/lib/admin-nav";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig, getGlobalIcons } from "@/lib/icon-settings";

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
  const [navExpanded, setNavExpanded] = useState(true);
  const [navWidth, setNavWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [isLg, setIsLg] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [pendingCount, setPendingCount] = useState(pendingInitialCount);
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);
  const pathname = usePathname() ?? "";

  const sidebarMinWidth = 240;
  const dragThreshold = 7; // px
  const mobileDefaultOpenWidth = Math.min(420, Math.max(320, viewportWidth || 420));

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLg(mql.matches);
    update();
    // Safari fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyMql = mql as any;
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", update);
      return () => mql.removeEventListener("change", update);
    }
    if (typeof anyMql.addListener === "function") {
      anyMql.addListener(update);
      return () => anyMql.removeListener(update);
    }
    return;
  }, []);

  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const isCompact = navWidth <= 260;

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

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

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  const handleMobileResizePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (isLg) return; // drag only on mobile layout
    if (e.pointerType === "mouse" && e.button !== 0) return;

    e.preventDefault();

    const wasNavOpen = navOpen;
    const startX = e.clientX;
    let resizeStarted = false;

    const maxWidth = viewportWidth || 420;

    // If it's closed, open it first; if user only taps, we'll treat it as toggle on pointerup.
    if (!navOpen) {
      setNavOpen(true);
      setNavWidth((prev) => clamp(prev || mobileDefaultOpenWidth, sidebarMinWidth, maxWidth));
    }

    setIsResizing(false);

    const onMove = (ev: PointerEvent) => {
      if (!resizeStarted) {
        if (Math.abs(ev.clientX - startX) > dragThreshold) {
          resizeStarted = true;
          setIsResizing(true);
        } else {
          return;
        }
      }

      const next = clamp(ev.clientX, sidebarMinWidth, maxWidth);
      setNavWidth(next);
    };

    const onUp = () => {
      cleanup();
      if (!resizeStarted) {
        // Tap-to-toggle behavior (no drag)
        if (!wasNavOpen) {
          setNavOpen(true);
          setNavWidth(clamp(mobileDefaultOpenWidth, sidebarMinWidth, maxWidth));
        } else {
          // Keep sidebar open; only toggle width.
          setNavWidth((w) =>
            w <= sidebarMinWidth + 10
              ? clamp(mobileDefaultOpenWidth, sidebarMinWidth, maxWidth)
              : sidebarMinWidth,
          );
        }
        return;
      }
      setIsResizing(false);
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.userSelect = "";
    };

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const handleMobileToggleByKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (isLg) return;

    const maxWidth = viewportWidth || 420;
    if (!navOpen) {
      setNavOpen(true);
      setNavWidth(clamp(mobileDefaultOpenWidth, sidebarMinWidth, maxWidth));
      return;
    }
    if (navWidth <= sidebarMinWidth + 10) {
      setNavOpen(false);
    } else {
      setNavWidth(sidebarMinWidth);
    }
  };

  const NavLinks = () => (
    <>
      <Link
        href="/admin"
        prefetch={false}
        title="الرئيسية"
        onClick={() => setNavOpen(false)}
        className={
          navItemActive(pathname, "/admin")
            ? `flex items-center ${isCompact ? "gap-0 px-2 justify-center" : "gap-3 px-3"} w-full h-11 rounded-xl bg-sky-100 dark:bg-[#002a3a] border border-sky-400 dark:border-[#00f3ff] text-sky-700 dark:text-[#00f3ff] shadow-sm dark:shadow-[0_0_15px_rgba(0,243,255,0.4)] transition-all`
            : `flex items-center ${isCompact ? "gap-0 px-2 justify-center" : "gap-3 px-3"} w-full h-11 rounded-xl bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-all`
        }
      >
        <span className="text-xl shrink-0" aria-hidden>
          <DynamicIcon iconKey="ui_home" config={icons} fallback="🏠" className="w-6 h-6" />
        </span>
        {isCompact ? null : <span className="leading-snug font-medium text-sm block">الرئيسية</span>}
      </Link>
      {isCompact ? null : (
        <p className="mt-4 px-3 text-[11px] font-bold tracking-wider text-sky-700 dark:text-[#00f3ff] block">الأقسام</p>
      )}
      
      <div className="mt-4 flex flex-col gap-2">
        {adminSidebarTiles().map((tile) => {
          const href = tileHref(tile);
          const active = navItemActive(pathname, href);
          const showPendingBadge = tile.slug === "new-orders" && pendingCount > 0;
          return (
            <Link
              key={tile.slug}
              href={href}
              prefetch={false}
              title={tile.label}
              onClick={() => setNavOpen(false)}
              className={
                active
                  ? `flex items-center ${
                      isCompact ? "gap-0 px-2 justify-center" : "gap-3 px-3"
                    } w-full h-11 rounded-xl bg-purple-100 dark:bg-[#1e102a] border border-purple-400 dark:border-[#e028ff] text-purple-700 dark:text-[#e028ff] shadow-sm dark:shadow-[0_0_15px_rgba(224,40,255,0.4)] transition-all relative`
                  : `flex items-center ${
                      isCompact ? "gap-0 px-2 justify-center" : "gap-3 px-3"
                    } w-full h-11 rounded-xl bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-all relative`
              }
            >
              <span className="text-xl shrink-0 relative flex justify-center items-center">
                <DynamicIcon iconKey={tile.iconKey} config={icons} className="w-6 h-6" />
                {showPendingBadge ? (
                  <span className="absolute -top-2 -right-2 inline-flex min-w-[1.2rem] items-center justify-center rounded-full bg-orange-600 px-1 py-0.5 text-[10px] font-black leading-none text-white shadow-[0_0_10px_orange]">
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                ) : null}
              </span>
              {isCompact ? null : (
                <span className="leading-snug font-medium text-sm text-slate-700 dark:text-slate-200 block">{tile.label}</span>
              )}
            </Link>
          );
        })}
      </div>
    </>
  );

  return (
    <div
      className={`kse-app-bg min-h-screen flex text-slate-900 dark:text-slate-100 flex-col lg:flex-row ${
        navOpen ? "overflow-hidden" : ""
      } lg:overflow-visible`}
    >
      <button
        type="button"
        onPointerDown={handleMobileResizePointerDown}
        onKeyDown={handleMobileToggleByKey}
        className={`fixed top-4 z-[110] flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-[#09090b] text-[#00f3ff] shadow-[0_0_10px_rgba(0,243,255,0.2)] lg:hidden touch-none select-none ${
          navOpen ? "z-[130]" : ""
        }`}
        style={
          !isLg && navOpen
            ? { left: Math.max(12, navWidth - 20) }
            : { left: 16 }
        }
      >
        <span className="sr-only">القائمة</span>
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile overlay backdrop (closes on click) */}
      {navOpen ? (
        <div
          className="fixed inset-0 z-[115] bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={`
          fixed z-[120] flex flex-col border-e border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.1)]
          bg-white/95 dark:bg-[#09090b]/95 shadow-[4px_0_20px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_20px_rgba(0,0,0,0.8)]
          backdrop-blur-md ${isResizing ? "transition-none" : "transition-[width,transform] duration-200 ease-out"}
          inset-y-0 start-0 w-72
          ${navOpen ? "translate-x-0 pointer-events-auto" : "translate-x-full pointer-events-none"}
          lg:static lg:inset-auto lg:translate-x-0 lg:transform-none lg:pointer-events-auto ${navExpanded ? "lg:w-80" : "lg:w-64"}
        `}
        style={!isLg ? { width: navWidth } : undefined}
      >
        <div className="flex h-16 w-full items-center justify-between px-4 border-b border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.1)]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNavOpen(false)}
              className="text-slate-500 dark:text-slate-400 p-2 text-xl font-black lg:hidden"
              aria-label="إغلاق القائمة"
              title="إغلاق القائمة"
            >
              ✕
            </button>
            <button
              onClick={() => setNavExpanded((v) => !v)}
              className="hidden lg:inline-flex text-slate-500 dark:text-slate-400 p-2 text-xl font-black"
              aria-label={navExpanded ? "تصغير القائمة" : "تكبير القائمة"}
              title={navExpanded ? "تصغير القائمة" : "تكبير القائمة"}
            >
              {navExpanded ? "⟨⟨" : "⟩⟩"}
            </button>
          </div>
          <div className="flex w-8 h-8 rounded-full bg-gradient-to-br from-[#00f3ff] to-[#e028ff] items-center justify-center shadow-[0_0_10px_rgba(224,40,255,0.5)]">
            <span className="text-black font-black text-xs">OR</span>
          </div>
        </div>
        <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-4 gap-1">
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
