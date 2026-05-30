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
import { FloatingAdminMenu } from "@/components/floating-admin-menu";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

function navItemActive(pathname: string, href: string): boolean {
  const base = href.split("#")[0] ?? href;
  if (base === SECRET_ADMIN_PATH) return pathname === SECRET_ADMIN_PATH;
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
  const [itemScale, setItemScale] = useState(1); // 1 = 100%
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
  const NAV_SCALE_STORAGE_KEY = "kse:admin:navScale";
  const maxSidebarWidth = Math.max(sidebarMinWidth, (viewportWidth || 1200) - 8);

  useEffect(() => {
    try {
      const rawScale = window.localStorage.getItem(NAV_SCALE_STORAGE_KEY);
      const parsedScale = rawScale ? Number(rawScale) : NaN;
      if (Number.isFinite(parsedScale)) setItemScale(parsedScale);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(NAV_SCALE_STORAGE_KEY, String(itemScale));
    } catch {}
  }, [itemScale]);

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
      <FloatingAdminMenu />
      <button
        type="button"
        onClick={() => setNavOpen((o) => !o)}
        className="fixed start-4 top-4 z-[170] flex h-10 min-w-10 items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 text-indigo-600 dark:text-indigo-400 shadow-lg shadow-indigo-500/10"
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
          className="fixed start-4 top-16 z-[170] hidden h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 lg:flex"
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
          fixed z-[160] flex flex-col border-e border-slate-200 dark:border-slate-800
          bg-slate-50/95 dark:bg-slate-950/95 shadow-xl dark:shadow-2xl
          backdrop-blur-md ${isResizing ? "transition-none" : "transition-[width,transform] duration-200 ease-out"}
          inset-y-0 start-0 w-72
          ${effectiveNavOpen ? "translate-x-0 pointer-events-auto" : "translate-x-full pointer-events-none"}
          lg:inset-y-0 lg:start-0
        `}
        style={{ width: navWidth }}
      >
        <div className="flex h-16 w-full items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2 ms-12">
            <div className="flex w-8 h-8 rounded-full bg-indigo-600 items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="text-white font-black text-xs">OR</span>
            </div>
            <span className="text-[10px] font-black tracking-widest text-slate-500 dark:text-slate-400 uppercase">
              Admin Portal
            </span>
          </div>
        </div>
        <nav className="flex flex-1 overflow-y-auto px-3 py-4">
          <div className="flex w-full flex-wrap items-start content-start gap-2">
            <div>
              <Link
                href={SECRET_ADMIN_PATH}
                prefetch={false}
                title="الرئيسية"
                onClick={() => setNavOpen(false)}
                className={
                  navItemActive(pathname, SECRET_ADMIN_PATH)
                    ? `inline-flex items-center ${isCompact ? "gap-0 px-2 justify-center" : "gap-2 px-2.5"} rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shadow-sm transition-all`
                    : `inline-flex items-center ${isCompact ? "gap-0 px-2 justify-center" : "gap-2 px-2.5"} rounded-2xl bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-all`
                }
                style={{ height: 36 * itemScale, fontSize: 12 * itemScale }}
              >
                <span className="shrink-0" style={{ transform: `scale(${itemScale})`, transformOrigin: 'center' }} aria-hidden>
                  <DynamicIcon iconKey="ui_home" config={icons} fallback="🏠" className="w-5 h-5" />
                </span>
                {isCompact ? null : <span className="leading-snug font-semibold block whitespace-nowrap">الرئيسية</span>}
              </Link>
            </div>
            {isCompact ? null : (
              <p className="basis-full mt-2 px-1 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase block">
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
                        } rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shadow-sm transition-all relative`
                      : `inline-flex items-center ${
                          isCompact ? "gap-0 px-2 justify-center" : "gap-2 px-2.5"
                        } rounded-2xl bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-all relative`
                  }
                  style={{ height: 36 * itemScale, fontSize: 12 * itemScale }}
                >
                  <span className="shrink-0 relative flex justify-center items-center" style={{ transform: `scale(${itemScale})`, transformOrigin: 'center' }}>
                    <DynamicIcon iconKey={tile.iconKey} config={icons} className="w-5 h-5" />
                    {showPendingBadge ? (
                      <span className="absolute -top-2 -right-2 inline-flex min-w-[1.2rem] items-center justify-center rounded-full bg-indigo-600 px-1 py-0.5 text-[10px] font-black leading-none text-white shadow-lg shadow-indigo-500/30">
                        {pendingCount > 99 ? "99+" : pendingCount}
                      </span>
                    ) : null}
                  </span>
                  {isCompact ? null : (
                    <span className="leading-snug font-medium block whitespace-nowrap">{tile.label}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
        <div className="border-t border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-4 shrink-0 bg-slate-100/50 dark:bg-slate-900/50">
          {/* أزرار التكبير والتصغير */}
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex flex-col ms-2">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">حجم القائمة</span>
              <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400">{Math.round(itemScale * 100)}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => { e.stopPropagation(); setItemScale(prev => Math.max(0.7, prev - 0.05)); }}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700"
                title="تصغير"
              >
                <span className="text-xl font-medium">−</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setItemScale(prev => Math.min(5, prev + 0.05)); }}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-90 border border-slate-200 dark:border-slate-700"
                title="تكبير"
              >
                <span className="text-xl font-medium">+</span>
              </button>
            </div>
          </div>

          <form action={logout} className="w-full">
            <button
              type="submit"
              title="تسجيل الخروج"
              className="flex w-full h-12 items-center justify-center gap-3 rounded-2xl border border-rose-200 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 transition hover:bg-rose-100 dark:hover:bg-rose-900/30 font-bold text-xs uppercase tracking-wider shadow-sm"
            >
              <span className="text-lg">⏻</span>
              <span>تسجيل الخروج</span>
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
        {/* Sleek Top Bar */}
         <header className="h-16 w-full bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 flex items-center justify-between z-40 relative">
            <div className="flex items-center gap-4 w-full h-full justify-between ms-12">
              <div className="flex items-center gap-3">
                <ThemeSwitcher />
                <AdminLiveSearchInput
                   id="admin-super-search-header"
                   ariaLabel="البحث"
                   placeholder="ابحث بأي شيء..."
                   className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-2 w-[240px] text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 shadow-sm focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none transition-all hidden md:block"
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
