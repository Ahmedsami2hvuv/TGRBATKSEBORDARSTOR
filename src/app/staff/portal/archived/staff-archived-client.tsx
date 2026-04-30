"use client";

import { useState, useMemo, useEffect } from "react";
import { UnifiedOrderListTable } from "@/components/unified-order-list-table";
import { whatsappMeUrl } from "@/lib/whatsapp";
import { ad } from "@/lib/admin-ui";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

export function StaffArchivedClient({ rows }: { rows: any[] }) {
  const [q, setQ] = useState("");
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const t = q.toLowerCase();
    return rows.filter(r =>
      r.shortId.includes(t) ||
      r.shopName.toLowerCase().includes(t) ||
      r.customerPhone.includes(t) ||
      r.regionLine.toLowerCase().includes(t)
    );
  }, [q, rows]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
          <DynamicIcon icon={icons?.ui_search} className="w-4 h-4" fallback={<span>🔍</span>} />
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث برقم الطلب، المحل، الهاتف، المنطقة..."
          className="w-full rounded-xl border border-sky-200 bg-white pr-10 pl-4 py-3 text-sm text-slate-800 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 font-bold"
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <UnifiedOrderListTable
          rows={filtered}
          colCount={8}
          showSelectColumn={true}
          isRowSelectable={() => false}
          isSelected={() => false}
          allSelected={false}
          onToggleAll={() => {}}
          onToggleOne={() => {}}
          onOpenRow={() => {}}
          selectAllTitle=""
          selectAllAriaLabel=""
          selectedTitle=""
          selectedAriaPrefix=""
          showStatusDotInSelectCol={false}
          renderOrderIdBadge={() => null}
          renderSelectActions={(row) => {
             // التعديل هنا: زر التقييم يظهر فقط للطلبات التي رفع المندوب موقعها (GPS)
             if (row.hasCourierUploadedLocation) {
                return (
                  <a
                    href={whatsappMeUrl(row.customerPhone, "مرحباً، نرجو تقييم خدمة التوصيل الخاص بطلبكم من أبو الأكبر للتوصيل. رأيكم يهمنا جداً لتطوير الخدمة.")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center justify-center gap-1 rounded-md border border-amber-400 bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700 shadow-sm transition hover:bg-amber-100 whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                    title="المندوب رفع لوكيشن - أرسل طلب تقييم عبر الواتساب"
                  >
                    <DynamicIcon icon={icons?.ui_star} className="w-3 h-3" fallback={<span>⭐</span>} />
                    طلب تقييم
                  </a>
                );
             }
             return null;
          }}
        />
      </div>
    </div>
  );
}