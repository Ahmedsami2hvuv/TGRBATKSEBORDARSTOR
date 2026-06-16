"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { MandoubPresenceToggle } from "./mandoub-presence-toggle";
import { MandoubNotificationsDiagnostics } from "./mandoub-notifications-diagnostics";

type Auth = { c: string; exp?: string; s: string };

type Props = {
  auth: Auth;
  availableForAssignment: boolean;
  telegramLink: string | null;
  baseQueryString: string;
};

export function MandoubSettingsDropdown({
  auth,
  availableForAssignment,
  telegramLink,
  baseQueryString,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // إغلاق القائمة المنسدلة عند النقر في أي مكان خارجها
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-right" ref={dropdownRef} dir="rtl">
      {/* زر الإعدادات الرئيسي */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-[rgba(255,255,255,0.05)] border text-lg shadow-sm transition hover:scale-105 active:scale-95 ${
          isOpen 
            ? "border-sky-500 ring-2 ring-sky-300/50 dark:border-[#00f3ff]/50 dark:ring-[#00f3ff]/30" 
            : "border-slate-200 dark:border-[#00f3ff]/30"
        }`}
        title="الإعدادات والقائمة السريعة"
        type="button"
      >
        ⚙️
      </button>

      {/* القائمة المنسدلة */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 origin-top-left rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 p-2 shadow-xl ring-1 ring-black/5 focus:outline-none z-50 animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-md">
          <div className="flex flex-col gap-1">
            
            {/* عنوان القائمة */}
            <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-850 mb-1 text-right">
              <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                القائمة السريعة
              </span>
            </div>

            {/* خيار جاهز للإسناد */}
            <div className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 transition">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-base shrink-0 select-none">
                  {availableForAssignment ? "🟢" : "⚪"}
                </span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  جاهز للإسناد
                </span>
              </div>
              <div className="shrink-0 scale-90 origin-left">
                <MandoubPresenceToggle auth={auth} availableForAssignment={availableForAssignment} />
              </div>
            </div>

            {/* خيار تشخيص الإشعارات */}
            <div className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 transition">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-base shrink-0 select-none">📢</span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  فحص الإشعارات
                </span>
              </div>
              <div className="shrink-0 scale-90 origin-left">
                <MandoubNotificationsDiagnostics auth={auth} />
              </div>
            </div>

            {/* خيار بوت التليجرام (إذا كان متوفراً) */}
            {telegramLink && (
              <a
                href={telegramLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 transition text-slate-700 dark:text-slate-200"
                onClick={() => setIsOpen(false)}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base shrink-0 select-none">💬</span>
                  <span className="text-sm font-bold">بوت التليجرام</span>
                </div>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#229ED9] text-white shadow-sm ring-1 ring-[#1b8bc2] scale-90">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.52-1.4.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.45-.42-1.39-.88.03-.24.36-.48.99-.73 3.88-1.69 6.47-2.8 7.77-3.33 3.7-1.51 4.47-1.77 4.97-1.78.11 0 .36.03.52.16.14.12.18.28.19.45.01.06.01.12 0 .19z" />
                  </svg>
                </span>
              </a>
            )}

            {/* رابط إعدادات التطبيق */}
            <Link
              href={`/mandoub/settings?${baseQueryString}`}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850 transition border-t border-slate-100 dark:border-slate-800 mt-1 pt-2"
              onClick={() => setIsOpen(false)}
            >
              <span className="text-base shrink-0 select-none">⚙️</span>
              <span className="flex-1 text-right">إعدادات التطبيق</span>
              <span className="text-xs text-slate-400 font-bold font-sans">←</span>
            </Link>

          </div>
        </div>
      )}
    </div>
  );
}
