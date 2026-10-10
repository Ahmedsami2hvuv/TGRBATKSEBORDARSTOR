"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Search, X } from "lucide-react";

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
        <span className="pointer-events-none absolute right-3.5 text-[#0B2E8C]">
          <Search className="w-4 h-4 text-[#0B2E8C]/70" />
        </span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ابحث برقم الطلب، اسم المحل، المندوب، المنطقة، الهاتف…"
          className="h-10 sm:h-10.5 w-full rounded-2xl border-2 border-[#D0DDFB] bg-white pr-9 pl-9 text-xs sm:text-sm font-black text-[#0B2E8C] placeholder:text-slate-400 placeholder:font-bold shadow-xs outline-none transition-all focus:border-[#0B2E8C] focus:ring-2 focus:ring-[#0B2E8C]/20"
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
            className="absolute left-3 flex size-5 items-center justify-center rounded-full bg-[#E8EEFF] text-[#0B2E8C] hover:bg-[#D0DDFB] transition cursor-pointer"
            title="مسح البحث"
          >
            <X className="w-3 h-3 stroke-[2.5]" />
          </button>
        )}
      </div>
    </div>
  );
}
