"use client";

import React, { useEffect } from "react";
import { RefreshCw, AlertTriangle, Home } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError Boundary Log]:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center dir-rtl">
      <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mb-4 shadow-sm animate-pulse">
        <AlertTriangle className="w-8 h-8 text-amber-600" />
      </div>

      <h2 className="text-xl font-bold text-slate-800 mb-2">
        حدث استثناء مؤقت في الاتصال بالسيرفر
      </h2>

      <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
        حدث بطء مؤقت في استجابة قاعدة البيانات (Supabase Pooler). لا تقلق، تم تأمين بياناتك بالكامل ويمكنك إعادة المحاولة بنقرة واحدة.
      </p>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all active:scale-95"
        >
          <RefreshCw className="w-4 h-4 animate-spin-slow" />
          إعادة المحاولة المباشرة
        </button>

        <Link
          href="/abo1stor3hlaa2kbr8-47"
          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm flex items-center gap-2 transition-all active:scale-95"
        >
          <Home className="w-4 h-4" />
          الرئيسية
        </Link>
      </div>

      {error?.digest && (
        <span className="mt-6 text-[10px] text-slate-400 font-mono">
          معرف التشخيص: {error.digest}
        </span>
      )}
    </div>
  );
}
