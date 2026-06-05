"use client";

import { useEffect, useState, useRef } from "react";
import { subscribeDeviceToWebPush } from "@/lib/web-push-client";
import { ensureNotificationAudioContext } from "@/lib/notification-sound-client";

type Auth = { c: string; exp?: string; s: string };

export function MandoubNotificationsDiagnostics({ auth }: { auth: Auth }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [systemSupported, setSystemSupported] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>("default");
  
  // حالات ون سيجنال
  const [oneSignalLoaded, setOneSignalLoaded] = useState(false);
  const [oneSignalPermission, setOneSignalPermission] = useState<string>("unknown");
  const [oneSignalExternalId, setOneSignalExternalId] = useState<string | null>(null);
  
  // حالة السيرفر
  const [serverRegisteredCount, setServerRegisteredCount] = useState<number | null>(null);
  const [audioContextStatus, setAudioContextStatus] = useState<string>("unknown");

  const runCheck = async () => {
    if (typeof window === "undefined") return;

    // 1. دعم النظام
    const supported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
    setSystemSupported(supported);

    // 2. إذن المتصفح
    setBrowserPermission(supported ? Notification.permission : "default");

    // 3. حالة الصوت
    try {
      const ctx = ensureNotificationAudioContext();
      setAudioContextStatus(ctx ? ctx.state : "unsupported");
    } catch {
      setAudioContextStatus("error");
    }

    // 4. فحص ون سيجنال
    const OneSignal = (window as any).OneSignal;
    if (OneSignal) {
      setOneSignalLoaded(true);
      setOneSignalPermission(OneSignal.Notifications.permission ? "granted" : "default");
      try {
        if (OneSignal.initialized) {
          const extId = await OneSignal.User.getExternalId();
          setOneSignalExternalId(extId || null);
        }
      } catch (err) {
        console.error("Error reading OneSignal External ID:", err);
      }
    } else {
      setOneSignalLoaded(false);
    }

    // 5. استعلام حالة السيرفر (عدد الأجهزة)
    try {
      const q = new URLSearchParams();
      q.set("c", auth.c);
      if (auth.exp) q.set("exp", auth.exp);
      q.set("s", auth.s);
      const res = await fetch(`/api/notifications/mandoub-assigned?${q.toString()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setServerRegisteredCount(data.registeredDevicesCount ?? 0);
      }
    } catch {
      // تجاهل أخطاء الشبكة
    }
  };

  useEffect(() => {
    void runCheck();
    // فحص دوري كل 10 ثوانٍ للتحديث التلقائي إذا غيّر المستخدم الأذونات
    const id = window.setInterval(runCheck, 10000);
    return () => window.clearInterval(id);
  }, [auth.c, auth.exp, auth.s]);

  const handleFix = async () => {
    setLoading(true);
    try {
      // أ. تنشيط الصوت
      const audioCtx = ensureNotificationAudioContext();
      if (audioCtx) {
        await audioCtx.resume().catch(() => {});
      }

      // ب. طلب إذن المتصفح وإعادة الاشتراك في VAPID
      if (typeof window !== "undefined" && "Notification" in window) {
        const permission = await Notification.requestPermission();
        setBrowserPermission(permission);
        if (permission === "granted") {
          await subscribeDeviceToWebPush({
            audience: "mandoub",
            mandoub: { c: auth.c, exp: auth.exp, s: auth.s },
          });
        }
      }

      // ج. طلب إذن ون سيجنال وتسجيل الدخول مجدداً
      const OneSignal = (window as any).OneSignal;
      if (OneSignal) {
        try {
          await OneSignal.Notifications.requestPermission();
          if (OneSignal.initialized) {
            await OneSignal.login(auth.c);
          }
        } catch (err) {
          console.error("OneSignal setup error during fix:", err);
        }
      }

      // د. إعادة الفحص
      await runCheck();
    } catch (e) {
      console.error("Error fixing notifications:", e);
    } finally {
      setLoading(false);
    }
  };

  const isEverythingOk = 
    systemSupported && 
    browserPermission === "granted" && 
    (serverRegisteredCount !== null && serverRegisteredCount > 0) &&
    audioContextStatus === "running";

  return (
    <div className="mb-4 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden text-slate-800">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100/80 transition font-bold text-sm"
      >
        <div className="flex items-center gap-2">
          <span>🛡️</span>
          <span>فحص حالة إشعارات المتصفح والويب</span>
          {isEverythingOk ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700 border border-emerald-200">
              ✅ جاهز ومفعل
            </span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-800 border border-amber-200 animate-pulse">
              ⚠️ يحتاج انتباه
            </span>
          )}
        </div>
        <span className="text-xs text-slate-500">{isOpen ? "إخفاء التفاصيل ▲" : "عرض التفاصيل ⚙️ ▼"}</span>
      </button>

      {isOpen && (
        <div className="p-4 border-t border-slate-100 bg-white space-y-3.5 text-xs sm:text-sm animate-in fade-in duration-200">
          <p className="text-xs text-slate-500 font-bold leading-normal">
            هذا الفحص يتأكد من تفعيل الأذونات والاتصال بخوادم الإشعارات لضمان وصول أصوات وتنبيهات الطلبات الجديدة فوراً.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. دعم المتصفح */}
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="font-bold">دعم المتصفح للإشعارات:</span>
              <span>{systemSupported ? "✅ مدعوم" : "❌ غير مدعوم في هذا المتصفح"}</span>
            </div>

            {/* 2. إذن المتصفح */}
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="font-bold">إذن إشعارات المتصفح:</span>
              <span>
                {browserPermission === "granted" && "✅ مسموح به"}
                {browserPermission === "denied" && "❌ محظور (Denied)"}
                {browserPermission === "default" && "⚠️ غير مفعل"}
              </span>
            </div>

            {/* 3. حالة الصوت */}
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="font-bold">حالة تشغيل الصوت والتنبيه:</span>
              <span>
                {audioContextStatus === "running" && "✅ جاهز ومفعل"}
                {audioContextStatus === "suspended" && "⚠️ صامت (يحتاج تفاعل)"}
                {audioContextStatus !== "running" && audioContextStatus !== "suspended" && "⚠️ غير جاهز"}
              </span>
            </div>

            {/* 4. التسجيل في السيرفر */}
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="font-bold">الأجهزة المسجلة في السيرفر:</span>
              <span>
                {serverRegisteredCount === null && "⏳ جاري الفحص..."}
                {serverRegisteredCount !== null && serverRegisteredCount > 0 && `✅ ${serverRegisteredCount} جهاز مفعل`}
                {serverRegisteredCount !== null && serverRegisteredCount === 0 && "❌ لا يوجد اشتراك"}
              </span>
            </div>

            {/* 5. ون سيجنال */}
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 sm:col-span-2">
              <span className="font-bold">رابط مساعد ون سيجنال (OneSignal):</span>
              <div className="flex flex-col items-end gap-0.5">
                <span>
                  {!oneSignalLoaded && "❌ لم يتم التحميل"}
                  {oneSignalLoaded && `✅ جاهز (معرف: ${oneSignalExternalId || "غير معروف"})`}
                </span>
                {oneSignalLoaded && oneSignalExternalId !== auth.c && (
                  <span className="text-[10px] text-amber-700 font-bold">⚠️ معرف المندوب غير متطابق</span>
                )}
              </div>
            </div>
          </div>

          {/* نصائح لحل المشكلة */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 text-xs leading-normal">
            <span className="font-bold text-amber-900 block mb-1">💡 نصائح لضمان عمل الإشعارات:</span>
            <ul className="list-disc list-inside space-y-1 text-slate-700 font-medium">
              {browserPermission === "denied" && (
                <li className="text-rose-700 font-bold">
                  لقد قمت بحظر الإشعارات مسبقاً. يرجى الضغط على علامة القفل (🔒) الموجودة بجانب رابط الموقع في شريط العنوان بالأعلى، ثم تغيير الإذن إلى "سماح" أو "Allow".
                </li>
              )}
              {audioContextStatus === "suspended" && (
                <li>
                  يطلب المتصفح نقرة واحدة على الشاشة لتفعيل الصوت. اضغط على أي مكان في الصفحة أو انقر على زر الإصلاح أدناه.
                </li>
              )}
              {(!oneSignalLoaded || (serverRegisteredCount !== null && serverRegisteredCount === 0)) && (
                <li>
                  يرجى الضغط على زر "إصلاح وتفعيل الإشعارات" لتثبيت التنبيهات في خوادم الموقع.
                </li>
              )}
              <li>
                لضمان استمرار الإشعارات عند إغلاق المتصفح، تأكد من تثبيت الموقع كتطبيق (PWA) من خيارات المتصفح (اضغط "إضافة إلى الشاشة الرئيسية").
              </li>
            </ul>
          </div>

          {/* زر الإصلاح */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleFix}
              disabled={loading}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black px-5 py-2.5 shadow-md hover:shadow-lg transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>جاري الإصلاح...</span>
                </>
              ) : (
                <>
                  <span>🔧</span>
                  <span>إصلاح وتفعيل الإشعارات الآن</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
