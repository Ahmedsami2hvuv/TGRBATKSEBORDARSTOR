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

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

function navItemActive(pathname: string, href: string): boolean {
  const base = href.split("#")[0] ?? href;
  if (base === SECRET_ADMIN_PATH) return pathname === SECRET_ADMIN_PATH;
  return pathname === base || pathname.startsWith(`${base}/`);
}

const TILE_COLORS: Record<string, {
  active: string;
  inactive: string;
}> = {
  home: {
    active: "bg-sky-100/90 dark:bg-sky-950/60 border border-sky-400 dark:border-sky-400 text-sky-900 dark:text-sky-100 shadow-[0_0_12px_rgba(14,165,233,0.3)]",
    inactive: "bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200/60 dark:border-sky-900/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100/90 dark:hover:bg-sky-950/40 hover:border-sky-300 dark:hover:border-sky-800 hover:text-sky-850 dark:hover:text-sky-200"
  },
  store: {
    active: "bg-blue-100/90 dark:bg-blue-950/60 border border-blue-400 dark:border-blue-400 text-blue-900 dark:text-blue-100 shadow-[0_0_12px_rgba(59,130,246,0.3)]",
    inactive: "bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100/90 dark:hover:bg-blue-950/40 hover:border-blue-300 dark:hover:border-blue-800 hover:text-blue-850 dark:hover:text-blue-200"
  },
  "admin-create-order": {
    active: "bg-indigo-100/90 dark:bg-indigo-950/60 border border-indigo-400 dark:border-indigo-400 text-indigo-900 dark:text-indigo-100 shadow-[0_0_12px_rgba(99,102,241,0.3)]",
    inactive: "bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/90 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-800 hover:text-indigo-850 dark:hover:text-indigo-200"
  },
  "new-orders": {
    active: "bg-amber-100/90 dark:bg-amber-950/60 border border-amber-400 dark:border-amber-400 text-amber-900 dark:text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.3)]",
    inactive: "bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100/90 dark:hover:bg-amber-950/40 hover:border-amber-300 dark:hover:border-amber-800 hover:text-amber-850 dark:hover:text-amber-200"
  },
  "order-tracking": {
    active: "bg-purple-100/90 dark:bg-purple-950/60 border border-purple-400 dark:border-purple-400 text-purple-900 dark:text-purple-100 shadow-[0_0_12px_rgba(168,85,247,0.3)]",
    inactive: "bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100/90 dark:hover:bg-purple-950/40 hover:border-purple-300 dark:hover:border-purple-800 hover:text-purple-850 dark:hover:text-purple-200"
  },
  shops: {
    active: "bg-emerald-100/90 dark:bg-emerald-950/60 border border-emerald-400 dark:border-emerald-400 text-emerald-900 dark:text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.3)]",
    inactive: "bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/90 dark:hover:bg-emerald-950/40 hover:border-emerald-300 dark:hover:border-emerald-800 hover:text-emerald-850 dark:hover:text-emerald-200"
  },
  couriers: {
    active: "bg-pink-100/90 dark:bg-pink-950/60 border border-pink-400 dark:border-pink-400 text-pink-900 dark:text-pink-100 shadow-[0_0_12px_rgba(236,72,153,0.3)]",
    inactive: "bg-pink-50/60 dark:bg-pink-950/20 border border-pink-200/60 dark:border-pink-900/40 text-pink-700 dark:text-pink-300 hover:bg-pink-100/90 dark:hover:bg-pink-950/40 hover:border-pink-300 dark:hover:border-pink-800 hover:text-pink-850 dark:hover:text-pink-200"
  },
  preparers: {
    active: "bg-teal-100/90 dark:bg-teal-950/60 border border-teal-400 dark:border-teal-400 text-teal-900 dark:text-teal-100 shadow-[0_0_12px_rgba(20,184,166,0.3)]",
    inactive: "bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-900/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100/90 dark:hover:bg-teal-950/40 hover:border-teal-300 dark:hover:border-teal-800 hover:text-teal-850 dark:hover:text-teal-200"
  },
  employees: {
    active: "bg-violet-100/90 dark:bg-violet-950/60 border border-violet-400 dark:border-violet-400 text-violet-900 dark:text-violet-100 shadow-[0_0_12px_rgba(139,92,246,0.3)]",
    inactive: "bg-violet-50/60 dark:bg-violet-950/20 border border-violet-200/60 dark:border-violet-900/40 text-violet-700 dark:text-violet-300 hover:bg-violet-100/90 dark:hover:bg-violet-950/40 hover:border-violet-300 dark:hover:border-violet-800 hover:text-violet-850 dark:hover:text-violet-200"
  },
  suppliers: {
    active: "bg-rose-100/90 dark:bg-rose-950/60 border border-rose-400 dark:border-rose-400 text-rose-900 dark:text-rose-100 shadow-[0_0_12px_rgba(244,63,94,0.3)]",
    inactive: "bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100/90 dark:hover:bg-rose-950/40 hover:border-rose-300 dark:hover:border-rose-800 hover:text-rose-850 dark:hover:text-rose-200"
  },
  reports: {
    active: "bg-lime-100/90 dark:bg-lime-950/60 border border-lime-400 dark:border-lime-400 text-lime-900 dark:text-lime-100 shadow-[0_0_12px_rgba(132,204,22,0.3)]",
    inactive: "bg-lime-50/60 dark:bg-lime-950/20 border border-lime-200/60 dark:border-lime-900/40 text-lime-700 dark:text-lime-300 hover:bg-lime-100/90 dark:hover:bg-lime-950/40 hover:border-lime-300 dark:hover:border-lime-800 hover:text-lime-850 dark:hover:text-lime-200"
  },
  "credit-book": {
    active: "bg-indigo-100/90 dark:bg-indigo-950/60 border border-indigo-400 dark:border-indigo-400 text-indigo-900 dark:text-indigo-100 shadow-[0_0_12px_rgba(99,102,241,0.3)]",
    inactive: "bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/90 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-800 hover:text-indigo-850 dark:hover:text-indigo-200"
  },
  customers: {
    active: "bg-fuchsia-100/90 dark:bg-fuchsia-950/60 border border-fuchsia-400 dark:border-fuchsia-400 text-fuchsia-900 dark:text-fuchsia-100 shadow-[0_0_12px_rgba(217,70,239,0.3)]",
    inactive: "bg-fuchsia-50/60 dark:bg-fuchsia-950/20 border border-fuchsia-200/60 dark:border-fuchsia-900/40 text-fuchsia-700 dark:text-fuchsia-300 hover:bg-fuchsia-100/90 dark:hover:bg-fuchsia-950/40 hover:border-fuchsia-300 dark:hover:border-fuchsia-800 hover:text-fuchsia-850 dark:hover:text-fuchsia-200"
  },
  "archived-orders": {
    active: "bg-amber-100/90 dark:bg-amber-950/60 border border-amber-400 dark:border-amber-400 text-amber-900 dark:text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.3)]",
    inactive: "bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100/90 dark:hover:bg-amber-950/40 hover:border-amber-300 dark:hover:border-amber-800 hover:text-amber-850 dark:hover:text-amber-200"
  },
  "rejected-orders": {
    active: "bg-red-100/90 dark:bg-red-950/60 border border-red-400 dark:border-red-400 text-red-900 dark:text-red-100 shadow-[0_0_12px_rgba(239,68,68,0.3)]",
    inactive: "bg-red-50/60 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-100/90 dark:hover:bg-red-950/40 hover:border-red-300 dark:hover:border-red-800 hover:text-red-850 dark:hover:text-red-200"
  },
  "legacy-kse-profiles-batch": {
    active: "bg-yellow-100/90 dark:bg-yellow-950/60 border border-yellow-400 dark:border-yellow-400 text-yellow-900 dark:text-yellow-100 shadow-[0_0_12px_rgba(234,179,8,0.3)]",
    inactive: "bg-yellow-50/60 dark:bg-yellow-950/20 border border-yellow-200/60 dark:border-yellow-900/40 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100/90 dark:hover:bg-yellow-950/40 hover:border-yellow-300 dark:hover:border-yellow-800 hover:text-yellow-850 dark:hover:text-yellow-200"
  },
  "new-customer-profile": {
    active: "bg-cyan-100/90 dark:bg-cyan-950/60 border border-cyan-400 dark:border-cyan-400 text-cyan-900 dark:text-cyan-100 shadow-[0_0_12px_rgba(6,182,212,0.3)]",
    inactive: "bg-cyan-50/60 dark:bg-cyan-950/20 border border-cyan-200/60 dark:border-cyan-900/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100/90 dark:hover:bg-cyan-950/40 hover:border-cyan-300 dark:hover:border-cyan-800 hover:text-cyan-850 dark:hover:text-cyan-200"
  },
  "wa-buttons": {
    active: "bg-green-100/90 dark:bg-green-950/60 border border-green-400 dark:border-green-400 text-green-900 dark:text-green-100 shadow-[0_0_12px_rgba(34,197,94,0.3)]",
    inactive: "bg-green-50/60 dark:bg-green-950/20 border border-green-200/60 dark:border-green-900/40 text-green-700 dark:text-green-300 hover:bg-green-100/90 dark:hover:bg-green-950/40 hover:border-green-300 dark:hover:border-green-800 hover:text-green-850 dark:hover:text-green-200"
  },
  "courier-map": {
    active: "bg-sky-100/90 dark:bg-sky-950/60 border border-sky-400 dark:border-sky-400 text-sky-900 dark:text-sky-100 shadow-[0_0_12px_rgba(14,165,233,0.3)]",
    inactive: "bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200/60 dark:border-sky-900/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100/90 dark:hover:bg-sky-950/40 hover:border-sky-300 dark:hover:border-sky-800 hover:text-sky-850 dark:hover:text-sky-200"
  },
  regions: {
    active: "bg-indigo-100/90 dark:bg-indigo-950/60 border border-indigo-400 dark:border-indigo-400 text-indigo-900 dark:text-indigo-100 shadow-[0_0_12px_rgba(99,102,241,0.3)]",
    inactive: "bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/90 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-800 hover:text-indigo-850 dark:hover:text-indigo-200"
  },
  "super-search": {
    active: "bg-amber-100/90 dark:bg-amber-950/60 border border-amber-400 dark:border-amber-400 text-amber-900 dark:text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.3)]",
    inactive: "bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100/90 dark:hover:bg-amber-950/40 hover:border-amber-300 dark:hover:border-amber-800 hover:text-amber-850 dark:hover:text-amber-200"
  },
  "prep-notices": {
    active: "bg-orange-100/90 dark:bg-orange-950/60 border border-orange-400 dark:border-orange-400 text-orange-900 dark:text-orange-100 shadow-[0_0_12px_rgba(249,115,22,0.3)]",
    inactive: "bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-900/40 text-orange-700 dark:text-orange-300 hover:bg-orange-100/90 dark:hover:bg-orange-950/40 hover:border-orange-300 dark:hover:border-orange-800 hover:text-orange-850 dark:hover:text-orange-200"
  },
  "ai-settings": {
    active: "bg-fuchsia-100/90 dark:bg-fuchsia-950/60 border border-fuchsia-400 dark:border-fuchsia-400 text-fuchsia-900 dark:text-fuchsia-100 shadow-[0_0_12px_rgba(217,70,239,0.3)]",
    inactive: "bg-fuchsia-50/60 dark:bg-fuchsia-950/20 border border-fuchsia-200/60 dark:border-fuchsia-900/40 text-fuchsia-700 dark:text-fuchsia-300 hover:bg-fuchsia-100/90 dark:hover:bg-fuchsia-950/40 hover:border-fuchsia-300 dark:hover:border-fuchsia-800 hover:text-fuchsia-850 dark:hover:text-fuchsia-200"
  },
  "notification-settings": {
    active: "bg-slate-100 dark:bg-slate-800 border border-slate-400 dark:border-slate-500 text-slate-900 dark:text-slate-100 shadow-[0_0_12px_rgba(100,116,139,0.3)]",
    inactive: "bg-slate-50/60 dark:bg-slate-900/20 border border-slate-200/60 dark:border-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100/90 dark:hover:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-800 dark:hover:text-slate-300"
  },
  "background-settings": {
    active: "bg-violet-100/90 dark:bg-violet-950/60 border border-violet-400 dark:border-violet-400 text-violet-900 dark:text-violet-100 shadow-[0_0_12px_rgba(139,92,246,0.3)]",
    inactive: "bg-violet-50/60 dark:bg-violet-950/20 border border-violet-200/60 dark:border-violet-900/40 text-violet-700 dark:text-violet-300 hover:bg-violet-100/90 dark:hover:bg-violet-950/40 hover:border-violet-300 dark:hover:border-violet-800 hover:text-violet-850 dark:hover:text-violet-200"
  },
  settings: {
    active: "bg-slate-100 dark:bg-slate-800 border border-slate-400 dark:border-slate-500 text-slate-900 dark:text-slate-100 shadow-[0_0_12px_rgba(100,116,139,0.3)]",
    inactive: "bg-slate-50/60 dark:bg-slate-900/20 border border-slate-200/60 dark:border-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100/90 dark:hover:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-800 dark:hover:text-slate-300"
  }
};

function getTileClasses(slug: string, active: boolean, isCompact: boolean, buttonShape: "square" | "rectangle"): string {
  const isSquare = buttonShape === "square" && !isCompact;
  const base = `inline-flex ${
    isSquare ? "flex-col justify-center items-center gap-1.5 p-2 text-center" : "items-center gap-2 px-2.5"
  } ${
    isCompact ? "gap-0 px-2 justify-center" : ""
  } rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 relative w-full h-full`;

  const colors = TILE_COLORS[slug] || {
    active: "bg-purple-100/90 dark:bg-[#1e102a]/60 border border-purple-400 dark:border-[#e028ff] text-purple-900 dark:text-purple-150 shadow-[0_0_12px_rgba(224,40,255,0.3)]",
    inactive: "bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100/90 dark:hover:bg-purple-950/40 hover:border-purple-300 dark:hover:border-purple-800 hover:text-purple-800 dark:hover:text-purple-200"
  };

  return `${base} ${active ? colors.active : colors.inactive}`;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [activeBgUrl, setActiveBgUrl] = useState<string | null>(null);

  const filteredTiles = orderedTiles.filter(tile =>
    tile.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  useEffect(() => {
    const updateBg = () => {
      const stored = localStorage.getItem("kse_user_background_url");
      if (stored === "none") {
        setActiveBgUrl(null);
      } else {
        setActiveBgUrl(stored);
      }
    };
    updateBg();
    window.addEventListener("kse_background_changed", updateBg);
    window.addEventListener("storage", updateBg);
    return () => {
      window.removeEventListener("kse_background_changed", updateBg);
      window.removeEventListener("storage", updateBg);
    };
  }, []);


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
      // Optional: Prevent overscroll behavior on body
      document.body.style.overscrollBehaviorY = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.overscrollBehaviorY = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.overscrollBehaviorY = '';
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
        className="fixed start-4 top-4 z-[170] flex h-10 min-w-10 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#09090b] px-2 text-[#00f3ff] shadow-[0_0_10px_rgba(0,243,255,0.2)]"
        title={navOpen ? "إخفاء القائمة" : "إظهار القائمة"}
      >
        <span className="sr-only">{navOpen ? "إخفاء القائمة" : "إظهار القائمة"}</span>
        <span className="text-sm font-black">{navOpen ? "✕" : "☰"}</span>
        <span className="hidden md:inline text-xs font-bold">{navOpen ? "إخفاء" : "القائمة"}</span>
      </button>

      {/* Mobile overlay backdrop (closes on click) */}
      {!isLg && navOpen ? (
        <div
          className="fixed inset-0 z-[115] bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`
          fixed z-[160] flex flex-col border-e border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.1)]
          shadow-[4px_0_20px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_20px_rgba(0,0,0,0.8)]
          ${isResizing ? "transition-none" : "transition-transform duration-200 ease-out"}
          inset-y-0 start-0 w-72
          ${effectiveNavOpen ? "translate-x-0 pointer-events-auto" : "-translate-x-full rtl:translate-x-full pointer-events-none"}
          lg:inset-y-0 lg:start-0
          ${activeBgUrl ? "aside-has-bg bg-cover bg-center bg-no-repeat" : "bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-md"}
        `}
        style={{ 
          width: navWidth,
          backgroundImage: activeBgUrl ? `url(${activeBgUrl})` : undefined
        }}
      >
        <div className="flex h-16 w-full items-center justify-between px-4 border-b border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.1)] shrink-0">
          <div className="flex items-center gap-2 ms-28">
            <div className="flex w-8 h-8 rounded-full bg-gradient-to-br from-[#00f3ff] to-[#e028ff] items-center justify-center shadow-[0_0_10px_rgba(224,40,255,0.5)]">
              <span className="text-black font-black text-xs">AK</span>
            </div>
            <span className="text-xs font-black text-slate-600 dark:text-slate-400">
              أبو الأكبر للتوصيل
            </span>
          </div>
        </div>
        <nav className="flex flex-1 overflow-y-auto overscroll-contain px-3 py-4">
          <div className={`grid w-full gap-2 content-start ${
            isCompact 
              ? "grid-cols-1" 
              : sidebarConfig.layoutColumns === 1 
                ? "grid-cols-1" 
                : sidebarConfig.layoutColumns === 2 
                  ? "grid-cols-2" 
                  : "grid-cols-3"
          }`}>
            <Link
              href={SECRET_ADMIN_PATH}
              prefetch={false}
              title="الرئيسية"
              onClick={handleLinkClick}
              className={getTileClasses("home", navItemActive(pathname, SECRET_ADMIN_PATH), isCompact, sidebarConfig.buttonShape)}
              style={{
                height: isCompact 
                  ? 36 * itemScale 
                  : sidebarConfig.buttonShape === "square" 
                    ? undefined 
                    : 36 * itemScale,
                aspectRatio: !isCompact && sidebarConfig.buttonShape === "square" ? "1/1" : undefined,
                fontSize: (!isCompact && sidebarConfig.buttonShape === "square" ? 10 : 12) * itemScale
              }}
            >
              <span className="shrink-0" style={{ transform: `scale(${itemScale})`, transformOrigin: 'center' }} aria-hidden>
                <DynamicIcon iconKey="ui_home" config={icons} fallback="🏠" className="w-6 h-6" />
              </span>
              {isCompact ? null : <span className="leading-snug font-medium block whitespace-nowrap">الرئيسية</span>}
            </Link>
            {isCompact ? null : (
              <p className="col-span-full mt-2 px-1 text-[11px] font-bold tracking-wider text-sky-700 dark:text-[#00f3ff] block">
                الأقسام
              </p>
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
                      ? 36 * itemScale 
                      : sidebarConfig.buttonShape === "square" 
                        ? undefined 
                        : 36 * itemScale,
                    aspectRatio: !isCompact && sidebarConfig.buttonShape === "square" ? "1/1" : undefined,
                    fontSize: (!isCompact && sidebarConfig.buttonShape === "square" ? 10 : 12) * itemScale
                  }}
                >
                  <span className="shrink-0 relative flex justify-center items-center" style={{ transform: `scale(${itemScale})`, transformOrigin: 'center' }}>
                    <DynamicIcon iconKey={tile.iconKey} config={icons} fallback={tile.slug === "credit-book" ? "📘" : "📁"} className="w-6 h-6" />
                    {showPendingBadge ? (
                      <span className="absolute -top-2 -right-2 inline-flex min-w-[1.2rem] items-center justify-center rounded-full bg-orange-600 px-1 py-0.5 text-[10px] font-black leading-none text-white shadow-[0_0_10px_orange]">
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
        <div className="border-t border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.1)] p-2 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-950/50 gap-2">
          <div className="flex items-center flex-1 min-w-0 bg-white dark:bg-[#09090b] p-1 rounded-xl border border-slate-200 dark:border-[#00f3ff]/20 shadow-sm h-10">
            {isSearching ? (
              <div className="flex items-center gap-1 flex-1 px-1 h-full">
                <input
                  type="text"
                  placeholder="بحث..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 py-0.5"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => { setIsSearching(false); setSearchQuery(""); }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs shrink-0 px-1"
                  title="إلغاء البحث"
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsSearching(true)}
                  className="w-8 h-full flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors shrink-0"
                  title="بحث في الأزرار"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setItemScale(prev => Math.max(0.7, prev - 0.05)); }}
                  className="w-7 h-full flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-500 hover:text-red-500 transition-colors shrink-0"
                  title="تصغير"
                >
                  <span className="text-lg font-bold leading-none">−</span>
                </button>
                <span className="text-[10px] font-black text-[#00f3ff] min-w-[34px] text-center shrink-0">
                  {Math.round(itemScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setItemScale(prev => Math.min(5, prev + 0.05)); }}
                  className="w-7 h-full flex items-center justify-center rounded-lg hover:bg-[#00f3ff]/10 text-slate-500 hover:text-[#00f3ff] transition-colors shrink-0"
                  title="تكبير"
                >
                  <span className="text-lg font-bold leading-none">+</span>
                </button>
              </>
            )}
          </div>

          <form action={logout} className="shrink-0 m-0">
            <button
              type="submit"
              title="تسجيل الخروج"
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-[#ff3b30]/30 bg-[#ff3b30]/5 text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors"
            >
              <span className="text-lg font-bold leading-none mt-0.5">⏻</span>
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
