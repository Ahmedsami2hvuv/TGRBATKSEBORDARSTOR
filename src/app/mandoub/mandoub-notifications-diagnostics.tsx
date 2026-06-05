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
      if (OneSignal.Notifications.permission !== "granted") {
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
    setIsActive(false);
  };

  useEffect(() => {
    void checkStatus();
    // فحص دوري خفيف للتحديث التلقائي إذا تغيرت الأذونات
    const id = window.setInterval(checkStatus, 5000);
    return () => window.clearInterval(id);
  }, [auth.c]);

  const handleActivate = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. فحص دعم المتصفح
      if (typeof window === "undefined") return;
      if (!("Notification" in window)) {
        throw new Error("unsupported_browser");
      }

      // 2. إذا كان الإذن محظوراً بالكامل
      if (Notification.permission === "denied") {
        throw new Error("permission_denied");
      }

      // 3. تنشيط الصوت والـ Audio Context لتخطي قيود التشغيل التلقائي للمتصفحات
      const audioCtx = ensureNotificationAudioContext();
      if (audioCtx) {
        await audioCtx.resume().catch(() => {});
      }

      // 4. تهيئة وطلب إذن OneSignal
      const windowObj = window as any;
      const OneSignal = windowObj.OneSignal;

      if (!OneSignal) {
        throw new Error("onesignal_not_loaded");
      }

      windowObj.OneSignalDeferred = windowObj.OneSignalDeferred || [];
      
      await new Promise<void>((resolve, reject) => {
        windowObj.OneSignalDeferred.push(async (OS: any) => {
          try {
            // تهيئة ون سيجنال إذا لم يكن مهيأً
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
            if (OS.Notifications.permission !== "granted") {
              const permissionResult = await withTimeout(OS.Notifications.requestPermission(), 10000);
              if (permissionResult === "denied" || OS.Notifications.permission !== "granted") {
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

      // 5. إلغاء أي اشتراكات VAPID قديمة للمندوب لتفادي تداخل الإشعارات
      const cleanParams = new URLSearchParams();
      cleanParams.set("c", auth.c);
      if (auth.exp) cleanParams.set("exp", auth.exp);
      cleanParams.set("s", auth.s);
      await fetch(`/api/push/subscribe?${cleanParams.toString()}`, { method: "DELETE" }).catch(() => {});

      // نجاح التفعيل
      setIsActive(true);
      setErrorMsg(null);
    } catch (err: any) {
      console.error("Error activating notifications:", err);
      
      // ترجمة وتوضيح المشاكل للمندوب
      if (err?.message === "unsupported_browser") {
        setErrorMsg("عذراً، متصفحك لا يدعم نظام الإشعارات الفورية. يرجى استخدام متصفح حديث مثل Google Chrome.");
      } else if (err?.message === "permission_denied" || Notification.permission === "denied") {
        setErrorMsg("تم رفض إذن الإشعارات! يرجى الضغط على القفل (🔒) بجانب رابط الموقع بالأعلى، وتغيير إذن الإشعارات إلى 'سماح' (Allow).");
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

  if (isActive === null) {
    return (
      <div className="mb-4 rounded-2xl bg-white border border-slate-200 p-4 shadow-sm flex items-center justify-center py-6">
        <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
          <svg className="animate-spin h-5 w-5 text-violet-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>جاري التحقق من حالة الإشعارات...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      {isActive ? (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-950 shadow-sm transition-all duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="text-2xl animate-bounce block">🔔</span>
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              </div>
              <div>
                <p className="text-sm font-black text-emerald-900">تم تفعيل الإشعارات بنجاح! خير على خير 👍</p>
                <p className="text-xs font-semibold text-emerald-800 opacity-90 mt-0.5">
                  حسابك مرتبط الآن بشكل صحيح وستتلقى تنبيهات الطلبات بصوت الرنين فور إسنادها إليك.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleActivate}
              disabled={loading}
              className="shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 transition disabled:opacity-50"
            >
              {loading ? "جاري التحديث..." : "إعادة ربط وتحديث"}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3.5 text-slate-800 transition-all duration-300">
          <div className="flex items-center gap-2.5 font-black text-slate-800">
            <span className="text-lg">🔔</span>
            <span>تفعيل الإشعارات الفورية للطلبات</span>
          </div>

          <p className="text-xs font-semibold text-slate-500 leading-relaxed">
            لتجنب فوات أي طلبات ولتلقي صوت التنبيه الفوري بمجرد إسناد طلب جديد إليك، يرجى تفعيل الإشعارات الآن.
          </p>

          {errorMsg && (
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-rose-800 text-xs font-bold leading-relaxed">
              ⚠️ {errorMsg}
            </div>
          )}

          <button
            type="button"
            onClick={handleActivate}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black px-5 py-3 shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>جاري التفعيل والربط الآن...</span>
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>تفعيل واستقبال الإشعارات</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
