"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "@/components/theme-provider";
import { getSiteBackgroundsConfigAction } from "@/app/abo1stor3hlaa2kbr8-47/(dashboard)/settings/site-background-actions";
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
  telegramLink?: string | null;
};

export default function PreparerSettingsClient({ preparerName, auth, availableForAssignment, hasPinCode, pinDisabled, telegramLink }: Props) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [availableBgs, setAvailableBgs] = useState<BackgroundItem[]>([]);
  const [currentBgId, setCurrentBgId] = useState<string | null>(null);
  const [showBgSelector, setShowBgSelector] = useState(false);
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [showGesturesPage, setShowGesturesPage] = useState(false);

  // إعدادات إيماءات الأصابع (24 إيماءة مختلفة تشمل 2، 3، 4، 5 أصابع مع النقرات والسحبات)
  const [gestures, setGestures] = useState<Record<string, string>>({});

  // توليد قائمة المفاتيح ديناميكياً
  const getGestureKeys = () => {
    const keys: string[] = [];
    [2, 3, 4, 5].forEach((fingers) => {
      keys.push(`long_press_${fingers}`);
      ["right", "left", "up", "down"].forEach((dir) => {
        keys.push(`swipe_${fingers}_${dir}`);
      });
    });
    return keys;
  };

  useEffect(() => {
    const keys = getGestureKeys();
    const loadedGestures: Record<string, string> = {};
    
    keys.forEach((key) => {
      loadedGestures[key] = localStorage.getItem(`gesture_${key}`) || "none";
    });
    
    setGestures(loadedGestures);
  }, []);

  const handleGestureChange = (key: string, val: string) => {
    localStorage.setItem(`gesture_${key}`, val);
    setGestures((prev) => ({
      ...prev,
      [key]: val,
    }));

    // مزامنة الإعدادات فوراً مع تطبيق الأندرويد
    if (typeof window !== "undefined" && (window as any).AndroidGestures?.saveGestureAction) {
      try {
        (window as any).AndroidGestures.saveGestureAction(key, val);
      } catch (e) {
        console.error("Failed to sync gesture with Android", e);
      }
    }
  };

  // مزامنة تلقائية للإيماءات مع الأندرويد عند تحميل الصفحة للتأكيد
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).AndroidGestures?.saveGestureAction) {
      const keys = getGestureKeys();
      keys.forEach((key) => {
        const val = localStorage.getItem(`gesture_${key}`) || "none";
        try {
          (window as any).AndroidGestures.saveGestureAction(key, val);
        } catch (e) {}
      });
    }
  }, [gestures]);

  const baseQuery = new URLSearchParams();
  baseQuery.set("p", auth.p);
  if (auth.exp) baseQuery.set("exp", auth.exp);
  baseQuery.set("s", auth.s);

  useEffect(() => {
    const handleData = (data: any) => {
      const activeItems = data?.items?.filter((item: any) => item.isActive) || [];
      setAvailableBgs(activeItems);

      const savedBg = localStorage.getItem("kse_user_background");
      if (savedBg) {
        setCurrentBgId(savedBg);
      } else {
        setCurrentBgId(data?.defaultBackgroundId || "default-gradient");
      }
    };

    // 1. تحميل التكوين من الكاش فوراً للسرعة في الهاتف
    const cached = localStorage.getItem("kse_backgrounds_config_cache");
    if (cached) {
      try {
        handleData(JSON.parse(cached));
      } catch (e) {
        console.error("فشل قراءة كاش الخلفيات:", e);
      }
    }

    // 2. تحديث التكوين من السيرفر في الخلفية وحفظه بالكاش
    getSiteBackgroundsConfigAction()
      .then((data: any) => {
        if (data) {
          handleData(data);
          localStorage.setItem("kse_backgrounds_config_cache", JSON.stringify(data));
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

  if (showGesturesPage) {
    return (
      <div dir="rtl" lang="ar" className="kse-app-bg min-h-screen text-slate-800 dark:text-slate-100">
        <div className="kse-app-inner mx-auto max-w-2xl px-4 py-6 pb-24">
          {/* Header */}
          <header className="kse-glass-dark mb-6 flex items-center gap-3 border border-emerald-200/90 dark:border-emerald-800/20 px-4 py-3.5 shadow-md rounded-2xl">
            <button
              type="button"
              onClick={() => setShowGesturesPage(false)}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              title="رجوع"
            >
              <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: 'rotate(180deg)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-black text-slate-900 dark:text-[#00f3ff]">إيماءات وحركات الأصابع</h1>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">تخصيص حركات أصابعك على الشاشة لتنفيذ إجراءات سريعة فورية</p>
            </div>
          </header>

          <div className="space-y-4 bg-slate-100/50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-850 shadow-sm">
            {(() => {
              const gestureOptions: { key: string; label: string }[] = [];
              
              // النقرات المطولة
              [2, 3, 4, 5].forEach((fingers) => {
                gestureOptions.push({
                  key: `long_press_${fingers}`,
                  label: `النقر المطول بـ ${fingers} أصابع (ثانيتين)`,
                });
              });
              
              // السحبات
              const directions = [
                { id: "right", label: "لليمين ➡️" },
                { id: "left", label: "لليسار ⬅️" },
                { id: "up", label: "للأعلى ⬆️" },
                { id: "down", label: "للأسفل ⬇️" },
              ];
              
              [2, 3, 4, 5].forEach((fingers) => {
                directions.forEach((dir) => {
                  gestureOptions.push({
                    key: `swipe_${fingers}_${dir.id}`,
                    label: `السحب بـ ${fingers} أصابع ${dir.label}`,
                  });
                });
              });

              return gestureOptions.map((gesture) => (
                <div key={gesture.key} className="flex flex-col gap-1 border-b border-slate-200/50 dark:border-slate-800/50 pb-4 last:border-b-0 last:pb-0">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-350">{gesture.label}</label>
                  <select
                    value={gestures[gesture.key] || "none"}
                    onChange={(e) => handleGestureChange(gesture.key, e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-850 dark:border-slate-800 dark:bg-slate-950 dark:text-white outline-none focus:border-sky-500 dark:focus:border-[#00f3ff] transition"
                  >
                    <option value="none">🚫 لا شيء (تعطيل الحركة)</option>
                    <option value="create_order">➕ إنشاء طلب يدوي</option>
                    <option value="debts_list">💸 فتح قائمة الديون</option>
                    <option value="latest_order">📦 فتح أحدث طلب تجهيز</option>
                    <option value="open_whatsapp">💬 فتح واتس اب الإدارة</option>
                    <option value="open_telegram">✈️ فتح تليجرام الإدارة</option>
                    <option value="open_camera">📷 فتح الكاميرا فوراً</option>
                    <option value="reload_page">🔄 تحديث الصفحة</option>
                    <option value="text_zoom_in">🔍 تكبير نصوص الصفحة (1%)</option>
                    <option value="text_zoom_out">📉 تصغير نصوص الصفحة (1%)</option>
                  </select>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    );
  }

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
              <p className="text-xs text-slate-500 dark:text-slate-400">تحكم بطلب وتعيين الرمز السري عند استلام الراتب</p>
            </div>
          </div>

          {!hasPinCode ? (
            <div className="flex flex-col gap-3 bg-slate-100/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-850">
              <div>
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400">لم تقم بتعيين رمز سري بعد</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">يرجى تعيين رمز لحماية حسابك عند سحب الراتب (يمكن كتابة أحرف أو أرقام عربي/إنجليزي).</p>
              </div>
              
              <form action={async (formData) => {
                const res = await enablePreparerSalaryPinCode(null, formData);
                if (res.ok) {
                  toast.success("تم تعيين وتفعيل الرمز السري بنجاح");
                  router.refresh();
                } else {
                  toast.error(res.error || "فشل تعيين الرمز السري");
                }
              }} className="mt-1 flex flex-col gap-2">
                <input type="hidden" name="p" value={auth.p} />
                <input type="hidden" name="exp" value={auth.exp} />
                <input type="hidden" name="s" value={auth.s} />
                
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    name="pinCode"
                    placeholder="اكتب رمزك السري هنا"
                    required
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-bold text-slate-850 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 rounded-xl transition shadow-sm"
                  >
                    تثبيت الرمز
                  </button>
                </div>
              </form>
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
                  toast.success("تم إعادة تشغيل الرمز السري بنجاح");
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
                    type="text"
                    name="pinCode"
                    placeholder="اكتب رمزاً جديداً لتشغيله"
                    required
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-bold text-slate-850 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 rounded-xl transition shadow-sm"
                  >
                    تشغيل الرمز
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

              {!showDisableForm && !showChangeForm && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDisableForm(true)}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-98"
                  >
                    إيقاف تفعيل الرمز
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowChangeForm(true)}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-98"
                  >
                    تغيير الرمز السري
                  </button>
                </div>
              )}

              {showDisableForm && (
                <form action={async (formData) => {
                  const res = await disablePreparerSalaryPinCode(null, formData);
                  if (res.ok) {
                    toast.success("تم إيقاف تفعيل الرمز السري بنجاح");
                    setShowDisableForm(false);
                    router.refresh();
                  } else {
                    toast.error(res.error || "الرمز السري الحالي غير صحيح");
                  }
                }} className="flex flex-col gap-2">
                  <input type="hidden" name="p" value={auth.p} />
                  <input type="hidden" name="exp" value={auth.exp} />
                  <input type="hidden" name="s" value={auth.s} />
                  
                  <p className="text-[11px] font-bold text-slate-600 dark:text-slate-350">لتأكيد إيقاف الرمز، يرجى كتابة الرمز السري الحالي:</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      name="pinCode"
                      placeholder="الرمز الحالي"
                      required
                      autoFocus
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-bold text-slate-850 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
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

              {showChangeForm && (
                <form action={async (formData) => {
                  const res = await enablePreparerSalaryPinCode(null, formData);
                  if (res.ok) {
                    toast.success("تم تغيير الرمز السري بنجاح");
                    setShowChangeForm(false);
                    router.refresh();
                  } else {
                    toast.error(res.error || "فشل تغيير الرمز السري");
                  }
                }} className="flex flex-col gap-2">
                  <input type="hidden" name="p" value={auth.p} />
                  <input type="hidden" name="exp" value={auth.exp} />
                  <input type="hidden" name="s" value={auth.s} />
                  
                  <p className="text-[11px] font-bold text-slate-600 dark:text-slate-355">اكتب الرمز السري الجديد:</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      name="pinCode"
                      placeholder="الرمز الجديد"
                      required
                      autoFocus
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-bold text-slate-850 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition"
                    >
                      حفظ الرمز
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowChangeForm(false)}
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

        {/* ربط التيليجرام */}
        {telegramLink && (
          <section className="kse-glass-dark mb-6 border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-xl">🔹</span>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">بوت التيليجرام</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">اربط حسابك مع بوت التليجرام للحصول على الإشعارات وإدارة الحساب</p>
              </div>
            </div>
            <a
              href={telegramLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-11 flex items-center justify-center rounded-xl bg-[#229ED9] text-white shadow-sm ring-1 ring-[#1b8bc2] font-black text-sm transition hover:bg-[#1b8bc2] active:scale-95 gap-2"
              title="فتح بوت التليجرام"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.52-1.4.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.45-.42-1.39-.88.03-.24.36-.48.99-.73 3.88-1.69 6.47-2.8 7.77-3.33 3.7-1.51 4.47-1.77 4.97-1.78.11 0 .36.03.52.16.14.12.18.28.19.45.01.06.01.12 0 .19z" />
              </svg>
              فتح بوت التليجرام 🚀
            </a>
          </section>
        )}

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

        {/* زر الانتقال لصفحة تخصيص إيماءات الأصابع كصفحة كاملة */}
        <button
          type="button"
          onClick={() => setShowGesturesPage(true)}
          className="w-full kse-glass-dark mb-6 border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm hover:scale-[1.01] active:scale-98 transition-all flex items-center justify-between text-right outline-none"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🖐️</span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">إيماءات وحركات الأصابع</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">خصص حركات أصابعك على الشاشة لتنفيذ إجراءات سريعة فورية (صفحة كاملة)</p>
            </div>
          </div>
          <span className="text-xl text-slate-400 dark:text-slate-500">←</span>
        </button>

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
