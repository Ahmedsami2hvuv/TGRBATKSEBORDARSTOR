"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "@/components/theme-provider";
import { updateCourierSetting } from "./actions";
import { getBackgroundsConfigAction } from "@/app/abo1stor3hlaa2kbr8-47/(dashboard)/settings/background-actions";
import { BackgroundItem } from "@/lib/background-settings";

type CourierSettings = {
  showLocationBtn: boolean;
  showDoorBtn: boolean;
  showCallBtn: boolean;
  showWhatsAppBtn: boolean;
  showMoneyBoxes: boolean;
  showNotesBtn: boolean;
  showVoiceNotesBtn: boolean;
};

type Props = {
  courierName: string;
  courierPhone: string;
  initialSettings: CourierSettings;
  auth: { c: string; exp: string; s: string };
};

export default function CourierSettingsClient({
  courierName,
  courierPhone,
  initialSettings,
  auth,
}: Props) {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<CourierSettings>(initialSettings);
  const [savingState, setSavingState] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [availableBgs, setAvailableBgs] = useState<BackgroundItem[]>([]);
  const [currentBgId, setCurrentBgId] = useState<string | null>(null);
  const [showBgSelector, setShowBgSelector] = useState(false);

  useEffect(() => {
    // جلب الخلفيات المفعلة من السيرفر
    getBackgroundsConfigAction().then(data => {
      const activeItems = data?.items?.filter(item => item.isActive) || [];
      setAvailableBgs(activeItems);
      
      const savedBg = localStorage.getItem("kse_user_background");
      if (savedBg) {
        setCurrentBgId(savedBg);
      } else {
        setCurrentBgId(data?.defaultBackgroundId || "default-gradient");
      }
    }).catch(err => console.error("Failed to load active backgrounds", err));
  }, []);

  const handleSelectBackground = (id: string) => {
    localStorage.setItem("kse_user_background", id);
    setCurrentBgId(id);
    // إرسال حدث مخصص للمزامنة اللحظية في نفس التبويب
    window.dispatchEvent(new Event("kse_bg_changed"));
  };

  const baseQuery = new URLSearchParams();
  baseQuery.set("c", auth.c);
  if (auth.exp) baseQuery.set("exp", auth.exp);
  baseQuery.set("s", auth.s);

  async function handleToggle(
    key: keyof CourierSettings,
    currentValue: boolean
  ) {
    const newValue = !currentValue;
    setSavingState((prev) => ({ ...prev, [key]: "saving" }));
    
    // Update local state immediately for snappy UX
    setSettings((prev) => ({ ...prev, [key]: newValue }));

    try {
      const result = await updateCourierSetting(auth, key, newValue);
      if (result.ok) {
        setSavingState((prev) => ({ ...prev, [key]: "saved" }));
        setTimeout(() => {
          setSavingState((prev) => ({ ...prev, [key]: "idle" }));
        }, 1500);
      } else {
        throw new Error(result.error || "خطأ غير متوقع");
      }
    } catch (error) {
      console.error(`Failed to update ${key}:`, error);
      // Revert state on error
      setSettings((prev) => ({ ...prev, [key]: currentValue }));
      setSavingState((prev) => ({ ...prev, [key]: "error" }));
      setTimeout(() => {
        setSavingState((prev) => ({ ...prev, [key]: "idle" }));
      }, 3000);
    }
  }

  const items = [
    {
      key: "showLocationBtn" as const,
      icon: "📍",
      title: "زر الموقع الجغرافي (GPS)",
      desc: "إظهار أو إخفاء زر الانتقال للخريطة من خارج تفاصيل الطلب",
    },
    {
      key: "showDoorBtn" as const,
      icon: "📷",
      title: "زر صورة باب الزبون",
      desc: "إظهار أو إخفاء زر كاميرا التقاط صورة باب الزبون خارج الطلب",
    },
    {
      key: "showCallBtn" as const,
      icon: "📞",
      title: "زر الاتصال الهاتفي السريع",
      desc: "إظهار أو إخفاء زر الاتصال الهاتفي بالزبون خارج الطلب",
    },
    {
      key: "showWhatsAppBtn" as const,
      icon: "💬",
      title: "زر مراسلة واتساب",
      desc: "إظهار أو إخفاء زر مراسلة الزبون على واتساب خارج الطلب",
    },
    {
      key: "showVoiceNotesBtn" as const,
      icon: "🎤",
      title: "البصمة الصوتية للطلبية",
      desc: "إظهار أو إخفاء زر الاستماع للبصمة الصوتية خارج تفاصيل الطلب",
    },
    {
      key: "showNotesBtn" as const,
      icon: "📝",
      title: "الملاحظات وقائمة المواد",
      desc: "إظهار أو إخفاء قائمة المواد والملاحظات الكتابية خارج الطلب",
    },
    {
      key: "showMoneyBoxes" as const,
      icon: "💵",
      title: "صادر ووارد الطلبية",
      desc: "إظهار أو إخفاء مربعات المبالغ المالية (صادر/وارد) من خارج الطلب",
    },
  ];

  return (
    <div dir="rtl" lang="ar" className="kse-app-bg min-h-screen text-slate-800 dark:text-slate-100">
      <div className="kse-app-inner mx-auto max-w-2xl px-4 py-6 pb-24">
        {/* Header */}
        <header className="kse-glass-dark mb-6 flex items-center gap-3 border border-sky-200/90 dark:border-[#00f3ff]/20 px-4 py-3.5 shadow-md rounded-2xl">
          <Link
            href={`/mandoub?${baseQuery.toString()}`}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
            title="رجوع"
          >
            <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black text-slate-900 dark:text-[#00f3ff]">إعدادات التطبيق</h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">تخصيص واجهة المندوب: {courierName}</p>
          </div>
        </header>

        {/* Theme Settings Box */}
        <section className="kse-glass-dark mb-6 border border-slate-200 dark:border-[#00f3ff]/20 rounded-2xl p-5 shadow-sm">
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

        {/* الخلفيات الحية التفاعلية */}
        {availableBgs.length > 0 && (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowBgSelector(!showBgSelector)}
              className="w-full py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-sm text-slate-800 dark:text-slate-200 shadow-sm transition-all active:scale-98 flex items-center justify-between px-5 outline-none"
            >
              <span>تغيير خلفية الحساب</span>
              <span className="text-xs text-slate-400 font-bold">{showBgSelector ? "▲ إخفاء" : "▼ عرض"}</span>
            </button>

            {showBgSelector && (
              <section className="kse-glass-dark mt-3 border border-slate-200 dark:border-[#00f3ff]/20 rounded-2xl p-5 shadow-sm transition-all duration-300">
                <div className="mb-4">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">اختر خلفية حسابك</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">اختر خلفية حية متحركة لتزيين واجهة حسابك</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {availableBgs.map((bg) => {
                    const active = currentBgId === bg.id;

                    return (
                      <button
                        key={bg.id}
                        onClick={() => handleSelectBackground(bg.id)}
                        className={`group relative flex items-center justify-center py-3.5 px-4 rounded-xl border transition-all text-center text-xs font-black shadow-sm ${
                          active
                            ? "bg-sky-500 text-white border-sky-600 dark:bg-[#00f3ff] dark:text-black dark:border-[#00f3ff] scale-[1.02]"
                            : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <span className="truncate w-full">
                          {bg.name} {active && "✓"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Quick Actions Visibility Toggles */}
        <section className="kse-glass-dark border border-slate-200 dark:border-[#00f3ff]/20 rounded-2xl p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">أزرار الوصول السريع والبيانات</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">تفعيل أو إخفاء الخيارات من قائمة الطلبات الخارجية</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => {
              const val = settings[item.key];
              const state = savingState[item.key] || "idle";

              return (
                <div key={item.key} className="flex items-center justify-between py-4 first:pt-0 last:pb-0 gap-4">
                  {/* Info */}
                  <div className="flex gap-3 min-w-0">
                    <span className="text-2xl mt-0.5 shrink-0 select-none">{item.icon}</span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal mt-0.5">{item.desc}</p>
                    </div>
                  </div>

                  {/* Switch & Save Status */}
                  <div className="flex items-center gap-3 shrink-0">
                    {state === "saving" && (
                      <span className="size-4 rounded-full border-2 border-sky-500 border-t-transparent animate-spin"></span>
                    )}
                    {state === "saved" && (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-pulse">✓ تم الحفظ</span>
                    )}
                    {state === "error" && (
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400">⚠️ فشل!</span>
                    )}

                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={val}
                        disabled={state === "saving"}
                        onChange={() => handleToggle(item.key, val)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-sky-500/20 dark:peer-focus:ring-sky-400/20 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500 dark:peer-checked:bg-[#00f3ff]/80"></div>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
