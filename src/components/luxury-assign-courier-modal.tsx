"use client";

import { useState } from "react";
import Image from "next/image";

export interface CourierOption {
  id: string;
  name: string;
  phone?: string | null;
}

interface Props {
  orderId: string;
  orderNumber: number;
  currentCourierId?: string | null;
  currentCourierName?: string | null;
  couriers: CourierOption[];
  isPending?: boolean;
  onAssign: (courierId: string | null, directReceipt: boolean) => Promise<void> | void;
  onClose: () => void;
}

export function LuxuryAssignCourierModal({
  orderId,
  orderNumber,
  currentCourierId,
  currentCourierName,
  couriers,
  isPending = false,
  onAssign,
  onClose,
}: Props) {
  const [directReceipt, setDirectReceipt] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCouriers = couriers.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  async function handleSelect(courierId: string | null) {
    if (isPending) return;
    setLoadingId(courierId ?? "unassign");
    try {
      await onAssign(courierId, directReceipt);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-200"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-[28px] border-2 border-[#C9A86A] bg-gradient-to-b from-[#FFFFFF] via-[#FFFDF9] to-[#FFF8F0] shadow-[0_20px_60px_rgba(10,61,46,0.35)] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* شريط الرأس الملكي الزمردي المذهب */}
        <div className="relative flex items-center justify-between border-b-2 border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] via-[#0A3D2E] to-[#0F4D3A] px-4 sm:px-5 py-3.5 text-white shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🛵</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-[#F5D77F] leading-tight">
                  إسناد الطلب لمندوب
                </h3>
                <span className="rounded-full bg-[#C9A86A]/20 border border-[#C9A86A]/60 px-2.5 py-0.5 text-xs font-black text-[#F5D77F]">
                  #{orderNumber}
                </span>
              </div>
              <p className="text-[11px] font-bold text-emerald-200/80">
                اختر المندوب لتحويل ومتابعة الطلب
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="flex size-8 sm:size-9 items-center justify-center rounded-full bg-[#0A3D2E] text-[#F5D77F] border border-[#C9A86A] hover:bg-[#C9A86A] hover:text-[#0A3D2E] transition active:scale-90 text-sm font-black shadow-md cursor-pointer z-50"
            title="إغلاق"
          >
            ✕
          </button>
        </div>

        {/* جسم المودال */}
        <div className="p-4 sm:p-5 space-y-3.5 max-h-[75vh] overflow-y-auto">
          {/* خيار الاستلام المباشر الفاخر */}
          <label
            htmlFor="direct-receipt-modal-checkbox"
            className="group flex items-start gap-3 rounded-2xl border-2 border-[#C9A86A]/50 bg-gradient-to-r from-emerald-50/90 via-amber-50/50 to-emerald-50/90 p-3 sm:p-3.5 cursor-pointer shadow-xs transition hover:border-[#C9A86A] hover:shadow-sm select-none"
          >
            <div className="pt-0.5">
              <input
                type="checkbox"
                id="direct-receipt-modal-checkbox"
                checked={directReceipt}
                onChange={(e) => setDirectReceipt(e.target.checked)}
                className="size-5 rounded-lg border-2 border-[#C9A86A] text-[#0A3D2E] focus:ring-[#C9A86A] accent-[#0A3D2E] cursor-pointer"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm text-[#0A3D2E]">
                <span>⚡</span>
                <span>استلام مباشر للمندوب (تخطي الموافقة)</span>
              </div>
              <p className="text-[11px] font-medium text-slate-600 mt-0.5">
                تتحول حالة الطلب فوراً إلى «عند المندوب» ويبدأ التوصيل مباشرة.
              </p>
            </div>
          </label>

          {/* حقل بحث سريع عن المندوب إذا كان العدد كبيراً */}
          {couriers.length > 6 && (
            <div className="relative">
              <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-[#C9A86A]">
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن اسم المندوب…"
                className="h-9 w-full rounded-xl border border-[#C9A86A]/60 bg-white pr-8 pl-3 text-xs font-black text-[#0A3D2E] placeholder:text-slate-400 outline-none focus:border-[#C9A86A] focus:ring-1 focus:ring-[#C9A86A]"
              />
            </div>
          )}

          {/* زر إلغاء إسناد المندوب الحالي إن وجد */}
          {(currentCourierId || currentCourierName) && (
            <button
              type="button"
              disabled={isPending || loadingId !== null}
              onClick={() => handleSelect(null)}
              className="flex w-full items-center justify-between rounded-2xl border-2 border-rose-300 bg-rose-50/80 px-3.5 py-2.5 text-xs sm:text-sm font-black text-rose-800 transition hover:bg-rose-100 active:scale-[0.98] disabled:opacity-60 shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <span>🚫</span>
                <span>إلغاء الإسناد (إعادة الطلب لحالة غير مسند)</span>
              </div>
              {loadingId === "unassign" && <span className="animate-spin text-xs">⏳</span>}
            </button>
          )}

          {/* شبكة بطاقات المناديب الملكية */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs font-black text-[#0A3D2E] flex items-center gap-1.5">
                <span className="text-[#C9A86A]">⚜️</span>
                <span>قائمة المناديب المتاحين ({filteredCouriers.length})</span>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
              {filteredCouriers.map((c) => {
                const isCurrent =
                  currentCourierId === c.id ||
                  (currentCourierName && currentCourierName.trim() === c.name.trim());
                const isLoadingThis = loadingId === c.id;

                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={isPending || loadingId !== null}
                    onClick={() => handleSelect(c.id)}
                    className={`group relative flex items-center justify-between rounded-2xl border-2 p-3 text-right transition-all active:scale-[0.98] disabled:opacity-60 shadow-xs ${
                      isCurrent
                        ? "border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] via-[#0A3D2E] to-[#0F4D3A] text-[#F5D77F] shadow-md shadow-[#0A3D2E]/25 ring-2 ring-[#C9A86A]/50"
                        : "border-[#C9A86A]/40 bg-white text-[#0A3D2E] hover:border-[#C9A86A] hover:bg-[#FFF8F0] hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`flex size-8 shrink-0 items-center justify-center rounded-xl text-base ${
                          isCurrent
                            ? "bg-[#C9A86A]/20 text-[#F5D77F] border border-[#C9A86A]/40"
                            : "bg-[#0A3D2E]/10 text-[#0A3D2E] border border-[#C9A86A]/20 group-hover:bg-[#C9A86A]/20"
                        }`}
                      >
                        🛵
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-xs sm:text-sm truncate leading-tight">
                          {c.name}
                        </p>
                        {c.phone && (
                          <p
                            className={`text-[10px] font-bold font-mono [direction:ltr] mt-0.5 ${
                              isCurrent ? "text-[#F5D77F]/80" : "text-slate-400"
                            }`}
                          >
                            {c.phone}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 mr-1.5">
                      {isCurrent ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F5D77F] text-[#0A3D2E] px-2 py-0.5 text-[10px] font-black shadow-xs">
                          <span>✓</span>
                          <span>مسند</span>
                        </span>
                      ) : (
                        <span className="text-xs font-black text-[#C9A86A] opacity-0 group-hover:opacity-100 transition">
                          إسناد ←
                        </span>
                      )}
                      {isLoadingThis && <span className="animate-spin text-xs">⏳</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            {filteredCouriers.length === 0 && (
              <div className="text-center py-6 bg-white rounded-2xl border border-dashed border-[#C9A86A]/40">
                <p className="text-xs font-bold text-slate-500">لا يوجد مندوب مطابق للبحث</p>
              </div>
            )}
          </div>
        </div>

        {/* تذييل المودال الملكي */}
        <div className="flex items-center justify-between border-t border-[#C9A86A]/30 bg-[#FFF8F0] px-4 py-3">
          <p className="text-[10.5px] font-bold text-[#0A3D2E]/70 flex items-center gap-1">
            <span>⚜️</span>
            <span>نظام الإسناد الملكي الذكي</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#C9A86A]/70 bg-white px-3.5 py-1.5 text-xs font-black text-[#0A3D2E] hover:bg-[#FFFDF9] transition active:scale-95 shadow-2xs"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
