"use client";

import { useEffect, useState, useTransition } from "react";
import { RefreshCw, WifiOff, AlertCircle } from "lucide-react";

export default function ClientOrderError({
  error,
  reset,
}: {
  error: { message?: string; digest?: string };
  reset: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [countdown, setCountdown] = useState<number>(4);
  const [autoRetrying, setAutoRetrying] = useState<boolean>(true);

  const rawMsg = (error?.message || "").toLowerCase();
  const isNetworkIssue =
    rawMsg.includes("fetch") ||
    rawMsg.includes("network") ||
    rawMsg.includes("failed") ||
    rawMsg.includes("timeout") ||
    (typeof navigator !== "undefined" && !navigator.onLine);

  const handleRetry = () => {
    startTransition(() => {
      reset();
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      handleRetry();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  useEffect(() => {
    if (!autoRetrying || !isNetworkIssue) return;

    if (countdown <= 0) {
      handleRetry();
      setAutoRetrying(false);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, autoRetrying, isNetworkIssue]);

  return (
    <div dir="rtl" className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-white border border-[#D0DDFB] p-6 sm:p-8 shadow-xl shadow-blue-900/5 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[#EEF3FF] border border-[#D0DDFB] flex items-center justify-center text-[#0B2E8C] mb-5 shadow-xs">
          {isNetworkIssue ? (
            <WifiOff className="w-8 h-8 animate-pulse text-[#0B2E8C]" />
          ) : (
            <AlertCircle className="w-8 h-8 text-amber-500" />
          )}
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-slate-800 mb-2">
          {isNetworkIssue ? "انقطاع مؤقت في الاتصال" : "تعذّر تحميل صفحة الطلب"}
        </h1>

        <p className="text-sm text-slate-600 leading-relaxed mb-6 font-medium">
          {isNetworkIssue
            ? "يبدو أن اتصال الإنترنت في هاتفك انقطع أو حدث بطء مؤقت في الشبكة. سيتم استعادة الاتصال تلقائياً."
            : "حدث تعذر مؤقت أثناء تحميل بيانات الطلب. يرجى إعادة المحاولة للمتابعة."}
        </p>

        {isNetworkIssue && autoRetrying && countdown > 0 && (
          <div className="mb-6 rounded-2xl bg-blue-50 border border-blue-200/80 p-3 text-xs font-bold text-blue-900 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
              جاري إعادة المحاولة تلقائياً...
            </span>
            <span className="bg-white px-2 py-0.5 rounded-lg border border-blue-200 shadow-xs font-mono font-black text-[#0B2E8C]">
              {countdown} ثانية
            </span>
          </div>
        )}

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isPending}
            className="w-full rounded-2xl bg-[#0B2E8C] hover:bg-[#082269] active:scale-[0.98] py-3.5 px-5 text-sm font-black text-white shadow-lg shadow-blue-900/10 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
            <span>{isPending ? "جاري إعادة الاتصال..." : "إعادة المحاولة الآن"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            className="w-full rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] py-3 px-5 text-sm font-bold text-slate-700 transition-all cursor-pointer"
          >
            تحديث الصفحة
          </button>
        </div>

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
