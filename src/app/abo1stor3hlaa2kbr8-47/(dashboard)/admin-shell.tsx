"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { logout } from "./actions";
import { AdminLiveSearchInput } from "./live-search-input";
import { adminSidebarTiles, tileHref, type AdminTile } from "@/lib/admin-nav";
import { SidebarConfig, getMergedSidebarTiles, DEFAULT_SIDEBAR_CONFIG } from "@/lib/sidebar-settings";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig, getGlobalIcons } from "@/lib/icon-settings";
import { OneSignalInitializer } from "@/components/OneSignalInitializer";
import { FloatingAdminMenu } from "@/components/floating-admin-menu";
import { AdminGestureHandler } from "./admin-gesture-handler";
import { QuickTestOrderButton } from "@/components/quick-test-order-button";


const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

function navItemActive(pathname: string, href: string): boolean {
  const base = href.split("#")[0] ?? href;
  if (base === SECRET_ADMIN_PATH) return pathname === SECRET_ADMIN_PATH;
  return pathname === base || pathname.startsWith(`${base}/`);
}

function getTileClasses(slug: string, active: boolean, isCompact: boolean, buttonShape: "square" | "rectangle"): string {
  const isSquare = buttonShape === "square" && !isCompact;
  const base = `inline-flex ${
    isSquare ? "flex-col justify-center items-center gap-1.5 p-2 text-center" : "items-center gap-2 px-3"
  } ${
    isCompact ? "gap-0 px-2 justify-center" : ""
  } rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 relative w-full h-full`;

  if (active) {
    return `${base} bg-gradient-to-r from-[#0F4D3A] via-[#0A3D2E] to-[#0F4D3A] text-[#F5D77F] border-2 border-[#C9A86A] shadow-[0_4px_16px_rgba(10,61,46,0.3)] ring-1 ring-[#F5D77F]/30 font-black`;
  }

  return `${base} bg-white dark:bg-[#0c221b]/90 border-2 border-[#C9A86A]/40 text-[#0A3D2E] dark:text-[#F5D77F] hover:border-[#C9A86A] hover:bg-[#FFF8F0] dark:hover:bg-[#12362a] shadow-2xs font-bold`;
}

export function AdminShell({
  children,
  pendingInitialCount = 0,
  isAccountant = false,
  initialSidebarConfig,
}: {
  children: React.ReactNode;
  pendingInitialCount?: number;
  isAccountant?: boolean;
  initialSidebarConfig?: SidebarConfig | null;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [navOpenInitialized, setNavOpenInitialized] = useState(false);
  const [navWidth, setNavWidth] = useState(320);
  const [itemScale, setItemScale] = useState(1); // 1 = 100%
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isLg, setIsLg] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [pendingCount, setPendingCount] = useState(pendingInitialCount);
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  // عند فتح صفحة كنافذة منبثقة (?view=modal) نُخفي الشريط الجانبي وشريط البحث
  // لأنّ النافذة الأمّ تعرضهما أصلاً ولا داعي لتكرارهما داخل الـ iframe
  const isModalView = searchParams?.get("view") === "modal";

  const sidebarConfig = initialSidebarConfig || DEFAULT_SIDEBAR_CONFIG;
  const [orderedTiles, setOrderedTiles] = useState<AdminTile[]>(() => getMergedSidebarTiles(sidebarConfig));
  const filteredTiles = orderedTiles;

  const handleTileClick = (slug: string) => {
    handleLinkClick();
  };

  const [pullProgress, setPullProgress] = useState(0);
  const [showIndicator, setShowIndicator] = useState(false);
  const pullTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedDeltaRef = useRef(0);

  const sidebarMinWidth = 240;
  const dragThreshold = 7; // px
  const mobileDefaultOpenWidth = Math.min(420, Math.max(320, viewportWidth || 420));
  const NAV_WIDTH_STORAGE_KEY = "kse:admin:navWidth";
  const NAV_SCALE_STORAGE_KEY = "kse:admin:navScale";
  const NAV_OPEN_STORAGE_KEY = "kse:admin:navOpen";
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
    try {
      const rawOpen = window.localStorage.getItem(NAV_OPEN_STORAGE_KEY);
      if (rawOpen !== null) {
        setNavOpen(rawOpen === "true");
      } else {
        setNavOpen(window.matchMedia("(min-width: 1024px)").matches);
      }
    } catch {
      setNavOpen(window.matchMedia("(min-width: 1024px)").matches);
    }
    setNavOpenInitialized(true);
  }, []);

  useEffect(() => {
    if (!navOpenInitialized) return;
    try {
      window.localStorage.setItem(NAV_OPEN_STORAGE_KEY, String(navOpen));
    } catch {}
  }, [navOpen, navOpenInitialized]);

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

  const handleLinkClick = () => {
    setTimeout(() => setNavOpen(false), 80);
  };

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  // Close sidebar automatically when routing (pathname/searchParams change)
  useEffect(() => {
    setNavOpen(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!navOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (sidebarRef.current && !sidebarRef.current.contains(target) && !(target instanceof HTMLElement && target.closest('#navToggleButton')) ) {
        setNavOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [navOpen]);

  // Lock body scroll on mobile when sidebar is open to prevent pull-to-refresh
  useEffect(() => {
    if (!isLg && navOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehaviorY = 'none';
      document.documentElement.style.overscrollBehaviorY = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.overscrollBehaviorY = '';
      document.documentElement.style.overscrollBehaviorY = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.overscrollBehaviorY = '';
      document.documentElement.style.overscrollBehaviorY = '';
    };
  }, [navOpen, isLg]);

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
        {showIndicator && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/95 dark:bg-[#131418]/95 backdrop-blur-md shadow-lg border border-slate-200/50 dark:border-slate-800/50 transition-all duration-300 transform translate-y-0 scale-100">
            <div className="flex items-center gap-2.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className="w-5 h-5 text-sky-500 dark:text-[#00f3ff] transition-transform duration-100"
                style={{ transform: `rotate(${pullProgress * 3.6}deg)` }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {pullProgress >= 100 ? "جاري تحديث الصفحة..." : "اسحب للأعلى للتحديث..."}
              </span>
            </div>
            <div className="w-40 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#00f3ff] to-[#e028ff] transition-all duration-100"
                style={{ width: `${pullProgress}%` }}
              />
            </div>
          </div>
        )}
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

  if (isAccountant) {
    return (
      <div className="kse-app-bg min-h-screen flex text-slate-900 dark:text-slate-100 flex-col">
        <header className="h-16 w-full bg-white/80 dark:bg-[#131418]/80 backdrop-blur-md border-b border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.05)] px-4 sm:px-8 flex items-center justify-between z-40 relative" dir="rtl">
          <div className="flex items-center gap-2">
            <div className="flex w-8 h-8 rounded-full bg-gradient-to-br from-[#00f3ff] to-[#e028ff] items-center justify-center shadow-[0_0_10px_rgba(224,40,255,0.5)]">
              <span className="text-black font-black text-xs">AC</span>
            </div>
            <span className="text-sm font-black tracking-wider text-slate-800 dark:text-slate-200">
              بوابة المحاسب
            </span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeSwitcher />
            <form action={logout} className="m-0">
              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl border border-[#ff3b30]/30 bg-[#ff3b30]/5 px-3 py-1.5 text-[#ff3b30] transition hover:bg-[#ff3b30]/10 font-bold text-xs"
              >
                <span>تسجيل الخروج</span>
              </button>
            </form>
          </div>
        </header>

        <main className="w-full flex-1 px-2 py-6 sm:p-6 lg:p-8 overflow-y-auto">
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
      dir="rtl"
      lang="ar"
      className={`kse-app-bg relative flex min-h-screen text-slate-800 dark:text-slate-100 ${
        !isLg && navOpen ? "overflow-hidden" : ""
      } lg:overflow-visible`}
    >
      <AdminGestureHandler />
      {showIndicator && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/95 dark:bg-[#131418]/95 backdrop-blur-md shadow-lg border border-slate-200/50 dark:border-slate-800/50 transition-all duration-300 transform translate-y-0 scale-100">
          <div className="flex items-center gap-2.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-5 h-5 text-sky-500 dark:text-[#00f3ff] transition-transform duration-100"
              style={{ transform: `rotate(${pullProgress * 3.6}deg)` }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {pullProgress >= 100 ? "جاري تحديث الصفحة..." : "اسحب للأعلى للتحديث..."}
            </span>
          </div>
          <div className="w-40 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00f3ff] to-[#e028ff] transition-all duration-100"
              style={{ width: `${pullProgress}%` }}
            />
          </div>
        </div>
      )}
      <OneSignalInitializer externalId="admin_global" />
      <FloatingAdminMenu />
      
      <button
        id="navToggleButton"
        type="button"
        onClick={() => setNavOpen((o) => !o)}
        className="fixed start-4 top-3.5 z-[170] flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-2xl border-2 border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] via-[#0A3D2E] to-[#0F4D3A] px-3 text-[#F5D77F] shadow-md shadow-[#0A3D2E]/30 hover:brightness-110 active:scale-95 transition"
        title={navOpen ? "إخفاء القائمة" : "إظهار القائمة"}
      >
        <span className="sr-only">{navOpen ? "إخفاء القائمة" : "إظهار القائمة"}</span>
        <span className="text-sm font-black">{navOpen ? "✕" : "☰"}</span>
        <span className="hidden md:inline text-xs font-black">{navOpen ? "إخفاء" : "القائمة"}</span>
      </button>

      {/* Mobile overlay backdrop (closes on click) */}
      {!isLg && navOpen ? (
        <div
          className="fixed inset-0 z-[115] bg-black/60 backdrop-blur-sm lg:hidden touch-none"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`
          fixed z-[160] flex flex-col border-e-2 border-[#C9A86A]/60
          shadow-[4px_0_35px_rgba(10,61,46,0.25)] dark:shadow-[4px_0_35px_rgba(0,0,0,0.85)]
          ${isResizing ? "transition-none" : "transition-transform duration-200 ease-out"}
          top-0 h-[100dvh] max-h-[100dvh] overflow-hidden overscroll-none start-0 w-72
          ${effectiveNavOpen ? "translate-x-0 pointer-events-auto" : "-translate-x-full rtl:translate-x-full pointer-events-none"}
          lg:inset-y-0 lg:start-0
          bg-gradient-to-b from-[#FFFFFF] via-[#FFFDF9] to-[#FFF8F0] dark:from-[#081b14] dark:via-[#06140f] dark:to-[#040e0a]
        `}
        style={{ 
          width: navWidth
        }}
      >
        {/* رأس القائمة الملكي */}
        <div className="flex h-16 w-full items-center justify-between px-4 border-b-2 border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] via-[#0A3D2E] to-[#0F4D3A] text-white shrink-0 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 rounded-2xl bg-gradient-to-b from-[#F5D77F] to-[#C9A86A] p-0.5 shadow-md shadow-[#0A3D2E]/30 items-center justify-center border border-[#F5D77F]">
              <div className="size-full rounded-[14px] bg-[#0A3D2E] flex items-center justify-center text-[#F5D77F] font-black text-xs">
                AK
              </div>
            </div>
            <div>
              <span className="text-xs sm:text-sm font-black text-[#F5D77F] block leading-tight">
                أبو الأكبر للتوصيل
              </span>
              <span className="text-[10px] font-bold text-emerald-200/80 block">
                لوحة التحكم الإدارية ⚜️
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setNavOpen(false)}
            className="flex size-8 items-center justify-center rounded-full bg-[#0A3D2E] text-[#F5D77F] border border-[#C9A86A] hover:bg-[#C9A86A] hover:text-[#0A3D2E] transition active:scale-90 text-sm font-black shadow-xs lg:hidden"
            title="إغلاق القائمة"
          >
            ✕
          </button>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          .admin-sidebar-scroll::-webkit-scrollbar {
            width: 5px;
          }
          .admin-sidebar-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .admin-sidebar-scroll::-webkit-scrollbar-thumb {
            background-color: rgba(201, 168, 106, 0.4);
            border-radius: 20px;
          }
          .admin-sidebar-scroll::-webkit-scrollbar-thumb:hover {
            background-color: rgba(201, 168, 106, 0.7);
          }
        `}} />
        <nav className="admin-sidebar-scroll flex flex-1 overflow-y-auto overscroll-none touch-pan-y px-3 py-3.5">
          <div className={`grid w-full gap-2 content-start ${
            isCompact 
              ? "grid-cols-1" 
              : sidebarConfig.layoutColumns === 1 
                ? "grid-cols-1" 
                : sidebarConfig.layoutColumns === 2 
                  ? "grid-cols-2" 
                  : "grid-cols-3"
          }`}>
            {/* صف الأزرار العلوية: الرئيسية + طلب تيست */}
            <div className="col-span-full grid grid-cols-2 gap-2">
              <Link
                href={SECRET_ADMIN_PATH}
                prefetch={false}
                title="الرئيسية"
                onClick={handleLinkClick}
                className={`inline-flex items-center gap-2 px-3 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 relative w-full ${
                  navItemActive(pathname, SECRET_ADMIN_PATH)
                    ? "bg-gradient-to-r from-[#0F4D3A] via-[#0A3D2E] to-[#0F4D3A] text-[#F5D77F] border-2 border-[#C9A86A] shadow-md shadow-[#0A3D2E]/20 ring-1 ring-[#F5D77F]/30 font-black"
                    : "bg-white dark:bg-[#0c221b]/90 border-2 border-[#C9A86A]/40 text-[#0A3D2E] dark:text-[#F5D77F] hover:border-[#C9A86A] hover:bg-[#FFF8F0] shadow-2xs font-bold"
                }`}
                style={{
                  height: 38 * itemScale,
                  fontSize: 12 * itemScale
                }}
              >
                <span className="shrink-0 text-base" style={{ transform: `scale(${itemScale})`, transformOrigin: 'center' }} aria-hidden>
                  <DynamicIcon iconKey="ui_home" config={icons} fallback="🏠" className="w-5 h-5" />
                </span>
                {isCompact ? null : <span className="leading-snug font-black block whitespace-nowrap">الرئيسية</span>}
              </Link>

              <QuickTestOrderButton
                variant="sidebar"
                itemScale={itemScale}
                isCompact={isCompact}
                className="w-full"
              />
            </div>

            {isCompact ? null : (
              <div className="col-span-full mt-2 mb-1 flex items-center gap-2 px-1">
                <span className="text-xs text-[#C9A86A]">⚜️</span>
                <span className="text-[11px] font-black tracking-wider text-[#0A3D2E] dark:text-[#F5D77F]">
                  الأقسام والخدمات
                </span>
                <div className="flex-1 h-px bg-[#C9A86A]/30" />
              </div>
            )}

            {filteredTiles.map((tile) => {
              const href = tileHref(tile);
              const active = navItemActive(pathname, href);
              const showPendingBadge = tile.slug === "new-orders" && pendingCount > 0;
              return (
                <Link
                  key={tile.slug}
                  href={href}
                  prefetch={false}
                  title={tile.label}
                  onClick={() => handleTileClick(tile.slug)}
                  className={getTileClasses(tile.slug, active, isCompact, sidebarConfig.buttonShape)}
                  style={{
                    height: isCompact 
                      ? 38 * itemScale 
                      : sidebarConfig.buttonShape === "square" 
                        ? undefined 
                        : 38 * itemScale,
                    aspectRatio: !isCompact && sidebarConfig.buttonShape === "square" ? "1/1" : undefined,
                    fontSize: (!isCompact && sidebarConfig.buttonShape === "square" ? 10 : 12) * itemScale
                  }}
                >
                  <span className="shrink-0 relative flex justify-center items-center" style={{ transform: `scale(${itemScale})`, transformOrigin: 'center' }}>
                    <DynamicIcon iconKey={tile.iconKey} config={icons} fallback={tile.slug === "credit-book" ? "📘" : "📁"} className="w-5 h-5" />
                    {showPendingBadge ? (
                      <span className="absolute -top-1.5 -right-1.5 inline-flex min-w-[1.2rem] items-center justify-center rounded-full bg-[#F5D77F] border border-[#C9A86A] px-1 py-0.2 text-[10px] font-black leading-none text-[#0A3D2E] shadow-sm">
                        {pendingCount > 99 ? "99+" : pendingCount}
                      </span>
                    ) : null}
                  </span>
                  {isCompact ? null : (
                    <span className="leading-snug font-black block whitespace-nowrap">{tile.label}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* تذييل القائمة الجانبية الملكي */}
        <div className="border-t-2 border-[#C9A86A]/30 p-2.5 flex items-center justify-between shrink-0 bg-[#FFF8F0] dark:bg-[#06140f] gap-2">
          {/* أزرار التكبير والتصغير الملكية */}
          <div className="flex items-center flex-1 min-w-0 bg-white dark:bg-[#0a2018] p-1 rounded-2xl border border-[#C9A86A]/50 shadow-2xs h-10">
            <div className="flex-1" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setItemScale(prev => Math.max(0.7, prev - 0.05)); }}
              className="size-8 flex items-center justify-center rounded-xl hover:bg-rose-50 text-[#0A3D2E] dark:text-[#F5D77F] hover:text-rose-600 transition-colors shrink-0 font-black text-lg active:scale-90"
              title="تصغير"
            >
              −
            </button>
            <span className="text-xs font-black text-[#0A3D2E] dark:text-[#F5D77F] min-w-[42px] text-center shrink-0">
              {Math.round(itemScale * 100)}%
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setItemScale(prev => Math.min(3, prev + 0.05)); }}
              className="size-8 flex items-center justify-center rounded-xl hover:bg-emerald-50 text-[#0A3D2E] dark:text-[#F5D77F] hover:text-emerald-600 transition-colors shrink-0 font-black text-lg active:scale-90"
              title="تكبير"
            >
              +
            </button>
            <div className="flex-1" />
          </div>

          <form action={logout} className="shrink-0 m-0">
            <button
              type="submit"
              title="تسجيل الخروج"
              className="flex size-10 items-center justify-center rounded-2xl border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-400 transition-all active:scale-95 shadow-2xs"
            >
              <span className="text-lg">🚪</span>
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

      <div 
        className="kse-app-inner relative min-h-screen min-w-0 flex-1 flex flex-col transition-all duration-200 ease-out"
        style={{ marginInlineStart: (isLg && effectiveNavOpen) ? navWidth : 0 }}
      >
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

        <main className="w-full flex-1 px-1 py-3 sm:p-6 lg:p-8 overflow-y-auto">
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
