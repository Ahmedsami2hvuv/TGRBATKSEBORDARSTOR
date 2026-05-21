"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ad } from "@/lib/admin-ui";

/** يحدّث الرابط بعد توقف الكتابة قليلاً لإعادة جلب الصفحة */
export function OrderTrackingSearch({
  initialQ,
  statusFilter,
  wardFilter = "lower",
}: {
  initialQ: string;
  statusFilter: string;
  /** يُستخدم مع status=checkWard: أقل من المتوقع | أعلى من المتوقع */
  wardFilter?: "lower" | "higher";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qFromUrl = searchParams.get("q") ?? "";
  const [value, setValue] = useState(initialQ);

  useEffect(() => {
    setValue(qFromUrl);
  }, [qFromUrl]);

  const pushQuery = useCallback(
    (q: string) => {
      const p = new URLSearchParams();
      if (statusFilter !== "all") p.set("status", statusFilter);
      if (statusFilter === "checkWard" && wardFilter === "higher") {
        p.set("wardFilter", "higher");
      }
      const t = q.trim();
      if (t) p.set("q", t);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, statusFilter, wardFilter],
  );

  useEffect(() => {
    const trimmed = value.trim();
    const current = qFromUrl.trim();
    if (trimmed === current) return;

    const id = window.setTimeout(() => {
      pushQuery(value);
    }, 180);
    return () => window.clearTimeout(id);
  }, [value, qFromUrl, pushQuery]);

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="بحث…"
      className={`${ad.input} w-full`}
      autoComplete="off"
      type="search"
      enterKeyHint="search"
      aria-label="بحث في الطلبات"
    />
  );
}
