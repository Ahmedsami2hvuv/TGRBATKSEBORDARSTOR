"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // سجل الخطأ في الكونسول للمساعدة في التشخيص
    console.error("Preparer Preparation Error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-6 text-center">
      <div className="mb-6 rounded-full bg-rose-100 p-4 dark:bg-rose-900/20">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-12 w-12 text-rose-600"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
          />
        </svg>
      </div>

      <h2 className="text-2xl font-black text-slate-900 dark:text-white">
        حدث خطأ غير متوقع في صفحة التجهيز
      </h2>

      <div className="mt-4 max-w-md rounded-xl bg-rose-50 p-4 text-right border border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/20">
        <p className="text-sm font-bold text-rose-800 dark:text-rose-400">
          تفاصيل الخطأ:
        </p>
        <p className="mt-1 font-mono text-xs text-rose-700 break-all dark:text-rose-300">
          {error.message || "لا توجد رسالة خطأ محددة"}
        </p>
        {error.digest && (
          <p className="mt-2 text-[10px] text-rose-500">
            Digest ID: {error.digest}
          </p>
        )}
      </div>

      <div className="mt-8 flex gap-4">
        <button
          onClick={() => reset()}
          className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-violet-200 transition-all hover:bg-violet-700 active:scale-95 dark:shadow-none"
        >
          إعادة المحاولة 🔄
        </button>

        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-slate-200 px-6 py-3 text-sm font-black text-slate-700 transition-all hover:bg-slate-300 active:scale-95 dark:bg-slate-800 dark:text-slate-200"
        >
          تحديث الصفحة ↻
        </button>
      </div>

      <p className="mt-8 text-xs text-slate-500">
        إذا استمر الخطأ، يرجى تزويدنا بـ Digest ID المكتوب أعلاه.
      </p>
    </div>
  );
}
