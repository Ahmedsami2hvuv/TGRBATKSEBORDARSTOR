"use client";

import { useTheme } from "./theme-provider";
import { useState, useRef, useEffect } from "react";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const click = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, []);

  if (!mounted) {
    return <div className="h-10 w-10"></div>; // Placeholder during SSR
  }

  const icon = theme === "light" ? "☀️" : theme === "dark" ? "🌙" : "⏳";

  return (
    <div className="relative" ref={ref}>
      <button 
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-[rgba(255,255,255,0.05)] border border-slate-200 dark:border-[#00f3ff]/30 text-lg shadow-sm transition hover:scale-105"
        title="تغيير المظهر"
      >
        {icon}
      </button>
      
      {open && (
        <div className="absolute left-0 top-full mt-2 w-36 rounded-xl border border-slate-200 dark:border-[#00f3ff]/30 bg-white dark:bg-[#09090b] shadow-xl p-1 z-[9999]">
          <button onClick={() => {setTheme("light"); setOpen(false)}} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${theme === 'light' ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <span className="w-6 text-center">☀️</span> نهاري
          </button>
          <button onClick={() => {setTheme("dark"); setOpen(false)}} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${theme === 'dark' ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <span className="w-6 text-center">🌙</span> ليلي
          </button>
          <button onClick={() => {setTheme("auto"); setOpen(false)}} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${theme === 'auto' ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <span className="w-6 text-center">⏳</span> مع الوقت
          </button>
        </div>
      )}
    </div>
  );
}
