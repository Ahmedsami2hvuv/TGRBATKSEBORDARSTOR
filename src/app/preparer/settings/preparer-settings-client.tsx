"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "@/components/theme-provider";
import { getBackgroundsConfigAction } from "@/app/abo1stor3hlaa2kbr8-47/(dashboard)/settings/background-actions";
import { BackgroundItem } from "@/lib/background-settings";

type Props = {
  preparerName: string;
  auth: { p: string; exp: string; s: string };
};

export default function PreparerSettingsClient({ preparerName, auth }: Props) {
  const { theme, setTheme } = useTheme();
  const [availableBgs, setAvailableBgs] = useState<BackgroundItem[]>([]);
  const [currentBgId, setCurrentBgId] = useState<string | null>(null);

  const baseQuery = new URLSearchParams();
  baseQuery.set("p", auth.p);
  if (auth.exp) baseQuery.set("exp", auth.exp);
  baseQuery.set("s", auth.s);

  useEffect(() => {
    // جلب الخلفيات المفعلة من السيرفر
    getBackgroundsConfigAction()
      .then((data) => {
        const activeItems = data?.items?.filter((item) => item.isActive) || [];
        setAvailableBgs(activeItems);

        const savedBg = localStorage.getItem("kse_user_background");
        if (savedBg) {
          setCurrentBgId(savedBg);
        } else {
          setCurrentBgId(data?.defaultBackgroundId || "default-gradient");
        }
      })
      .catch((err) => console.error("Failed to load active backgrounds", err));
  }, []);

  const handleSelectBackground = (id: string) => {
    localStorage.setItem("kse_user_background", id);
    setCurrentBgId(id);
    // إرسال حدث مخصص للمزامنة اللحظية في نفس التبويب
    window.dispatchEvent(new Event("kse_bg_changed"));
  };

  return (
    <div dir="rtl" lang="ar" className="kse-app-bg min-h-screen text-slate-800 dark:text-slate-100">
      <div className="kse-app-inner mx-auto max-w-2xl px-4 py-6 pb-24">
        {/* Header */}
        <header className="kse-glass-dark mb-6 flex items-center gap-3 border border-emerald-200/90 dark:border-emerald-800/20 px-4 py-3.5 shadow-md rounded-2xl">
          <Link
            href={`/preparer?${baseQuery.toString()}`}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
            title="رجوع"
          >
            <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black text-slate-900 dark:text-[#00f3ff]">إعدادات المجهز</h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">تخصيص واجهة المجهز: {preparerName}</p>
          </div>
        </header>

        {/* Theme Settings Box */}
        <section className="kse-glass-dark mb-6 border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xl">🎨</span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">مظهر التطبيق</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">اختر وضع الليل والنهار أو الوضع التلقائي</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 bg-slate-100/80 dark:bg-slate-900/60 p-1.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
            {[
              { id: "light", label: "نهاري", icon: "☀️" },
              { id: "dark", label: "ليلي", icon: "🌙" },
              { id: "auto", label: "تلقائي", icon: "⏳" },
            ].map((opt) => {
              const active = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setTheme(opt.id as any)}
                  className={`flex flex-col items-center justify-center py-2.5 rounded-lg text-xs font-bold transition-all ${
                    active
                      ? "bg-white dark:bg-slate-800 text-sky-600 dark:text-[#00f3ff] shadow-sm scale-[1.02]"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span className="text-lg mb-1">{opt.icon}</span>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Live Backgrounds Box */}
        {availableBgs.length > 0 && (
          <section className="kse-glass-dark border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-xl">🎆</span>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">خلفية الحساب الحية</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">اختر خلفية حية متحركة تزيّن واجهة حسابك</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {availableBgs.map((bg) => {
                const active = currentBgId === bg.id;
                const previewUrl = theme === "dark" ? bg.darkUrl : bg.lightUrl;
                const previewType = theme === "dark" ? bg.darkType : bg.lightType;

                return (
                  <button
                    key={bg.id}
                    onClick={() => handleSelectBackground(bg.id)}
                    className={`group relative flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-center ${
                      active
                        ? "bg-sky-50/50 dark:bg-sky-950/20 border-sky-500 dark:border-[#00f3ff] scale-[1.02]"
                        : "border-slate-200/60 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850"
                    }`}
                  >
                    {/* إطار المعاينة الصغير */}
                    <div className="w-full h-16 rounded-lg bg-slate-100 dark:bg-slate-900 overflow-hidden relative mb-2 flex items-center justify-center border border-slate-200/40 dark:border-slate-800/80">
                      {previewType === "video" && previewUrl ? (
                        <video src={previewUrl} muted loop autoPlay playsInline className="w-full h-full object-cover opacity-60" />
                      ) : previewUrl ? (
                        <img src={previewUrl} alt="" className="w-full h-full object-cover opacity-60" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-100 to-sky-100/50 dark:from-slate-800 dark:to-slate-905 opacity-60" />
                      )}

                      {active && (
                        <div className="absolute inset-0 bg-sky-500/10 dark:bg-[#00f3ff]/10 flex items-center justify-center">
                          <span className="bg-sky-600 dark:bg-[#00f3ff] text-white dark:text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm">
                            نشط ✓
                          </span>
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] font-black text-slate-850 dark:text-slate-200 truncate w-full">
                      {bg.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
