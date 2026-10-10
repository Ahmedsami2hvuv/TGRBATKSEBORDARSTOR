"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  SlidersHorizontal,
  Layers,
  Sparkles,
  Clock,
  Truck,
  CheckCircle2,
  Scale,
  Inbox,
  Ban,
  Check,
  ChevronDown,
  X,
} from "lucide-react";

interface Props {
  currentStatus: string;
  pendingCount: number;
  wardFilter?: "lower" | "higher";
  saderFilter?: "lower" | "higher";
  searchQuery?: string;
}

const STATUS_ITEMS = [
  { key: "all", label: "الكل", icon: Layers, desc: "عرض جميع الطلبات النشطة" },
  { key: "pending", label: "جديد", icon: Sparkles, desc: "طلبات جديدة بانتظار الإسناد", badge: true },
  { key: "assigned", label: "مسند", icon: Clock, desc: "بانتظار استلام المندوب" },
  { key: "delivering", label: "بالتوصيل", icon: Truck, desc: "قيد التوصيل مع المندوب" },
  { key: "delivered", label: "مسلّم", icon: CheckCircle2, desc: "تم تسليمها للزبائن" },
  { key: "checkSader", label: "فحص الصادر", icon: Scale, desc: "فروقات دفع المحل (الصادر)", hasSub: true },
  { key: "checkWard", label: "فحص الوارد", icon: Inbox, desc: "فروقات استلام الزبون (الوارد)", hasSub: true },
  { key: "cancelled", label: "المرفوضة", icon: Ban, desc: "الطلبات الملغاة والمرفوضة" },
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
    if (!item) return { label: "الكل", icon: Layers };
    return item;
  }

  const activeItem = getStatusLabel(currentStatus);
  const ActiveIcon = activeItem.icon;

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
      {/* زر الفلتر بهوية وصلي الرسمية */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="group relative flex h-10 sm:h-10.5 items-center gap-2 rounded-2xl border border-[#FFC107]/40 bg-[#0B2E8C] px-3.5 sm:px-4 text-white shadow-sm shadow-[#0B2E8C]/20 transition-all hover:bg-[#153E9B] active:scale-95 cursor-pointer"
        title="تصفية الطلبات حسب الحالة"
      >
        <div className="relative size-5 shrink-0 flex items-center justify-center text-[#FFC107]">
          <SlidersHorizontal className="w-4 h-4 stroke-[2.2]" />
        </div>

        <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm text-white whitespace-nowrap">
          <span>{activeItem.label}</span>
          {currentStatus === "pending" && pendingCount > 0 ? (
            <span className="inline-flex min-w-[1.2rem] items-center justify-center rounded-full bg-[#FFC107] text-[#0B2E8C] px-1.5 py-0.2 text-[10px] font-black leading-none shadow-xs">
              {pendingCount > 99 ? "99+" : pendingCount}
            </span>
          ) : null}
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-[#FFC107] transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* القائمة المنسدلة بهوية وصلي */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 z-50 w-72 sm:w-80 rounded-2xl border-2 border-[#D0DDFB] bg-white p-2.5 shadow-[0_12px_35px_rgba(11,46,140,0.18)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-[#D0DDFB] pb-2 mb-2 px-1">
            <div className="flex items-center gap-1.5 text-xs font-black text-[#0B2E8C]">
              <span className="w-2 h-2 rounded-full bg-[#FFC107]" />
              <span>تصفية حسب الحالة</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1 max-h-[70vh] overflow-y-auto p-0.5 no-scrollbar">
            {STATUS_ITEMS.map((item) => {
              const isSelected = currentStatus === item.key;
              const ItemIcon = item.icon;
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
                          ? "bg-rose-600 text-white shadow-sm"
                          : "bg-[#0B2E8C] text-[#FFC107] shadow-sm"
                        : item.key === "cancelled"
                        ? "text-rose-600 hover:bg-rose-50"
                        : "text-[#0B2E8C] hover:bg-[#F0F4FF]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <ItemIcon className="w-4 h-4 shrink-0" />
                      <div className="text-right">
                        <p className="leading-tight">{item.label}</p>
                        <p
                          className={`text-[9.5px] font-medium leading-tight ${
                            isSelected ? "text-white/80" : "text-slate-500"
                          }`}
                        >
                          {item.desc}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.key === "pending" && pendingCount > 0 ? (
                        <span className="inline-flex min-w-[1.2rem] items-center justify-center rounded-full bg-[#FFC107] text-[#0B2E8C] px-1.5 py-0.5 text-[10px] font-black leading-none">
                          {pendingCount > 99 ? "99+" : pendingCount}
                        </span>
                      ) : null}
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#FFC107] stroke-[3]" />}
                    </div>
                  </Link>

                  {/* خيارات فحص الصادر الفرعية */}
                  {item.key === "checkSader" && isSelected && (
                    <div className="mr-6 pr-2 border-r-2 border-[#D0DDFB] space-y-1 py-1">
                      <Link
                        href={createFilterUrl({ status: "checkSader", saderFilterVal: "lower" })}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-black transition ${
                          saderFilter === "lower"
                            ? "bg-[#0B2E8C] text-white"
                            : "text-[#0B2E8C] bg-[#F0F4FF] hover:bg-[#E8EEFF]"
                        }`}
                      >
                        <span>المبلغ أقل من سعر البضاعة</span>
                        {saderFilter === "lower" && <Check className="w-3 h-3 stroke-[2.5]" />}
                      </Link>
                      <Link
                        href={createFilterUrl({ status: "checkSader", saderFilterVal: "higher" })}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-black transition ${
                          saderFilter === "higher"
                            ? "bg-[#0B2E8C] text-white"
                            : "text-[#0B2E8C] bg-[#F0F4FF] hover:bg-[#E8EEFF]"
                        }`}
                      >
                        <span>المبلغ أعلى من سعر البضاعة</span>
                        {saderFilter === "higher" && <Check className="w-3 h-3 stroke-[2.5]" />}
                      </Link>
                    </div>
                  )}

                  {/* خيارات فحص الوارد الفرعية */}
                  {item.key === "checkWard" && isSelected && (
                    <div className="mr-6 pr-2 border-r-2 border-[#D0DDFB] space-y-1 py-1">
                      <Link
                        href={createFilterUrl({ status: "checkWard", wardFilterVal: "lower" })}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-black transition ${
                          wardFilter === "lower"
                            ? "bg-rose-600 text-white"
                            : "text-rose-700 bg-rose-50 hover:bg-rose-100"
                        }`}
                      >
                        <span>المبلغ أقل من المتوقع</span>
                        {wardFilter === "lower" && <Check className="w-3 h-3 stroke-[2.5]" />}
                      </Link>
                      <Link
                        href={createFilterUrl({ status: "checkWard", wardFilterVal: "higher" })}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-black transition ${
                          wardFilter === "higher"
                            ? "bg-rose-600 text-white"
                            : "text-rose-700 bg-rose-50 hover:bg-rose-100"
                        }`}
                      >
                        <span>المبلغ أعلى من المتوقع</span>
                        {wardFilter === "higher" && <Check className="w-3 h-3 stroke-[2.5]" />}
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
