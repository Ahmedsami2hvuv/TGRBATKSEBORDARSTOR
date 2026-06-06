"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ensureNotificationAudioContext } from "@/lib/notification-sound-client";

type Auth = { c: string; exp?: string; s: string };

function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 4000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), timeoutMs)
    ),
  ]);
}

export function MandoubNotificationsDiagnosticsFullPage({
  auth,
  courierName,
}: {
  auth: Auth;
  courierName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const checkStatus = async () => {
    if (typeof window === "undefined") return;

    // 1. فحص الدعم والإذن
    const supported = "Notification" in window;
    if (!supported || Notification.permission !== "granted") {
      setIsActive(false);
      return;
    }

    // 2. فحص حالة OneSignal
    const OneSignal = (window as any).OneSignal;
    if (OneSignal) {
      if (!OneSignal.Notifications.permission) {
        setIsActive(false);
        return;
      }
      try {
        if (OneSignal.User && typeof OneSignal.User.getExternalId === "function") {
          const extId = await withTimeout(OneSignal.User.getExternalId(), 2000);
          if (extId === auth.c) {
            setIsActive(true);
            setErrorMsg(null);
            return;
          }
        }
      } catch (err) {
        console.error("Error reading OneSignal External ID in status check:", err);
      }
    }
    
    if (isActive === null) {
      setIsActive(false);
    }
  };

  useEffect(() => {
    void checkStatus();
  }, [auth.c]);

  const handleActivate = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      if (typeof window === "undefined") return;
      if (!("Notification" in window)) {
        throw new Error("unsupported_browser");
      }

      if (Notification.permission === "denied") {
        throw new Error("permission_denied");
      }

      // تنشيط الصوت والـ Audio Context
      const audioCtx = ensureNotificationAudioContext();
      if (audioCtx) {
        await audioCtx.resume().catch(() => {});
      }

      const windowObj = window as any;
      const OneSignal = windowObj.OneSignal;

      if (!OneSignal) {
        throw new Error("onesignal_not_loaded");
      }

      windowObj.OneSignalDeferred = windowObj.OneSignalDeferred || [];
      
      await new Promise<void>((resolve, reject) => {
        windowObj.OneSignalDeferred.push(async (OS: any) => {
          try {
            if (!windowObj.__onesignal_initialized) {
              try {
                await withTimeout(
                  OS.init({
                    appId: "aa21547a-4853-4ced-8823-6fd8c778b7b1",
                    allowLocalhostAsSecureOrigin: true,
                    serviceWorkerPath: "sw-notify.js",
                  }),
                  5000
                );
              } catch (initErr) {
                console.log("OneSignal init inside diagnostics caught error:", initErr);
              }
              windowObj.__onesignal_initialized = true;
            }

            // طلب إذن الإشعارات
            if (!OS.Notifications.permission) {
              const permissionResult = await withTimeout(OS.Notifications.requestPermission(), 10000);
              if (permissionResult === false && !OS.Notifications.permission) {
                throw new Error("permission_denied");
              }
            }

            // إجبار الهاتف على عرض الإشعار وتشغيل الصوت حتى لو كان التطبيق مفتوحاً في الواجهة
            try {
              OS.Notifications.addEventListener("foregroundWillDisplay", (event: any) => {
                console.log("OneSignal client: Foreground notification received. Forcing display!");
                event.preventDefault();
                event.notification.display();
              });
            } catch (err) {
              console.error("Failed to add foreground event listener:", err);
            }

            // تسجيل الدخول لحساب المندوب
            await withTimeout(OS.login(auth.c), 5000);
            resolve();
          } catch (err: any) {
            reject(err);
          }
        });
      });

      // إلغاء أي اشتراكات VAPID قديمة للمندوب لتفادي تداخل الإشعارات
      const cleanParams = new URLSearchParams();
      cleanParams.set("c", auth.c);
      if (auth.exp) cleanParams.set("exp", auth.exp);
      cleanParams.set("s", auth.s);
      await fetch(`/api/push/subscribe?${cleanParams.toString()}`, { method: "DELETE" }).catch(() => {});

      setIsActive(true);
      setErrorMsg(null);
    } catch (err: any) {
      console.error("Error activating notifications:", err);
      
      if (err?.message === "unsupported_browser") {
        setErrorMsg("عذراً، متصفحك لا يدعم نظام الإشعارات الفورية. يرجى استخدام متصفح حديث مثل Google Chrome.");
      } else if (err?.message === "permission_denied" || Notification.permission === "denied") {
        setErrorMsg(
          "تم رفض إذن الإشعارات! لتفعيل استقبال الطلبات:\n\n" +
          "📱 إذا كنت تستخدم التطبيق المثبت (على شاشة الهاتف الرئيسية):\n" +
          "1. اذهب إلى إعدادات الهاتف (Settings) ⚙️\n" +
          "2. اختر التطبيقات (Apps)\n" +
          "3. ابحث عن اسم تطبيقنا في القائمة واضغط عليه\n" +
          "4. اختر الإشعارات (Notifications) وفعل خيار السماح بالإشعارات (Allow/Show).\n\n" +
          "🌐 إذا كنت تفتح الموقع من متصفح الإنترنت:\n" +
          "اضغط على علامة القفل (🔒) أو خيارات الموقع بجانب رابط الموقع بالأعلى، ثم اختر سماح (Allow)."
        );
      } else if (err?.message === "onesignal_not_loaded") {
        setErrorMsg("فشل الاتصال بخدمة الإشعارات. تأكد من جودة اتصالك بالإنترنت ثم أعد المحاولة.");
      } else {
        setErrorMsg("حدث خطأ أثناء تفعيل الإشعارات. تأكد من إعطاء الصلاحيات وأعد المحاولة، وإذا تكرر الخطأ يرجى إبلاغ الإدارة.");
      }
      setIsActive(false);
    } finally {
      setLoading(false);
    }
  };

  const mainPortalUrl = `/mandoub?c=${auth.c}&s=${auth.s}${auth.exp ? `&exp=${auth.exp}` : ""}`;

  return (
    <div dir="rtl" lang="ar" className="kse-app-bg px-2 py-4 text-slate-800 min-h-screen flex flex-col items-center">
      <div className="w-full max-w-lg space-y-4">
        {/* زر الرجوع */}
        <div className="flex items-center justify-between">
          <Link
            href={mainPortalUrl}
            className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-black px-4 py-2.5 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <span>⬅️</span>
            <span>رجوع للوحة المندوب</span>
          </Link>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">المندوب: {courierName}</span>
        </div>

        {/* الكارت الرئيسي */}
        <div className="kse-glass-dark rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <span className="text-3xl">🔔</span>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">إعدادات الإشعارات الفورية</h2>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">تفعيل وربط حسابك لتلقي رنين الطلبات الجديدة فوراً</p>
            </div>
          </div>

          {/* حالة التفعيل الحالية */}
          <div>
            {isActive === true ? (
              <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-4 text-emerald-950 dark:text-emerald-300">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <span className="text-3xl block animate-bounce">🔔</span>
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-black text-emerald-900 dark:text-emerald-100">تم تفعيل الإشعارات بنجاح! خير على خير 👍</p>
                    <p className="text-xs font-semibold mt-1 leading-relaxed">
                      جهازك متصل بنظام الإشعارات الفورية وجاهز لاستقبال التنبيهات بالرنين عند إسناد أي طلب جديد إليك.
                    </p>
                  </div>
                </div>
              </div>
            ) : isActive === false ? (
              <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 p-4 text-rose-950 dark:text-rose-300">
                <div className="flex items-center gap-3">
                  <span className="text-3xl shrink-0">⚠️</span>
                  <div>
                    <p className="text-sm font-black text-rose-900 dark:text-rose-100">الإشعارات غير نشطة بعد</p>
                    <p className="text-xs font-semibold mt-1 leading-relaxed">
                      حساب المندوب غير مبرمج لتلقي الإشعارات الفورية على هذا الهاتف. يرجى الضغط على زر التفعيل أدناه للربط.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex items-center justify-center gap-3 text-slate-500">
                <svg className="animate-spin h-5 w-5 text-violet-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-xs font-bold">جاري التحقق من إعدادات الربط والإذن...</span>
              </div>
            )}
          </div>

          {/* رسائل الأخطاء */}
          {errorMsg && (
            <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 p-4 text-rose-800 dark:text-rose-300 text-xs font-bold leading-relaxed whitespace-pre-line shadow-inner">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* أزرار الإجراء */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleActivate}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black px-6 py-4 shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 text-sm cursor-pointer"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>جاري التنشيط والربط الآن...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>{isActive === true ? "إعادة ربط وتحديث استقبال الإشعارات" : "تفعيل واستقبال الإشعارات الآن"}</span>
                </>
              )}
            </button>

            {/* نصائح حل مشكلة التأخير والتعليق */}
            <div className="rounded-2xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 p-4 text-xs leading-normal space-y-2.5">
              <span className="font-bold text-blue-900 dark:text-blue-300 block flex items-center gap-1.5 text-sm">
                <span>💡</span>
                <span>تعليمات هامة لحل مشاكل التأخر والتعليق:</span>
              </span>

              <div className="space-y-1">
                <p className="text-slate-700 dark:text-slate-200 font-bold">1️⃣ لمنع تأخر الإشعارات عند إغلاق التطبيق (تأخير 20 ثانية أو أكثر):</p>
                <p className="text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mt-0.5">
                  يقوم نظام أندرويد بتقييد عمل التطبيقات في الخلفية لتوفير البطارية. يرجى إلغاء التقييد لتطبيق "التوصيل" كالتالي:
                </p>
                <ol className="list-decimal list-inside pr-1.5 mt-1 space-y-1 text-slate-500 dark:text-slate-400 font-medium">
                  <li>اذهب إلى إعدادات الهاتف ⚙️ ⬅️ التطبيقات (Apps).</li>
                  <li>ابحث عن تطبيق <span className="font-bold text-slate-800 dark:text-slate-100">"التوصيل"</span> واضغط عليه.</li>
                  <li>اضغط على خيار <span className="font-bold text-slate-800 dark:text-slate-100">"البطارية" (Battery)</span>.</li>
                  <li>غيّر الإعداد من "محسن" (Optimized) إلى <span className="font-bold text-rose-600 dark:text-rose-400">"غير مقيد" (Unrestricted)</span>.</li>
                </ol>
              </div>

              <div className="border-t border-blue-100/50 dark:border-blue-900/30 pt-2.5 space-y-1">
                <p className="text-slate-700 dark:text-slate-200 font-bold">2️⃣ لضمان استقبال الإشعارات حتى أثناء فتح واستخدام التطبيق:</p>
                <p className="text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mt-0.5">
                  بمجرد تفعيل الإشعارات بالزر أعلاه، تم برمجة التطبيق لكي يجبر الهاتف على إصدار صوت الرنين وإظهار إشعار جديد حتى لو كنت تتصفح التطبيق في نفس اللحظة.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
