"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: { message?: string; digest?: string };
  reset: () => void;
}) {
  // ملاحظة: نُتعمد عدم عرض `error.digest` حتى لا تظهر الكتابات العشوائية للمستخدم.
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-6 shadow-sm">
          <div className="text-xl font-bold text-rose-800">حدث خطأ غير متوقع</div>
          <p className="mt-2 text-sm text-slate-600">
            من فضلك جرّب مرة أخرى. إذا استمرت المشكلة، أخبرنا بالوصف الظاهر لديك.
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-sky-200/80 ring-1 ring-sky-400/30 transition hover:from-sky-700 hover:to-cyan-700"
            >
              إعادة المحاولة
            </button>
          </div>

          {error?.message ? (
            <p className="mt-4 text-xs text-slate-500 font-mono break-words">{error.message}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

