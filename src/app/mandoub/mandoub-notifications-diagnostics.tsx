"use client";

import { useEffect, useState } from "react";
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

export function MandoubNotificationsDiagnostics({ auth }: { auth: Auth }) {
  const [loading, setLoading] = useState(false);
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState(false);

  const checkStatus = async () => {
    if (typeof window === "undefined") return;

    // 1. فحص الدعم
    const supported = "Notification" in window;
    if (!supported) {
      setIsActive(false);
      return;
    }

    // 2. فحص الإذن
    if (Notification.permission !== "granted") {
      setIsActive(false);
      return;
    }

    // 3. فحص ون سيجنال
    const OneSignal = (window as any).OneSignal;
    if (OneSignal) {
      if (!OneSignal.Notifications.permission) {
        setIsActive(false);
        return;
      }
      try {
        if (OneSignal.User && typeof OneSignal.User.getExternalId === "function") {
          const extId = await withTimeout(OneSignal.User.getExternalId(), 3000);
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
    // لا نقوم بفرض القيمة خطأ فوراً إذا كان التطبيق قيد التحميل لأول مرة
    if (isActive === null) {
      setIsActive(false);
    }
  };

  useEffect(() => {
    // تشغيل الفحص الأولي بعد تحميل الصفحة
    const timer = setTimeout(checkStatus, 2000);
    return () => clearTimeout(timer);
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

  return (
    <>
      {/* جرس الإشعارات في الهيدر */}
      <button
        type="button"
        onClick={() => {
          setOpenModal(true);
          void checkStatus();
        }}
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
        title="إعدادات الإشعارات"
      >
        <span className="text-lg">🔔</span>
        {/* نقطة الحالة الدائرية */}
        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
          {isActive === true ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white dark:border-slate-900" title="مفعلة ونشطة"></span>
            </>
          ) : isActive === false ? (
            <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 border-2 border-white dark:border-slate-900" title="غير مفعلة"></span>
          ) : (
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-white dark:border-slate-900 animate-pulse" title="جاري الفحص..."></span>
          )}
        </span>
      </button>

      {/* نافذة الإعدادات المنبثقة (Modal) */}
      {openModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300">
          {/* خلفية للإغلاق عند الضغط بالخارج */}
          <div className="absolute inset-0" onClick={() => setOpenModal(false)} />

          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-800 dark:text-slate-100 z-10 animate-in fade-in zoom-in-95 duration-200">
            {/* الهيدر */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5 mb-4">
              <h3 className="text-base font-black flex items-center gap-2">
                <span>🔔</span>
                <span>إعدادات وحالة الإشعارات الفورية</span>
              </h3>
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-lg p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            {/* حالة الإشعارات الحالية */}
            <div className="mb-4">
              {isActive === true ? (
                <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-4 text-emerald-950 dark:text-emerald-300">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🟢</span>
                    <div>
                      <p className="text-sm font-black text-emerald-900 dark:text-emerald-100">تم تفعيل الإشعارات بنجاح! خير على خير 👍</p>
                      <p className="text-xs font-semibold mt-0.5 opacity-90">
                        حسابك مرتبطان وجاهز لتلقي إشعارات الطلبات فوراً بصوت الرنين.
                      </p>
                    </div>
                  </div>
                </div>
              ) : isActive === false ? (
                <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 p-4 text-rose-950 dark:text-rose-300">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🔴</span>
                    <div>
                      <p className="text-sm font-black text-rose-900 dark:text-rose-100">الإشعارات غير مفعلة</p>
                      <p className="text-xs font-semibold mt-0.5 opacity-90">
                        الرجاء الضغط على زر التفعيل بالأسفل لتلقي تنبيهات الطلبات الفورية.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-4 text-amber-950 dark:text-amber-300 flex items-center gap-3">
                  <svg className="animate-spin h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-xs font-bold">جاري التحقق من الإعدادات والربط...</span>
                </div>
              )}
            </div>

            {/* الأخطاء إن وجدت */}
            {errorMsg && (
              <div className="mb-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 p-4 text-rose-800 dark:text-rose-300 text-xs font-bold leading-relaxed whitespace-pre-line">
                ⚠️ {errorMsg}
              </div>
            )}

            {/* تفعيل / إعادة ربط */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleActivate}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black px-5 py-3 shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 text-sm cursor-pointer"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>جاري التفعيل والربط الآن...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>{isActive === true ? "إعادة ربط وتحديث الإشعارات" : "تفعيل واستقبال الإشعارات الفورية"}</span>
                  </>
                )}
              </button>

              {/* نصيحة هامة جداً لحل مشكلة تأخير 20 ثانية بالتطبيق المثبت */}
              <div className="rounded-2xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 p-4 text-xs leading-normal">
                <span className="font-bold text-blue-900 dark:text-blue-300 block mb-1.5 flex items-center gap-1.5">
                  <span>💡</span>
                  <span>تنبيه هام جداً لمنع تأخر الإشعارات (للأندرويد):</span>
                </span>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-semibold">
                  إذا كنت تستقبل الإشعارات متأخرة عند إغلاق التطبيق (بعد 20 ثانية أو أكثر)، يرجى تعطيل تحسين البطارية للتطبيق:
                </p>
                <ol className="list-decimal list-inside mt-2 space-y-1.5 text-slate-500 dark:text-slate-400 font-medium text-[11px]">
                  <li>اذهب إلى إعدادات الهاتف ⚙️ ⬅️ التطبيقات (Apps).</li>
                  <li>ابحث عن تطبيق <span className="font-bold text-slate-800 dark:text-slate-100">"التوصيل"</span> واضغط عليه.</li>
                  <li>اضغط على خيار <span className="font-bold text-slate-800 dark:text-slate-100">"البطارية" (Battery)</span>.</li>
                  <li>غيّر الإعداد من "محسن" (Optimized) إلى <span className="font-bold text-rose-600 dark:text-rose-400">"غير مقيد" (Unrestricted)</span>.</li>
                </ol>
              </div>
            </div>

            {/* زر الإغلاق */}
            <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs px-4 py-2 transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
