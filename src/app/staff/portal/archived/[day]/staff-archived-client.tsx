"use client";

import { useState, useMemo } from "react";
import { UnifiedOrderListTable } from "@/components/unified-order-list-table";
import { whatsappMeUrl } from "@/lib/whatsapp";
import { parseStatusesCsv } from "@/lib/mandoub-wa-button-template";
import {
  parseCustomerLocationRules,
  matchesCustomerLocationRules,
} from "@/lib/order-location";

export function StaffArchivedClient({ rows, dynamicWaButtons }: { rows: any[], dynamicWaButtons: any[] }) {
  const [q, setQ] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

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

  // استخراج الأزرار المخصصة للموظف والتي تطابق حالة الطلب
  const generateWaLinksForOrder = (order: any) => {
    const validButtons = dynamicWaButtons.filter(btn => {
      // 1. فحص الصلاحية (هل يظهر للموظف؟)
      const scopes = (btn.visibilityScope || "all").split(",").map((s: string) => s.trim()).filter(Boolean);
      if (scopes.length === 0 || scopes.includes("all") || scopes.includes("employee")) {
        // يسمح لجميع الأزرار التي ليس لديها نطاق مرئي واضح أو محددة للعاملين
      } else {
        return false;
      }

      // 2. فحص حالة الطلب (نحن هنا دائما في المؤرشف archived)
      const statuses = parseStatusesCsv(btn.statusesCsv || "");
      if (statuses.length > 0 && !statuses.includes("archived")) return false;

      // 3. فحص اللوكيشن (المهم جداً لزر التقييم!)
      const locRules = parseCustomerLocationRules(btn.customerLocationRule || "any");
      if (!matchesCustomerLocationRules(locRules, order.hasCustomerLocation, order.hasCourierUploadedLocation)) return false;

      return true; // إذا نجح في كل الفحوصات
    });

    // تحويل كل زر صالح إلى رابط جاهز
    return validButtons.map(btn => {
      const templates = (btn.templateText || "").split(/\n\s*---\s*\n/g).map((s: string) => s.trim()).filter(Boolean);
      const template = templates.length > 0 ? templates[Math.floor(Math.random() * templates.length)] : "";
      
      const text = template
        .replace(/{{{clientshop}}}/g, order.shopName || "")
        .replace(/{{{city}}}/g, order.regionLine || "")
        .replace(/{{{total_price}}}/g, order.priceStr || "")
        .replace(/{{{delivery}}}/g, order.assignedCourierName || "")
        .replace(/{{{order_number}}}/g, order.shortId || "")
        .replace(/{{{customer_phone}}}/g, order.customerPhone || "");

      return {
        id: btn.id,
        label: btn.label,
        icon: btn.iconKey || "💬",
        url: whatsappMeUrl(order.customerPhone, text)
      };
    });
  };

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="بحث برقم الطلب، المحل، الهاتف، المنطقة..."
        className="w-full rounded-2xl border border-sky-200 bg-white px-4 py-3.5 text-base text-slate-800 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
      />
      
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <UnifiedOrderListTable
          rows={filtered}
          colCount={8}
          showSelectColumn={true}
          isRowSelectable={() => false}
          isSelected={() => false}
          allSelected={false}
          onToggleAll={() => {}}
          onToggleOne={() => {}}
          onOpenRow={(id) => {
            const order = filtered.find(r => r.id === id);
            if (order) setSelectedOrder(order);
          }} 
          selectAllTitle=""
          selectAllAriaLabel=""
          selectedTitle=""
          selectedAriaPrefix=""
          showStatusDotInSelectCol={false}
          renderOrderIdBadge={() => null}
          renderSelectActions={() => null} // لا نعرض أزرار هنا لأنها ستعرض داخل النافذة المنبثقة
        />
      </div>

      {/* النافذة المنبثقة (Modal) */}
      {selectedOrder && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedOrder(null)}
          dir="rtl"
        >
          <div 
            className="w-full max-w-[420px] bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border-2 border-slate-200" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-slate-50 px-5 py-4 border-b border-slate-200">
              <h3 className="text-lg font-black text-slate-900">تفاصيل الطلب #{selectedOrder.shortId}</h3>
              <button 
                onClick={() => setSelectedOrder(null)} 
                className="h-8 w-8 flex items-center justify-center rounded-xl bg-white border border-slate-300 text-slate-600 font-bold hover:bg-slate-200 hover:text-rose-600 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
              
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <p className="text-[11px] font-bold text-slate-500 mb-1">اسم المحل</p>
                  <p className="text-sm font-black text-slate-900">{selectedOrder.shopName}</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <p className="text-[11px] font-bold text-slate-500 mb-1">المنطقة</p>
                  <p className="text-sm font-black text-slate-900">{selectedOrder.regionLine}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                  <p className="text-[11px] font-bold text-emerald-700 mb-1">المبلغ الكلي</p>
                  <p className="text-base font-black text-emerald-900 tabular-nums">{selectedOrder.priceStr}</p>
                </div>
                <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4">
                  <p className="text-[11px] font-bold text-sky-700 mb-1">التوصيل</p>
                  <p className="text-base font-black text-sky-900 tabular-nums">{selectedOrder.delStr}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 text-center">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <p className="text-[11px] font-bold text-slate-500 mb-1">رقم الزبون</p>
                  <p className="text-base font-black text-slate-900 font-mono tabular-nums">{selectedOrder.customerPhone}</p>
                  {selectedOrder.customerAlternatePhone && (
                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400">رقم ثانٍ</p>
                      <p className="text-sm font-black text-slate-600 font-mono tabular-nums">{selectedOrder.customerAlternatePhone}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 text-center">
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
                  <p className="text-[11px] font-bold text-purple-700 mb-1">المندوب المسلم</p>
                  <p className="text-sm font-black text-purple-900">{selectedOrder.assignedCourierName}</p>
                </div>
              </div>

              <div className="text-center pt-2">
                <p className="text-[11px] font-bold text-slate-500 mb-2">وقت وتاريخ الطلب</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold tabular-nums" dir="ltr">{selectedOrder.timeOnly}</span>
                  <span className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold tabular-nums">{selectedOrder.dateOnly}</span>
                </div>
              </div>

              <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-4 mt-2 text-center">
                <p className="text-[11px] font-black text-amber-800 mb-2">قائمة المواد والملاحظات</p>
                <p className="text-sm font-bold text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {selectedOrder.summary}
                </p>
              </div>

              {/* الأزرار الديناميكية المستوردة من لوحة الإدارة */}
              {generateWaLinksForOrder(selectedOrder).length > 0 ? (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <p className="text-[11px] font-bold text-slate-500 text-center mb-3">خيارات التواصل</p>
                  {generateWaLinksForOrder(selectedOrder).map(btn => (
                    <a
                      key={btn.id}
                      href={btn.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3.5 text-sm font-black text-white shadow-[0_4px_14px_rgba(249,115,22,0.4)] transition hover:bg-orange-600 active:scale-[0.98]"
                    >
                      <span>{btn.icon}</span> {btn.label}
                    </a>
                  ))}
                </div>
              ) : null}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
