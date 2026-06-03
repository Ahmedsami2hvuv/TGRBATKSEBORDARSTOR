"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ad } from "@/lib/admin-ui";
import { deleteShop, togglePauseOrders } from "./actions";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";

export type ShopRow = {
  id: string;
  name: string;
  locationUrl: string;
  regionName: string;
  ordersPaused: boolean;
  pauseMessage: string;
  employeesCount: number;
  ordersCount: number;
  createdAt: string;
};

export function ShopsList({ shops, icons }: { shops: ShopRow[]; icons: GlobalIconsConfig | null }) {
  const [query, setQuery] = useState("");

  // ترتيب وتصنيف المحلات (المضاف حديثاً بالأعلى لمده ساعة، ثم الأكثر طلباً)
  const sorted = useMemo(() => {
    const oneHour = 60 * 60 * 1000;
    const now = Date.now();

    const list = [...shops].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      const aRecent = (now - aTime) < oneHour;
      const bRecent = (now - bTime) < oneHour;

      if (aRecent && !bRecent) return -1;
      if (!aRecent && bRecent) return 1;

      if (aRecent && bRecent) {
        return bTime - aTime; // الأحدث أولاً من بين المضافين مؤخراً
      }

      // الترتيب حسب عدد الطلبات من الأكثر للأقل
      if (b.ordersCount !== a.ordersCount) {
        return b.ordersCount - a.ordersCount;
      }
      return bTime - aTime;
    });

    return list.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
  }, [shops]);

  // تحديد الأسماء المكررة
  const duplicates = useMemo(() => {
    const counts = new Map<string, number>();
    shops.forEach(s => {
      const name = s.name.trim().toLowerCase();
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return new Set(
      Array.from(counts.entries())
        .filter(([_, count]) => count > 1)
        .map(([name]) => name)
    );
  }, [shops]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.regionName.toLowerCase().includes(q) ||
        s.locationUrl.toLowerCase().includes(q),
    );
  }, [sorted, query]);

  function onDeleteSubmit(e: React.FormEvent<HTMLFormElement>, shopName: string) {
    if (!confirm(`هل أنت متأكد من حذف المحل "${shopName}"؟\nلا يمكن التراجع عن هذا الإجراء.`)) {
      e.preventDefault();
    }
  }

  return (
    <div className="space-y-3">
      {duplicates.size > 0 && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-black text-amber-900">
            <DynamicIcon iconKey="ui_warning" config={icons} fallback="⚠️" className="w-4 h-4" /> تنبيه: توجد محلات مكررة بالاسم
          </p>
          <p className="mt-1 text-xs text-amber-800 leading-relaxed">
            الأسماء التالية مكررة في القائمة أدناه، يفضل دمجها أو حذف المكرر منها لضمان دقة التقارير:
            <br />
            <span className="font-bold">
              {Array.from(duplicates).join("، ")}
            </span>
          </p>
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span className={ad.label}>بحث في المحلات</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="اسم المحل، المنطقة، أو جزء من الرابط…"
          className={`w-full max-w-md sm:ms-auto ${ad.input}`}
        />
      </label>

      {filtered.length === 0 ? (
        <p className={ad.muted}>
          {shops.length === 0
            ? "لا توجد محلات بعد."
            : "لا توجد نتائج مطابقة للبحث."}
        </p>
      ) : (
        <ul className={ad.listDivide}>
          {filtered.map((s) => {
            const isDuplicate = duplicates.has(s.name.trim().toLowerCase());
            const isNew = (Date.now() - new Date(s.createdAt).getTime()) < 60 * 60 * 1000;
            return (
              <li
                key={s.id}
                className={`flex flex-wrap items-start justify-between gap-3 py-3 rounded-lg transition-colors ${
                  isDuplicate ? "bg-amber-50/50 px-2 ring-1 ring-amber-200" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={ad.listTitle}>{s.name}</p>
                    
                    {/* شارة الترتيب توب 1/2/3 */}
                    {s.rank === 1 && (
                      <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white shadow-sm hover:scale-105 transition-all">
                        توب 1 ⭐
                      </span>
                    )}
                    {s.rank === 2 && (
                      <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-black text-white shadow-sm hover:scale-105 transition-all">
                        توب 2
                      </span>
                    )}
                    {s.rank === 3 && (
                      <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white shadow-sm hover:scale-105 transition-all">
                        توب 3
                      </span>
                    )}

                    {/* شارة مضاف حديثاً (أقل من ساعة) */}
                    {isNew && (
                      <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-black text-white shadow-sm hover:scale-105 transition-all animate-pulse">
                        جديد ✨
                      </span>
                    )}

                    {isDuplicate && (
                      <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white shadow-sm">
                        اسم مكرر
                      </span>
                    )}
                  </div>
                  <p className={ad.listMuted}>{s.regionName}</p>
                  
                  {/* بلوكين يظهران أرقام العملاء والطلبيات فقط */}
                  <div className="mt-2 flex items-center gap-2">
                    <span 
                      title="عدد العملاء" 
                      className="inline-flex items-center justify-center bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1 rounded-xl text-xs font-black shadow-sm min-w-8"
                    >
                      {s.employeesCount}
                    </span>
                    <span 
                      title="عدد الطلبيات" 
                      className="inline-flex items-center justify-center bg-amber-50 border border-amber-100 text-amber-700 px-3 py-1 rounded-xl text-xs font-black shadow-sm min-w-8"
                    >
                      {s.ordersCount}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (s.ordersPaused) {
                        if (confirm("هل تريد استئناف تلقي الطلبات لهذا المحل؟")) {
                          const fd = new FormData();
                          fd.append("id", s.id);
                          fd.append("shouldPause", "false");
                          togglePauseOrders(fd);
                        }
                      } else {
                        const msg = prompt("أدخل رسالة التوقف (مثلاً: نفتح بعد العيد):", "نفتح بعد العيد");
                        if (msg !== null) {
                          const fd = new FormData();
                          fd.append("id", s.id);
                          fd.append("shouldPause", "true");
                          fd.append("pauseMessage", msg);
                          togglePauseOrders(fd);
                        }
                      }
                    }}
                    className={`text-sm font-bold px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${
                      s.ordersPaused
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                    }`}
                  >
                    <DynamicIcon
                      iconKey={s.ordersPaused ? "ui_play" : "ui_pause"}
                      config={icons}
                      fallback={s.ordersPaused ? "▶️" : "⏸️"}
                      className="w-3 h-3"
                    />
                    {s.ordersPaused ? "استئناف الطلبات" : "إيقاف الطلبات"}
                  </button>

                  <Link
                    href={`/abo1stor3hlaa2kbr8-47/shops/${s.id}/employees`}
                    className={`text-sm font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md hover:bg-indigo-100 transition-colors flex items-center gap-1`}
                  >
                    <DynamicIcon iconKey="ui_user" config={icons} fallback="👤" className="w-3 h-3" />
                    العملاء (أصحاب الروابط)
                  </Link>
                  <Link
                    href={`/abo1stor3hlaa2kbr8-47/shops/${s.id}/edit`}
                    className={`text-sm ${ad.link} flex items-center gap-1`}
                  >
                    <DynamicIcon iconKey="ui_edit" config={icons} fallback="✏️" className="w-3 h-3" />
                    تعديل المحل
                  </Link>
                  <form action={deleteShop} onSubmit={(e) => onDeleteSubmit(e, s.name)}>
                    <input type="hidden" name="id" value={s.id} />
                    <button type="submit" className={`${ad.dangerLink} flex items-center gap-1`}>
                      <DynamicIcon iconKey="ui_delete" config={icons} fallback="🗑️" className="w-3 h-3" />
                      حذف
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
