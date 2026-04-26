"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ad } from "@/lib/admin-ui";
import { deleteRegion } from "./actions";

export type RegionRow = {
  id: string;
  name: string;
  deliveryPrice: string;
  orderCount: number;
};

export function RegionsList({ regions }: { regions: RegionRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return regions;
    return regions.filter((r) => r.name.toLowerCase().includes(q));
  }, [regions, query]);

  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span className={ad.label}>بحث في المناطق</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="اكتب جزءاً من اسم المنطقة…"
          className={`w-full max-w-md sm:ms-auto ${ad.input}`}
        />
      </label>

      {filtered.length === 0 ? (
        <p className={ad.muted}>
          {regions.length === 0
            ? "لا توجد مناطق بعد."
            : "لا توجد نتائج مطابقة للبحث."}
        </p>
      ) : (
        <ul className={ad.listDivide}>
          {filtered.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className={ad.listTitle}>{r.name}</p>
                <p className={ad.listMuted}>
                  التوصيل:{" "}
                  <span className="tabular-nums">{r.deliveryPrice}</span>
                  {" | "}الطلبات: <span className="tabular-nums">{r.orderCount}</span>
                </p>
                <Link
                  href={`/admin/orders/tracking?q=${encodeURIComponent(r.name)}`}
                  className="mt-1 inline-block text-xs font-bold text-sky-700 underline hover:text-sky-900"
                >
                  عرض الطلبات
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/admin/regions/${r.id}/edit`}
                  className={`text-sm ${ad.link}`}
                >
                  تعديل
                </Link>
                <form action={deleteRegion}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className={ad.dangerLink}>
                    حذف
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
