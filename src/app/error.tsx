"use client";

import { useEffect, useState, useTransition } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: { message?: string; digest?: string };
  reset: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [countdown, setCountdown] = useState<number>(5);
  const [isAutoRetrying, setIsAutoRetrying] = useState<boolean>(true);

  const rawMsg = (error?.message || "").toLowerCase();
  const isNetworkIssue =
    rawMsg.includes("fetch") ||
    rawMsg.includes("network") ||
    rawMsg.includes("timeout") ||
    rawMsg.includes("failed") ||
    rawMsg.includes("load") ||
    (typeof navigator !== "undefined" && !navigator.onLine);

  const handleRetry = () => {
    startTransition(() => {
      reset();
    });
  };

  const handleFullReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  // إعادة المحاولة فور عودة اتصال الإنترنت في هاتف المستخدم
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      handleRetry();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  // عداد تنازلي للمحاولة التلقائية في حال انقطاع الشبكة
  useEffect(() => {
    if (!isAutoRetrying || !isNetworkIssue) return;

    if (countdown <= 0) {
      handleRetry();
      setIsAutoRetrying(false);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, isAutoRetrying, isNetworkIssue]);

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 flex items-center justify-center p-4 selection:bg-blue-100">
      <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200/80 p-6 md:p-8 shadow-xl shadow-slate-200/50 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* الأيقونة */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-5 shadow-sm">
          {isNetworkIssue ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8 animate-pulse text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8 text-rose-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          )}
        </div>

        {/* العناوين */}
        <h1 className="text-xl md:text-2xl font-black text-slate-800 mb-2">
          {isNetworkIssue ? "ضعف مؤقت في الاتصال" : "حدث تعذر مؤقت في التحميل"}
        </h1>

        <p className="text-sm text-slate-600 leading-relaxed mb-6 font-medium">
          {isNetworkIssue
            ? "يبدو أن اتصال الإنترنت غير مستقر حالياً أو تأخر السيرفر في الرد. لا تقلق، سيتم استرجاع الصفحة تلقائياً."
            : "حدث خطأ غير متوقع أثناء معالجة الطلب. يرجى الضغط على إعادة المحاولة للمتابعة."}
        </p>

        {/* شريط المحاولة التلقائية */}
        {isNetworkIssue && isAutoRetrying && countdown > 0 && (
          <div className="mb-6 rounded-2xl bg-amber-50/80 border border-amber-200/80 p-3 text-xs font-bold text-amber-800 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
              جاري إعادة المحاولة تلقائياً...
            </span>
            <span className="bg-white px-2 py-0.5 rounded-lg border border-amber-200 shadow-xs font-mono font-black text-amber-700">
              {countdown} ثانية
            </span>
          </div>
        )}

        {/* أزرار الإجراءات */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isPending}
            className="w-full rounded-2xl bg-[#0B2E8C] hover:bg-[#082269] active:scale-[0.98] py-3.5 px-5 text-sm font-black text-white shadow-lg shadow-blue-900/10 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {isPending ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>جاري الاتصال...</span>
              </>
            ) : (
              <span>إعادة المحاولة الآن</span>
            )}
          </button>

          <button
            type="button"
            onClick={handleFullReload}
            className="w-full rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] py-3 px-5 text-sm font-bold text-slate-700 transition-all cursor-pointer"
          >
            تحديث الصفحة بالكامل
          </button>
        </div>

        {/* تفاصيل فنية مصغرة للمساعدة */}
        {error?.message ? (
          <div className="mt-6 pt-4 border-t border-slate-100">
            <p className="text-[11px] text-slate-400 font-mono break-words leading-tight" dir="ltr">
              {error.message}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
