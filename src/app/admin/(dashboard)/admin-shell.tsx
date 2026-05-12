"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "./actions";
import { AdminLiveSearchInput } from "./live-search-input";
import { adminSidebarTiles, tileHref } from "@/lib/admin-nav";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig, getGlobalIcons } from "@/lib/icon-settings";
import { OneSignalInitializer } from "@/components/OneSignalInitializer";

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
  const [navWidth, setNavWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [isLg, setIsLg] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [pendingCount, setPendingCount] = useState(pendingInitialCount);
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  // عند فتح صفحة كنافذة منبثقة (?view=modal) نُخفي الشريط الجانبي وشريط البحث
  // لأنّ النافذة الأمّ تعرضهما أصلاً ولا داعي لتكرارهما داخل الـ iframe
  const isModalView = searchParams?.get("view") === "modal";

  const sidebarMinWidth = 240;
  const dragThreshold = 7; // px
  const mobileDefaultOpenWidth = Math.min(420, Math.max(320, viewportWidth || 420));
  const NAV_WIDTH_STORAGE_KEY = "kse:admin:navWidth";
  const maxSidebarWidth = Math.max(sidebarMinWidth, (viewportWidth || 1200) - 8);

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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NAV_WIDTH_STORAGE_KEY);
      const parsed = raw ? Number(raw) : NaN;
      if (Number.isFinite(parsed)) setNavWidth(parsed);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(NAV_WIDTH_STORAGE_KEY, String(navWidth));
    } catch {
      // ignore
    }
  }, [navWidth]);

  useEffect(() => {
    if (navWidth > maxSidebarWidth) setNavWidth(maxSidebarWidth);
  }, [maxSidebarWidth, navWidth]);

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
    // Background polling disabled to improve performance
    // const id = window.setInterval(() => void poll(), POLL_MS);
    // return () => {
    //   cancelled = true;
    //   window.clearInterval(id);
    // };
    return () => {
      cancelled = true;
    };
  }, []);

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();

    const startX = e.clientX;
    const startWidth = navWidth;
    let resizeStarted = false;

    const maxWidth = clamp(
      maxSidebarWidth,
      sidebarMinWidth,
      maxSidebarWidth,
    );

    const onMove = (ev: PointerEvent) => {
      if (!resizeStarted) {
        if (Math.abs(ev.clientX - startX) > dragThreshold) {
          resizeStarted = true;
          setIsResizing(true);
        } else return;
      }

      // Sidebar is positioned at `start-0`. In RTL, "start" is right.
      // Resizing should follow horizontal movement; use deltaX but clamp.
      const delta = ev.clientX - startX;
      // In RTL, the visual edge direction can feel inverted. Apply a heuristic:
      // If document dir is rtl, invert the delta so dragging "outwards" increases width.
      const isRtl =
        typeof document !== "undefined" && (document.documentElement.dir || "").toLowerCase() === "rtl";
      const next = clamp(startWidth + (isRtl ? -delta : delta), sidebarMinWidth, maxWidth);
      setNavWidth(next);
    };

    const onUp = () => {
      cleanup();
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

  const effectiveNavOpen = navOpen;

  if (isModalView) {
    return (
      <div className="kse-app-bg min-h-screen flex text-slate-900 dark:text-slate-100 flex-col">
        <main className="w-full flex-1 px-2 py-4 sm:p-6 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px]">
            <div className="relative z-10 w-full h-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className={`kse-app-bg min-h-screen flex text-slate-900 dark:text-slate-100 flex-col ${
        !isLg && navOpen ? "overflow-hidden" : ""
      } lg:overflow-visible`}
    >
      <OneSignalInitializer externalId="admin_global" />
      <button
        type="button"
        onClick={() => setNavOpen((o) => !o)}
        className="fixed start-4 top-4 z-[170] flex h-10 min-w-10 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#09090b] px-2 text-[#00f3ff] shadow-[0_0_10px_rgba(0,243,255,0.2)]"
        title={navOpen ? "إخفاء القائمة" : "إظهار القائمة"}
      >
        <span className="sr-only">{navOpen ? "إخفاء القائمة" : "إظهار القائمة"}</span>
        <span className="text-sm font-black">{navOpen ? "✕" : "☰"}</span>
        <span className="hidden md:inline text-xs font-bold">{navOpen ? "إخفاء" : "القائمة"}</span>
      </button>

      {navOpen ? (
        <button
          type="button"
          onClick={() => setNavOpen(false)}
          className="fixed start-4 top-16 z-[170] hidden h-8 items-center justify-center rounded-lg border border-slate-300 bg-white/90 px-2 text-xs font-bold text-slate-700 shadow-sm dark:border-white/20 dark:bg-[#0f1115]/90 dark:text-slate-200 lg:flex"
          title="إخفاء القائمة"
        >
          إخفاء
        </button>
      ) : null}

      {/* Mobile overlay backdrop (closes on click) */}
      {!isLg && navOpen ? (
        <div
          className="fixed inset-0 z-[115] bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={`
          fixed z-[160] flex flex-col border-e border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.1)]
          bg-white/95 dark:bg-[#09090b]/95 shadow-[4px_0_20px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_20px_rgba(0,0,0,0.8)]
          backdrop-blur-md ${isResizing ? "transition-none" : "transition-[width,transform] duration-200 ease-out"}
          inset-y-0 start-0 w-72
          ${effectiveNavOpen ? "translate-x-0 pointer-events-auto" : "translate-x-full pointer-events-none"}
          lg:inset-y-0 lg:start-0
        `}
        style={{ width: navWidth }}
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
          </div>
          <div className="flex w-8 h-8 rounded-full bg-gradient-to-br from-[#00f3ff] to-[#e028ff] items-center justify-center shadow-[0_0_10px_rgba(224,40,255,0.5)]">
            <span className="text-black font-black text-xs">OR</span>
          </div>
        </div>
        <nav className="flex flex-1 overflow-y-auto px-3 py-4">
          <div className="flex w-full flex-wrap items-start content-start gap-2">
            <div>
              <Link
                href="/admin"
                prefetch={false}
                title="الرئيسية"
                onClick={() => setNavOpen(false)}
                className={
                  navItemActive(pathname, "/admin")
                    ? `inline-flex items-center ${isCompact ? "gap-0 px-2 justify-center" : "gap-2 px-2.5"} h-9 rounded-xl bg-sky-100 dark:bg-[#002a3a] border border-sky-400 dark:border-[#00f3ff] text-sky-700 dark:text-[#00f3ff] shadow-sm dark:shadow-[0_0_15px_rgba(0,243,255,0.4)] transition-all`
                    : `inline-flex items-center ${isCompact ? "gap-0 px-2 justify-center" : "gap-2 px-2.5"} h-9 rounded-xl bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-all`
                }
              >
                <span className="text-xl shrink-0" aria-hidden>
                  <DynamicIcon iconKey="ui_home" config={icons} fallback="🏠" className="w-6 h-6" />
                </span>
                {isCompact ? null : <span className="leading-snug font-medium text-xs block whitespace-nowrap">الرئيسية</span>}
              </Link>
            </div>
            {isCompact ? null : (
              <p className="basis-full mt-2 px-1 text-[11px] font-bold tracking-wider text-sky-700 dark:text-[#00f3ff] block">
                الأقسام
              </p>
            )}
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
                      ? `inline-flex items-center ${
                          isCompact ? "gap-0 px-2 justify-center" : "gap-2 px-2.5"
                        } h-9 rounded-xl bg-purple-100 dark:bg-[#1e102a] border border-purple-400 dark:border-[#e028ff] text-purple-700 dark:text-[#e028ff] shadow-sm dark:shadow-[0_0_15px_rgba(224,40,255,0.4)] transition-all relative`
                      : `inline-flex items-center ${
                          isCompact ? "gap-0 px-2 justify-center" : "gap-2 px-2.5"
                        } h-9 rounded-xl bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-all relative`
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
                    <span className="leading-snug font-medium text-xs text-slate-700 dark:text-slate-200 block whitespace-nowrap">{tile.label}</span>
                  )}
                </Link>
              );
            })}
          </div>
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

        {/* Resize handle (drag) */}
        <div
          role="separator"
          aria-orientation="vertical"
          title="اسحب لتكبير/تصغير القائمة"
          onPointerDown={handleResizePointerDown}
          className="absolute inset-y-0 -end-1 w-3 cursor-ew-resize touch-none select-none"
        >
          <div className="absolute top-1/2 -translate-y-1/2 end-1 flex flex-col gap-1 rounded-full border border-slate-200/70 bg-white/70 px-2 py-2 text-slate-500 shadow-sm dark:border-white/10 dark:bg-[#0b0b10]/70 dark:text-slate-300">
            <span className="block h-[2px] w-4 rounded-full bg-current opacity-70" />
            <span className="block h-[2px] w-4 rounded-full bg-current opacity-70" />
            <span className="block h-[2px] w-4 rounded-full bg-current opacity-70" />
          </div>
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
