"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

/**
 * يقرأ `?loc=cleared|saved` بعد نجاح مسح/حفظ اللوكيشن (تنقّل عميلي) ويعرض رسالة نجاح.
 * لا نستدعي `router.refresh()` هنا — كان يسبب طلبات مزدوجة وتعليقاً على بعض الأجهزة.
 */
export function MandoubLocFlashBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const loc = searchParams.get("loc");

  const dismiss = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("loc");
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (loc !== "cleared" && loc !== "saved") return;
    const id = window.setTimeout(dismiss, 12000);
    return () => window.clearTimeout(id);
  }, [loc, dismiss]);

  if (loc !== "cleared" && loc !== "saved") return null;

  const msg =
    loc === "cleared"
      ? "تم مسح موقع الزبون من الطلب."
      : "تم حفظ موقعك كلوكيشن للزبون بنجاح.";

  return (
    <div
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-400/90 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-950 shadow-sm"
      dir="rtl"
      role="status"
      aria-live="polite"
    >
      <p className="min-w-0 flex-1 leading-relaxed">{msg}</p>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-lg border border-emerald-600/40 bg-white px-3 py-1.5 text-xs font-black text-emerald-900 shadow-sm hover:bg-emerald-100"
      >
        حسناً
      </button>
    </div>
  );
}
