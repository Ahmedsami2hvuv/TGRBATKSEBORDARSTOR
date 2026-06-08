"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "@/components/theme-provider";
import { getBackgroundsConfigAction } from "@/app/abo1stor3hlaa2kbr8-47/(dashboard)/settings/background-actions";
import { BackgroundItem } from "@/lib/background-settings";
import { PreparerPresenceToggle } from "../preparer-presence-toggle";
import { disablePreparerSalaryPinCode, enablePreparerSalaryPinCode } from "../actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Props = {
  preparerName: string;
  auth: { p: string; exp: string; s: string };
  availableForAssignment: boolean;
  hasPinCode: boolean;
  pinDisabled: boolean;
};

export default function PreparerSettingsClient({ preparerName, auth, availableForAssignment, hasPinCode, pinDisabled }: Props) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [availableBgs, setAvailableBgs] = useState<BackgroundItem[]>([]);
  const [currentBgId, setCurrentBgId] = useState<string | null>(null);
  const [showBgSelector, setShowBgSelector] = useState(false);
  const [showDisableForm, setShowDisableForm] = useState(false);

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

        {/* الرمز السري للراتب */}
        <section className="kse-glass-dark mb-6 border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xl">🔒</span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">الرمز السري للراتب</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">تحكم بطلب الرمز السري عند استلام الراتب</p>
            </div>
          </div>

          {!hasPinCode ? (
            <div className="text-center p-4 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-850">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                لم تقم بتعيين رمز سري بعد. سيُطلب منك تعيين رمز سري عند أول عملية استلام راتب.
              </p>
            </div>
          ) : pinDisabled ? (
            <div className="flex flex-col gap-3 bg-slate-100/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-850">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">الرمز السري موقف حالياً</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">يمكنك استلام راتبك مباشرة دون الحاجة لكتابة رمز.</p>
                </div>
                <span className="text-lg">🔓</span>
              </div>
              
              <form action={async (formData) => {
                const res = await enablePreparerSalaryPinCode(null, formData);
                if (res.ok) {
                  toast.success("تم إعادة تفعيل الرمز السري بنجاح");
                  router.refresh();
                } else {
                  toast.error(res.error || "فشل تفعيل الرمز السري");
                }
              }} className="mt-2 flex flex-col gap-2">
                <input type="hidden" name="p" value={auth.p} />
                <input type="hidden" name="exp" value={auth.exp} />
                <input type="hidden" name="s" value={auth.s} />
                
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    name="pinCode"
                    placeholder="أدخل رمز سري جديد (4 أرقام)"
                    required
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-bold tracking-widest text-slate-850 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-sky-650 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 rounded-xl transition shadow-sm"
                  >
                    تفعيل الرمز
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="flex flex-col gap-3 bg-slate-100/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-850">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400">الرمز السري مفعل حالياً</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">يُطلب منك الرمز السري عند استلام الراتب لحماية حسابك.</p>
                </div>
                <span className="text-lg">🔒</span>
              </div>

              {!showDisableForm ? (
                <button
                  type="button"
                  onClick={() => setShowDisableForm(true)}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-98"
                >
                  إيقاف تفعيل الرمز السري
                </button>
              ) : (
                <form action={async (formData) => {
                  const res = await disablePreparerSalaryPinCode(null, formData);
                  if (res.ok) {
                    toast.success("تم إيقاف تفعيل الرمز السري بنجاح");
                    setShowDisableForm(false);
                    router.refresh();
                  } else {
                    toast.error(res.error || "الرمز السري غير صحيح");
                  }
                }} className="flex flex-col gap-2">
                  <input type="hidden" name="p" value={auth.p} />
                  <input type="hidden" name="exp" value={auth.exp} />
                  <input type="hidden" name="s" value={auth.s} />
                  
                  <p className="text-[11px] font-bold text-slate-600 dark:text-slate-350">لتأكيد إيقاف الرمز، يرجى كتابة الرمز السري الحالي:</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      name="pinCode"
                      placeholder="الرمز الحالي"
                      required
                      autoFocus
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-bold tracking-widest text-slate-850 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition"
                    >
                      تأكيد الإيقاف
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDisableForm(false)}
                      className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 rounded-xl transition"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </section>

        {/* حالة التوفر للإسناد */}
        <section className="kse-glass-dark mb-6 border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xl">🔔</span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">حالة التوفر للإسناد</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">حدد ما إذا كنت متاحاً لاستقبال وإسناد الطلبات الجديدة للمناديب</p>
            </div>
          </div>
          <div className="flex justify-center bg-slate-100/50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-850">
            <PreparerPresenceToggle auth={auth} availableForAssignment={availableForAssignment} />
          </div>
        </section>

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
          <div className="mb-6 w-full">
            <button
              type="button"
              onClick={() => setShowBgSelector(!showBgSelector)}
              className="w-full py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-sm text-slate-800 dark:text-slate-200 shadow-sm transition-all active:scale-98 flex items-center justify-between px-5 outline-none"
            >
              <span>تغيير خلفية الحساب</span>
              <span className="text-xs text-slate-400 font-bold">{showBgSelector ? "▲ إخفاء" : "▼ عرض"}</span>
            </button>

            {showBgSelector && (
              <section className="kse-glass-dark mt-3 border border-slate-200 dark:border-slate-850 rounded-2xl p-5 shadow-sm transition-all duration-300">
                <div className="mb-4">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">اختر خلفية حسابك</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">اختر خلفية حية متحركة لتزيين واجهة حسابك</p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {availableBgs.map((bg) => {
                    const active = currentBgId === bg.id;

                    return (
                      <button
                        key={bg.id}
                        onClick={() => handleSelectBackground(bg.id)}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-black transition-all ${
                          active
                            ? "bg-sky-500 border-sky-600 text-white dark:bg-[#00f3ff] dark:border-[#00f3ff] dark:text-black shadow-md scale-[1.02]"
                            : "border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850"
                        }`}
                      >
                        <span className="truncate">{bg.name}</span>
                        {active && <span className="text-[10px] font-black bg-white/20 dark:bg-black/10 px-1.5 py-0.5 rounded-full">✓ نشط</span>}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
