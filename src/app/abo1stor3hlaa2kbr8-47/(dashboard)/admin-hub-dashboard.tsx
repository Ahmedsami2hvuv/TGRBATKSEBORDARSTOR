"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  adminSidebarTiles,
  tileHref,
  type AdminTile,
} from "@/lib/admin-nav";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

function HubMenuButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("kse:open-admin-nav"))}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 lg:hidden"
      aria-label="فتح القائمة"
    >
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}

function NeonBox({ t, colorClass, sizeClass, icons }: { t: AdminTile | undefined; colorClass: string; sizeClass?: string; icons: GlobalIconsConfig | null }) {
  if (!t) return null;

  const isIndigo = colorClass.includes('cyan') || colorClass.includes('purple');
  const themeClasses = isIndigo
    ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 hover:shadow-indigo-500/10"
    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-500/50 dark:hover:border-rose-500/50 hover:shadow-rose-500/10";

  const iconColor = isIndigo ? "text-indigo-600 dark:text-indigo-400" : "text-rose-600 dark:text-rose-400";

  return (
    <Link
      href={tileHref(t)}
      className={`rounded-3xl border ${themeClasses} shadow-sm ${sizeClass ?? ''} p-5 md:p-6 flex flex-col justify-center items-center text-center group transition-all duration-300`}
    >
      <div className={`text-4xl md:text-5xl transition-transform group-hover:scale-110 mb-3 ${iconColor}`} aria-hidden>
        <DynamicIcon iconKey={t.iconKey} config={icons} fallback="" className="w-12 h-12 md:w-16 md:h-16" />
      </div>
      <span className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">{t.label}</span>
    </Link>
  );
}

function NeonPill({ t, colorClass, icons }: { t: AdminTile | undefined; colorClass: string; icons: GlobalIconsConfig | null }) {
  if (!t) return null;
  return (
    <div className="relative group w-[280px] flex justify-end items-center mb-4">
      <Link href={tileHref(t)} className={`w-full p-4 pl-6 pr-4 flex justify-between items-center z-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:border-indigo-500/50 transition-all duration-300 hover:scale-[1.02]`}>
        <span className="font-bold text-slate-700 dark:text-slate-200 text-[15px]">{t.label}</span>
        <div className="text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" aria-hidden>
          <DynamicIcon iconKey={t.iconKey} config={icons} fallback="" className="w-7 h-7" />
        </div>
      </Link>
    </div>
  );
}

export function AdminHubDashboard() {
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);
  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  const tiles = adminSidebarTiles();
  const bySlug = Object.fromEntries(tiles.map(t => [t.slug, t]));
  const usedSlugs = new Set([
     "new-orders", "order-tracking", "archived-orders", 
     "reports", "couriers", "customers", 
     "preparers", "regions", "shops", "rejected-orders", "employees", "store"
  ]);
  const leftover = tiles.filter(t => !usedSlugs.has(t.slug));

  return (
    <div className="relative overflow-hidden w-full h-full pb-10">
      
      {/* Central Screen Grid as per Mockup */}
      <div className="flex flex-col lg:flex-row gap-8 w-full max-w-7xl mx-auto pt-4 relative">
        
        {/* Main Dashboard Cards (Left/Center area in LTR visually, but works RTL native) */}
        <div className="flex-1 flex flex-col gap-6 lg:gap-8 min-w-0">
          
          {/* Top Row: Huge Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8 xl:h-[220px]">
            {/* الطلبات الجديدة - Giant Cyan */}
            <NeonBox t={bySlug["new-orders"]} colorClass="neon-box-cyan" sizeClass="h-full py-8 xl:py-4" icons={icons} />
            
            {/* تتبع الطلبات - Giant Purple */}
            <NeonBox t={bySlug["order-tracking"]} colorClass="neon-box-purple" sizeClass="h-full py-8 xl:py-4" icons={icons} />
          </div>

          {/* Bottom Row: 3 Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 lg:gap-8 xl:h-[240px]">
            
            {/* Col 1: Small Stacked Cards */}
            <div className="flex flex-col gap-6 lg:gap-8 h-full">
              <NeonBox t={bySlug["archived-orders"]} colorClass="neon-box-cyan" sizeClass="flex-1 min-h-[100px]" icons={icons} />
              <NeonBox t={bySlug["rejected-orders"]} colorClass="neon-box-orange" sizeClass="flex-1 min-h-[100px]" icons={icons} />
            </div>

            <NeonBox t={bySlug["store"]} colorClass="neon-box-cyan" sizeClass="h-full min-h-[220px]" icons={icons} />

            <NeonBox t={bySlug["reports"]} colorClass="neon-box-purple" sizeClass="h-full min-h-[220px]" icons={icons} />
          </div>
          
          {/* Generic grid for remaining tiles not in mockup */}
          {leftover.length > 0 && (
             <div className="mt-8 flex flex-col gap-2">
                 <h3 className="text-sky-700 dark:text-[#00f3ff] text-xs font-bold tracking-widest pl-2 opacity-50 mb-4">الأقسام الإضافية</h3>
                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                   {leftover.map(t => (
                      <Link key={t.slug} href={tileHref(t)} className="neon-box neon-box-cyan p-3 lg:p-4 flex flex-col items-center justify-center gap-2">
                         <div className="text-2xl">
                           <DynamicIcon iconKey={t.iconKey} config={icons} fallback="" className="w-6 h-6" />
                         </div>
                         <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">{t.label}</span>
                      </Link>
                   ))}
                 </div>
             </div>
          )}
        </div>

        {/* Right Side Connected Pills Panel */}
        <div className="w-full lg:w-[320px] flex-shrink-0 relative hidden sm:flex flex-col items-center lg:items-end justify-start pt-8 lg:pt-10">
            <div className="flex flex-col w-[280px] relative z-10">
               <NeonPill t={bySlug["shops"]} colorClass="neon-pill-cyan" icons={icons} />
               <NeonPill t={bySlug["couriers"]} colorClass="neon-pill-cyan" icons={icons} />
               <NeonPill t={bySlug["preparers"]} colorClass="neon-pill-cyan" icons={icons} />
               <NeonPill t={bySlug["employees"]} colorClass="neon-pill-cyan" icons={icons} />
               <NeonPill t={bySlug["regions"]} colorClass="neon-pill-cyan" icons={icons} />
            </div>
        </div>
      </div>
    </div>
  );
}
