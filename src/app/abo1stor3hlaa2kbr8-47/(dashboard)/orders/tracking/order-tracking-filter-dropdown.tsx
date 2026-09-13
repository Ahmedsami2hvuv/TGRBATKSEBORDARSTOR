"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";

interface Props {
  currentStatus: string;
  pendingCount: number;
  wardFilter?: "lower" | "higher";
  saderFilter?: "lower" | "higher";
  searchQuery?: string;
}

const STATUS_ITEMS = [
  { key: "all", label: "الكل", icon: "🌟", desc: "عرض جميع الطلبات النشطة" },
  { key: "pending", label: "جديد", icon: "⚡", desc: "طلبات جديدة بانتظار الإسناد", badge: true },
  { key: "assigned", label: "مسند", icon: "📦", desc: "بانتظار استلام المندوب" },
  { key: "delivering", label: "بالتوصيل", icon: "🛵", desc: "قيد التوصيل مع المندوب" },
  { key: "delivered", label: "مسلّم", icon: "✅", desc: "تم تسليمها للزبائن" },
  { key: "checkSader", label: "فحص الصادر", icon: "⚖️", desc: "فروقات دفع المحل (الصادر)", hasSub: true },
  { key: "checkWard", label: "فحص الوارد", icon: "📥", desc: "فروقات استلام الزبون (الوارد)", hasSub: true },
  { key: "cancelled", label: "المرفوضة", icon: "🚫", desc: "الطلبات الملغاة والمرفوضة" },
];

export function OrderTrackingFilterDropdown({
  currentStatus,
  pendingCount,
  wardFilter = "lower",
  saderFilter = "higher",
  searchQuery = "",
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  function getStatusLabel(status: string) {
    const item = STATUS_ITEMS.find((i) => i.key === status);
    if (!item) return { label: "الكل", icon: "🌟" };
    return item;
  }

  const activeItem = getStatusLabel(currentStatus);

  function createFilterUrl(opts: {
    status: string;
    wardFilterVal?: "lower" | "higher";
    saderFilterVal?: "lower" | "higher";
  }) {
    const p = new URLSearchParams();
    if (opts.status !== "all") p.set("status", opts.status);
    if (opts.status === "checkWard" && opts.wardFilterVal) {
      p.set("wardFilter", opts.wardFilterVal);
    }
    if (opts.status === "checkSader" && opts.saderFilterVal) {
      p.set("saderFilter", opts.saderFilterVal);
    }
    const q = searchParams.get("q") || searchQuery;
    if (q) p.set("q", q);
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <div className="relative inline-block text-right shrink-0" ref={dropdownRef} dir="rtl">
      {/* زر الفلتر الملكي المضغوط */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="group relative flex h-10 sm:h-10.5 items-center gap-2 rounded-2xl border-2 border-[#C9A86A] bg-gradient-to-b from-[#0F4D3A] via-[#0A3D2E] to-[#07291F] px-3 sm:px-3.5 text-white shadow-md shadow-[#0A3D2E]/20 transition-all hover:brightness-110 active:scale-95"
        title="تصفية الطلبات حسب الحالة"
      >
        <div className="relative size-6 shrink-0 flex items-center justify-center">
          <Image
            src="/images/order-luxury/btn-filter.webp"
            alt="فلتر"
            width={24}
            height={24}
            className="size-6 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
            priority
          />
        </div>

        <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm text-[#F5D77F] whitespace-nowrap">
          <span>{activeItem.label}</span>
          {currentStatus === "pending" && pendingCount > 0 ? (
            <span className="inline-flex min-w-[1.2rem] items-center justify-center rounded-full bg-[#F5D77F] text-[#0A3D2E] px-1.5 py-0.2 text-[10px] font-black leading-none shadow-xs">
              {pendingCount > 99 ? "99+" : pendingCount}
            </span>
          ) : null}
        </div>

        <span className={`text-[10px] text-[#C9A86A] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      {/* القائمة المنسدلة الملكية الفاخرة */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 z-50 w-72 sm:w-80 rounded-2xl border-2 border-[#C9A86A] bg-gradient-to-b from-[#FFFFFF] via-[#FFFDF9] to-[#FFF8F0] p-2.5 shadow-[0_12px_35px_rgba(10,61,46,0.25)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-[#C9A86A]/30 pb-2 mb-2 px-1">
            <div className="flex items-center gap-1.5 text-xs font-black text-[#0A3D2E]">
              <span className="text-[#C9A86A]">⚜️</span>
              <span>تصفية حسب الحالة</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1.5 py-0.5 rounded-lg hover:bg-slate-100 transition"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1 max-h-[70vh] overflow-y-auto p-0.5 no-scrollbar">
            {STATUS_ITEMS.map((item) => {
              const isSelected = currentStatus === item.key;
              const href = createFilterUrl({
                status: item.key,
                wardFilterVal: wardFilter,
                saderFilterVal: saderFilter,
              });

              return (
                <div key={item.key} className="space-y-1">
                  <Link
                    href={href}
                    onClick={() => {
                      if (!item.hasSub) setIsOpen(false);
                    }}
                    className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-black transition active:scale-[0.98] ${
                      isSelected
                        ? item.key === "cancelled"
                          ? "bg-[#7A1F1F] text-white shadow-sm border border-[#C9A86A]"
                          : "bg-gradient-to-r from-[#0F4D3A] via-[#0A3D2E] to-[#0F4D3A] text-[#F5D77F] shadow-sm border border-[#C9A86A]"
                        : item.key === "cancelled"
                        ? "text-[#7A1F1F] hover:bg-rose-50"
                        : "text-[#0A3D2E] hover:bg-[#FFF8F0]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{item.icon}</span>
                      <div className="text-right">
                        <p className="leading-tight">{item.label}</p>
                        <p
                          className={`text-[9.5px] font-medium leading-tight ${
                            isSelected ? "text-[#F5D77F]/80" : "text-slate-500"
                          }`}
                        >
                          {item.desc}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.key === "pending" && pendingCount > 0 ? (
                        <span className="inline-flex min-w-[1.2rem] items-center justify-center rounded-full bg-[#C9A86A] text-[#0A3D2E] px-1.5 py-0.5 text-[10px] font-black leading-none">
                          {pendingCount > 99 ? "99+" : pendingCount}
                        </span>
                      ) : null}
                      {isSelected && <span className="text-xs font-black text-[#F5D77F]">✓</span>}
                    </div>
                  </Link>

                  {/* خيارات فحص الصادر الفرعية */}
                  {item.key === "checkSader" && isSelected && (
                    <div className="mr-6 pr-2 border-r-2 border-[#C9A86A]/40 space-y-1 py-1">
                      <Link
                        href={createFilterUrl({ status: "checkSader", saderFilterVal: "lower" })}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-black transition ${
                          saderFilter === "lower"
                            ? "bg-emerald-700 text-white"
                            : "text-emerald-900 bg-emerald-50/80 hover:bg-emerald-100"
                        }`}
                      >
                        <span>المبلغ أقل من سعر البضاعة</span>
                        {saderFilter === "lower" && <span>✓</span>}
                      </Link>
                      <Link
                        href={createFilterUrl({ status: "checkSader", saderFilterVal: "higher" })}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-black transition ${
                          saderFilter === "higher"
                            ? "bg-emerald-700 text-white"
                            : "text-emerald-900 bg-emerald-50/80 hover:bg-emerald-100"
                        }`}
                      >
                        <span>المبلغ أعلى من سعر البضاعة</span>
                        {saderFilter === "higher" && <span>✓</span>}
                      </Link>
                    </div>
                  )}

                  {/* خيارات فحص الوارد الفرعية */}
                  {item.key === "checkWard" && isSelected && (
                    <div className="mr-6 pr-2 border-r-2 border-[#C9A86A]/40 space-y-1 py-1">
                      <Link
                        href={createFilterUrl({ status: "checkWard", wardFilterVal: "lower" })}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-black transition ${
                          wardFilter === "lower"
                            ? "bg-red-700 text-white"
                            : "text-red-900 bg-red-50/80 hover:bg-red-100"
                        }`}
                      >
                        <span>المبلغ أقل من المتوقع</span>
                        {wardFilter === "lower" && <span>✓</span>}
                      </Link>
                      <Link
                        href={createFilterUrl({ status: "checkWard", wardFilterVal: "higher" })}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-black transition ${
                          wardFilter === "higher"
                            ? "bg-red-700 text-white"
                            : "text-red-900 bg-red-50/80 hover:bg-red-100"
                        }`}
                      >
                        <span>المبلغ أعلى من المتوقع</span>
                        {wardFilter === "higher" && <span>✓</span>}
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
