"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/** يحدّث الرابط بعد توقف الكتابة قليلاً لإعادة جلب الصفحة */
export function OrderTrackingSearch({
  initialQ,
  statusFilter,
  wardFilter = "lower",
  saderFilter = "higher",
}: {
  initialQ: string;
  statusFilter: string;
  wardFilter?: "lower" | "higher";
  saderFilter?: "lower" | "higher";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qFromUrl = searchParams.get("q") ?? "";
  const [value, setValue] = useState(initialQ);

  const pushQuery = useCallback(
    (q: string) => {
      const p = new URLSearchParams();
      if (statusFilter !== "all") p.set("status", statusFilter);
      if (statusFilter === "checkWard" && wardFilter === "higher") {
        p.set("wardFilter", "higher");
      }
      if (statusFilter === "checkSader" && saderFilter === "lower") {
        p.set("saderFilter", "lower");
      }
      const t = q.trim();
      if (t) p.set("q", t);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, statusFilter, wardFilter, saderFilter],
  );

  useEffect(() => {
    const trimmed = value.trim();
    const current = qFromUrl.trim();
    if (trimmed === current) return;

    const id = window.setTimeout(() => {
      pushQuery(value);
    }, 400);
    return () => window.clearTimeout(id);
  }, [value, qFromUrl, pushQuery]);

  return (
    <div className="relative flex-1 w-full" dir="rtl">
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute right-3.5 text-xs text-[#C9A86A]">
          🔍
        </span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ابحث برقم الطلب، اسم المحل، المندوب، المنطقة، الهاتف…"
          className="h-10 sm:h-10.5 w-full rounded-2xl border-2 border-[#C9A86A]/70 bg-white pr-9 pl-9 text-xs sm:text-sm font-black text-[#0A3D2E] placeholder:text-slate-400 placeholder:font-bold shadow-xs outline-none transition-all focus:border-[#C9A86A] focus:ring-2 focus:ring-[#C9A86A]/30"
          autoComplete="off"
          type="search"
          enterKeyHint="search"
          aria-label="بحث في الطلبات"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              pushQuery("");
            }}
            className="absolute left-3 flex size-5 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-700 text-xs font-bold transition"
            title="مسح البحث"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
