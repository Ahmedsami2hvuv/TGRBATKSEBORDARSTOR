"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Calendar,
  Check,
  Clock,
  Inbox,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  Truck,
  User,
  Wallet,
  Zap,
} from "lucide-react";
import type { MandoubRow } from "./mandoub-order-table";
import { formatDinarAsAlf } from "@/lib/money-alf";

type WasliThemeBoardProps = {
  rows: MandoubRow[];
  allRows: MandoubRow[];
  auth: { c: string; exp?: string; s: string };
  tab: string;
  courierName: string;
  cashInHandStr: string;
  moneyMetrics?: {
    sumPickupOutDinar?: number;
    sumDeliveryInDinar?: number;
    remainingNetDinar?: number;
    sumEarningsDinar?: number;
  };
  onToggleWasliTheme: () => void;
  onOpenRow: (id: string) => void;
  setPickupOrder: (row: MandoubRow) => void;
  setDeliveryOrder: (row: MandoubRow) => void;
  showQuickSelect: boolean;
  setShowQuickSelect: React.Dispatch<React.SetStateAction<boolean>>;
  selectedIds: Set<string>;
  toggleOne: (id: string) => void;
  toggleAll: () => void;
  allSelected: boolean;
  qSearch: string;
  onSearchChange: (q: string) => void;
  showSearch: boolean;
  setShowSearch: React.Dispatch<React.SetStateAction<boolean>>;
};

export function WasliThemeBoard({
  rows,
  allRows,
  auth,
  tab,
  courierName,
  cashInHandStr,
  moneyMetrics,
  onOpenRow,
  setPickupOrder,
  setDeliveryOrder,
  showQuickSelect,
  setShowQuickSelect,
  selectedIds,
  toggleOne,
  toggleAll,
  allSelected,
  qSearch,
  onSearchChange,
  showSearch,
  setShowSearch,
}: WasliThemeBoardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "assigned" | "delivering" | "delivered">("all");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const baseQuery = new URLSearchParams();
  if (auth.c) baseQuery.set("c", auth.c);
  if (auth.exp) baseQuery.set("exp", auth.exp);
  if (auth.s) baseQuery.set("s", auth.s);

  // حساب الإحصائيات للملخص العلوي لوصلي
  const totalCount = allRows.length;
  const saderDisplay =
    moneyMetrics?.sumPickupOutDinar != null
      ? formatDinarAsAlf(moneyMetrics.sumPickupOutDinar)
      : `${totalCount}`;
  const wardDisplay =
    moneyMetrics?.sumDeliveryInDinar != null
      ? formatDinarAsAlf(moneyMetrics.sumDeliveryInDinar)
      : cashInHandStr;
  const remainingDisplay =
    moneyMetrics?.remainingNetDinar != null
      ? formatDinarAsAlf(moneyMetrics.remainingNetDinar)
      : "0";
  const earningsDisplay =
    moneyMetrics?.sumEarningsDinar != null
      ? formatDinarAsAlf(moneyMetrics.sumEarningsDinar)
      : "0";

  // فلترة الطلبات المعروضة بحسب التبويب السريع
  const displayedRows = useMemo(() => {
    if (activeFilter === "all") return rows;
    return rows.filter((r) => r.orderStatus === activeFilter);
  }, [rows, activeFilter]);

  // تاريخ اليوم العربي
  const todayArabic = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("ar-IQ", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date());
    } catch {
      return "اليوم";
    }
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    showToast("جاري تحديث الطلبات...");
    if (typeof window !== "undefined") {
      setTimeout(() => {
        window.location.reload();
      }, 700);
    }
  };

  // دالة تحديد لون بلوك اسم المحل والمنطقة حسب الحالة (الطلب الرابع)
  const getRouteBadgeStyle = (status: string) => {
    switch (status) {
      case "new":
      case "pending":
        // الجديدة: أزرق فاتح
        return "bg-gradient-to-l from-sky-500 to-sky-400 text-white shadow-[0_2px_8px_rgba(14,165,233,0.25)]";
      case "assigned":
        // المسند: أحمر
        return "bg-gradient-to-l from-rose-600 to-red-500 text-white shadow-[0_2px_8px_rgba(225,29,72,0.25)]";
      case "delivering":
        // المستلم: أصفر
        return "bg-gradient-to-l from-[#FFC107] to-amber-400 text-[#0B2E8C] font-black shadow-[0_2px_8px_rgba(245,158,11,0.25)]";
      case "delivered":
      default:
        // المسلم: اللون الحالي الأزرق
        return "bg-gradient-to-l from-[#0B2E8C] to-[#1E4DB7] text-white shadow-[0_2px_8px_rgba(11,46,140,0.2)]";
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#F0F4FF] text-[#0B2E8C] selection:bg-[#FFC107]/30 overflow-x-hidden -mx-3 sm:-mx-4 -my-4 p-0 font-sans"
      style={{ fontFamily: "'Tajawal', 'Cairo', system-ui, sans-serif" }}
    >
      {/* شريط الأمان العلوي */}
      <div className="h-[var(--safe-area-inset-top,0px)] bg-[#0B2E8C] w-full" />

      {/* رأس صفحة وصلي المميز */}
      <header className="sticky top-[var(--safe-area-inset-top,0px)] z-30 bg-[#F0F4FF]/90 backdrop-blur-xl border-b border-[#D0DDFB]/80 shadow-xs">
        <div className="mx-auto max-w-[500px] px-3.5 py-2.5 flex items-center justify-between w-full">
          {/* الشعار واسم وصلي (الطلب السادس: الشعار الرسمي لوصلي) */}
          <div className="flex items-center gap-2.5">
            <img
              src="/images/wasly-logo.png"
              alt="شعار وصلي الرسمي"
              className="w-10 h-10 object-contain rounded-full bg-white p-0.5 shadow-sm border border-[#D0DDFB] shrink-0"
            />
            <div>
              <div className="flex items-center gap-1">
                <h1 className="font-black text-[20px] leading-none tracking-tight text-[#0B2E8C]">
                  وصلي
                </h1>
                <span className="font-bold text-[#1E4DB7] text-[15px] font-mono">
                  Wasli
                </span>
              </div>
              <p className="text-[11px] font-bold text-[#1E4DB7]/70 mt-[2px] leading-none">
                توصيل سريع وآمن • راحتك أكثر
              </p>
            </div>
          </div>

          {/* الجانب الأيسر بالهيدر (الطلب الخامس: اسم المندوب بدلاً من زر الإشعارات والدائرة بحرف الاسم) */}
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-full bg-[#0B2E8C] text-white text-[12px] font-black flex items-center gap-1.5 shadow-xs border border-[#FFC107]/30">
              <span className="text-[#FFC107]">👤</span>
              <span className="truncate max-w-[120px]">{courierName || "المندوب"}</span>
            </div>
          </div>
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <main className="mx-auto max-w-[500px] px-3 pt-3 pb-8 w-full box-border">
        {/* الطلب الثاني: بلوكات الصادر والوارد والمتبقي والأرباح بحجم أصغر وتظهر جميعاً بالواجهة بدون سحب */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 w-full">
          {/* الصادر */}
          <div className="h-[62px] sm:h-[66px] rounded-[14px] bg-gradient-to-br from-[#1E4DB7] to-[#0B2E8C] p-2 flex flex-col justify-between relative overflow-hidden shadow-[0_2px_8px_rgba(11,46,140,0.18)]">
            <div className="flex justify-between items-center">
              <span className="text-white/90 text-[10px] sm:text-[11px] font-bold leading-none">
                الصادر
              </span>
              <div className="w-5 h-5 rounded-full bg-[#FFC107] flex items-center justify-center shrink-0">
                <Inbox className="w-3 h-3 text-[#0B2E8C]" strokeWidth={2.4} />
              </div>
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="font-mono font-black text-white text-[15px] sm:text-[17px] leading-none">
                {saderDisplay}
              </span>
              <span className="text-[9px] text-white/70 font-bold">ألف</span>
            </div>
            <Zap className="absolute -bottom-2 -left-2 w-10 h-10 text-white/10 fill-white/10 pointer-events-none" />
          </div>

          {/* الوارد */}
          <div className="h-[62px] sm:h-[66px] rounded-[14px] bg-[#1E4DB7] p-2 flex flex-col justify-between relative overflow-hidden shadow-[0_2px_8px_rgba(30,77,183,0.18)]">
            <div className="flex justify-between items-center">
              <span className="text-white/90 text-[10px] sm:text-[11px] font-bold leading-none">
                الوارد
              </span>
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Wallet className="w-3 h-3 text-white" />
              </div>
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="font-mono font-black text-white text-[15px] sm:text-[17px] leading-none">
                {wardDisplay}
              </span>
              <span className="text-[9px] text-white/70 font-bold">ألف</span>
            </div>
          </div>

          {/* المتبقي */}
          <div className="h-[62px] sm:h-[66px] rounded-[14px] bg-[#0A1F4D] p-2 flex flex-col justify-between relative overflow-hidden shadow-[0_2px_8px_rgba(10,31,77,0.2)]">
            <div className="flex justify-between items-center">
              <span className="text-white/80 text-[10px] sm:text-[11px] font-bold leading-none">
                المتبقي
              </span>
              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <Package className="w-3 h-3 text-white/80" />
              </div>
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="font-mono font-black text-white text-[15px] sm:text-[17px] leading-none">
                {remainingDisplay}
              </span>
              <span className="text-[9px] text-white/70 font-bold">ألف</span>
            </div>
          </div>

          {/* أرباحي */}
          <div className="h-[62px] sm:h-[66px] rounded-[14px] bg-[#0B2E8C] border-[1.5px] border-[#FFC107] p-2 flex flex-col justify-between relative overflow-hidden shadow-[0_2px_8px_rgba(11,46,140,0.2)]">
            <div className="flex justify-between items-center">
              <span className="text-white/90 text-[10px] sm:text-[11px] font-bold leading-none">
                أرباحي
              </span>
              <div className="w-5 h-5 rounded-full bg-[#FFC107] flex items-center justify-center shadow-xs shrink-0">
                <Zap className="w-3 h-3 text-[#0B2E8C] fill-[#0B2E8C]" />
              </div>
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="font-mono font-black text-[#FFC107] text-[15px] sm:text-[17px] leading-none">
                {earningsDisplay}
              </span>
              <span className="text-[9px] text-[#FFC107]/80 font-bold">ألف</span>
            </div>
          </div>
        </div>

        {/* شريط الأزرار التفاعلية السريعة */}
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          {/* كبسولة المحفظة */}
          <Link
            href={`/mandoub/wallet?${baseQuery.toString()}`}
            className="h-[40px] px-3.5 rounded-[12px] bg-white border border-[#D0DDFB] flex items-center gap-2 shadow-[0_2px_6px_rgba(11,46,140,0.06)] hover:border-[#0B2E8C]/30 active:scale-95 transition-transform"
            title="فتح المحفظة"
          >
            <div className="w-5 h-5 rounded-full bg-[#FFC107] flex items-center justify-center">
              <Wallet className="w-3 h-3 text-[#0B2E8C]" />
            </div>
            <span className="font-mono font-bold text-[12px] text-[#0B2E8C]">
              {cashInHandStr}
            </span>
            <span className="text-[10px] text-[#1E4DB7]/60 font-bold">د.ع</span>
          </Link>

          {/* زر التحديث */}
          <button
            type="button"
            onClick={handleRefresh}
            className="w-[40px] h-[40px] rounded-[12px] bg-white border border-[#D0DDFB] flex items-center justify-center shadow-xs active:scale-95 transition-transform cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw
              className={`w-4 h-4 text-[#0B2E8C] ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>

          {/* زر البحث */}
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className={`w-[40px] h-[40px] rounded-[12px] flex items-center justify-center shadow-xs active:scale-95 transition-all cursor-pointer ${
              showSearch
                ? "bg-[#0B2E8C] text-white"
                : "bg-white border border-[#D0DDFB] text-[#0B2E8C]"
            }`}
            title="بحث في الطلبات"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* زر الفلترة */}
          <button
            type="button"
            onClick={() => {
              const next =
                activeFilter === "all"
                  ? "assigned"
                  : activeFilter === "assigned"
                  ? "delivering"
                  : activeFilter === "delivering"
                  ? "delivered"
                  : "all";
              setActiveFilter(next);
              const label =
                next === "all"
                  ? "عرض الكل"
                  : next === "assigned"
                  ? "بانتظار الاستلام"
                  : next === "delivering"
                  ? "مستلمة (في الطريق)"
                  : "تم التسليم";
              showToast(`فلترة: ${label}`);
            }}
            className={`w-[40px] h-[40px] rounded-[12px] flex items-center justify-center shadow-xs active:scale-95 transition-all cursor-pointer ${
              activeFilter !== "all"
                ? "bg-[#0B2E8C] text-[#FFC107]"
                : "bg-white border border-[#D0DDFB] text-[#0B2E8C]"
            }`}
            title="تبديل فلتر الطلبات"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* زر التحديد السريع */}
          <button
            type="button"
            onClick={() => {
              if (showQuickSelect) {
                toggleAll();
              } else {
                setShowQuickSelect(true);
                showToast(`تم فتح التحديد السريع (${rows.length} طلب)`);
              }
            }}
            className={`w-[40px] h-[40px] rounded-[12px] flex items-center justify-center shadow-[0_2px_6px_rgba(255,193,7,0.35)] active:scale-95 transition-transform cursor-pointer ${
              allSelected
                ? "bg-rose-600 text-white"
                : "bg-[#FFC107] text-[#0B2E8C]"
            }`}
            title="تحديد الكل"
          >
            <Check className="w-4 h-4" strokeWidth={3} />
          </button>

          {/* زر الإعدادات */}
          <Link
            href={`/mandoub/settings?${baseQuery.toString()}`}
            className="w-[40px] h-[40px] rounded-[12px] bg-white border border-[#D0DDFB] flex items-center justify-center shadow-xs active:scale-95 transition-transform"
            title="الإعدادات"
          >
            <Settings className="w-4 h-4 text-[#0B2E8C]" />
          </Link>
        </div>

        {/* حقل البحث المنبثق لثيم وصلي */}
        {showSearch && (
          <div className="mt-2.5 animate-in fade-in slide-in-from-top-2">
            <div className="h-[44px] rounded-[12px] bg-white border border-[#1E4DB7]/20 flex items-center px-3 gap-2 shadow-[0_4px_12px_rgba(11,46,140,0.08)]">
              <Search className="w-4 h-4 text-[#1E4DB7]/50" />
              <input
                autoFocus
                value={qSearch}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="ابحث برقم الطلب، المحل، الزبون، أو الهاتف..."
                className="flex-1 bg-transparent outline-none text-[12px] font-bold text-[#0B2E8C] placeholder:text-[#1E4DB7]/40"
              />
              {qSearch && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800"
                >
                  مسح
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowSearch(false);
                  showToast("تم إغلاق البحث");
                }}
                className="text-[11px] font-bold text-[#1E4DB7] bg-[#F0F4FF] px-2.5 py-1 rounded-full cursor-pointer hover:bg-[#E8EEFF]"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}

        {/* شريط شارة التحديد السريع إن كان مفعلًا */}
        {showQuickSelect && (
          <div className="mt-2.5 p-2 rounded-[12px] bg-white border-2 border-[#FFC107] flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleAll}
                className="px-2.5 py-1 rounded-full bg-[#0B2E8C] text-white text-[11px] font-black"
              >
                {allSelected ? "إلغاء تحديد الكل" : "تحديد الكل"}
              </button>
              <span className="text-[11px] font-bold text-[#0B2E8C]">
                تم تحديد ({selectedIds.size}) من أصل ({rows.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowQuickSelect(false)}
              className="text-[12px] text-slate-400 hover:text-slate-700 px-2 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* شريط التاريخ وعدد الطلبات */}
        <div className="mt-3.5 h-[42px] rounded-[14px] bg-[#0B2E8C] flex items-center justify-between px-3 shadow-[0_3px_10px_rgba(11,46,140,0.22)] relative overflow-hidden w-full">
          <div className="absolute inset-0 bg-gradient-to-l from-[#1E4DB7]/30 to-transparent pointer-events-none" />
          <div className="flex items-center gap-2 relative z-10">
            <div className="w-6 h-6 rounded-full bg-[#FFC107] flex items-center justify-center shrink-0">
              <Calendar className="w-3.5 h-3.5 text-[#0B2E8C]" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-white text-[12px]">
              {todayArabic}
            </span>
            <span className="bg-white/15 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
              ({displayedRows.length} طلب)
            </span>
          </div>
          <div className="flex items-center gap-1 relative z-10 text-white/70">
            <Clock className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* قائمة بطاقات الطلبات بستايل وصلي */}
        <div className="mt-3 space-y-2.5 w-full">
          {displayedRows.length === 0 ? (
            <div className="rounded-[18px] bg-white border border-[#D0DDFB] p-8 text-center shadow-xs">
              <div className="w-12 h-12 rounded-full bg-[#F0F4FF] mx-auto flex items-center justify-center mb-2">
                <Package className="w-6 h-6 text-[#1E4DB7]/60" />
              </div>
              <p className="font-bold text-[14px] text-[#0B2E8C]">لا توجد طلبات في هذا العرض</p>
              <p className="text-[12px] text-[#1E4DB7]/60 mt-1">تأكد من الفلترة أو التبويب الحالي</p>
            </div>
          ) : (
            displayedRows.map((r) => {
              const isDelivering = r.orderStatus === "delivering";
              const isDelivered = r.orderStatus === "delivered";
              const isAssigned = r.orderStatus === "assigned";
              const isSelected = selectedIds.has(r.id);

              // استخراج قيمة السعر بالألف
              const rawPrice = r.totalAmountDinar
                ? Math.round(r.totalAmountDinar / 1000)
                : parseInt(r.priceStr.replace(/[^0-9]/g, ""), 10) || 0;

              // وقت الطلبية (الطلب الأول)
              const orderTimeText = r.timeLine || r.orderNoteTime || "الآن";

              return (
                <div
                  key={r.id}
                  onClick={() => {
                    // الطلب الثامن: عند النقر على البطاقة تُفتح صفحة/تفاصيل الطلب مباشرة
                    if (showQuickSelect) {
                      toggleOne(r.id);
                    } else {
                      onOpenRow(r.id);
                    }
                  }}
                  className={`group bg-white border-[1.5px] rounded-[18px] p-[12px] shadow-[0_3px_10px_rgba(11,46,140,0.06)] transition-all duration-200 cursor-pointer relative overflow-hidden w-full box-border hover:border-[#1E4DB7]/50 hover:shadow-[0_4px_14px_rgba(11,46,140,0.1)] active:scale-[0.99] ${
                    isSelected
                      ? "border-rose-500 ring-2 ring-rose-300"
                      : "border-[#D0DDFB]"
                  }`}
                >
                  {/* علامة مائية باهتة لأيقونة البرق */}
                  <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                    <Zap className="w-full h-full text-[#0B2E8C] fill-[#0B2E8C] -rotate-12" />
                  </div>

                  {/* الجزء العلوي للبطاقة: شريط المسار الملون (الطلب الرابع) ورقم الطلب */}
                  <div className="flex items-center justify-between gap-2 relative z-10">
                    {/* شريط المسار الملون حسب الحالة (الطلب الرابع) */}
                    <div className="flex-1 min-w-0 flex justify-start">
                      <div
                        className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full px-3 py-1.5 max-w-[85%] ${getRouteBadgeStyle(
                          r.orderStatus
                        )}`}
                      >
                        <Truck
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isDelivering ? "text-[#0B2E8C]" : "text-[#FFC107]"
                          }`}
                        />
                        <span className="truncate">
                          {r.shopName || "المحل"} إلى {r.regionLine || "الوجهة"}
                        </span>
                      </div>
                    </div>

                    {/* كبسولة رقم الطلب */}
                    <div className="shrink-0 h-[30px] bg-[#0B2E8C] rounded-[8px] px-2 py-0.5 shadow-xs flex items-center justify-center">
                      <span className="font-mono font-black text-[#FFC107] text-[12px] leading-none tracking-wide">
                        #{r.shortId || r.id.slice(-4)}
                      </span>
                    </div>
                  </div>

                  {/* الجزء الأوسط: تفاصيل الطلب، وقت الطلبية، ودائرة سعر الطلب (الطلب الأول، الثالث) */}
                  <div className="mt-3 flex items-center justify-between gap-3 relative z-10 min-h-[70px]">
                    <div className="flex-1 min-w-0 flex flex-col items-start gap-1.5">
                      {/* تفاصيل المحتويات والملاحظات */}
                      <div className="bg-[#E8EEFF] border border-[#D0DDFB] text-[#0B2E8C] text-[11px] font-bold rounded-[14px] px-3 py-1 max-w-[200px] truncate leading-tight">
                        {r.orderType || r.landmarkLine || "طلب توصيل"}
                      </div>

                      {/* الطلب الأول: وقت الطلبية متناسق مع الثيم بدلاً من مستلم بالطريق */}
                      <div className="h-[24px] px-2.5 rounded-full border border-[#D0DDFB] bg-[#F0F4FF] text-[#0B2E8C] text-[10px] font-black flex items-center gap-1 shrink-0 shadow-2xs">
                        <Clock className="w-3 h-3 text-[#1E4DB7]" />
                        <span>{orderTimeText}</span>
                      </div>
                    </div>

                    {/* الطلب الثالث: دائرة سعر الطلب الكبيرة نفسها تنفذ الاستلام والتسليم بدون الدائرة الصغيرة السفلية */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isAssigned) {
                          setPickupOrder(r);
                        } else if (isDelivering) {
                          setDeliveryOrder(r);
                        } else {
                          onOpenRow(r.id);
                        }
                      }}
                      className="shrink-0 relative flex items-center justify-center group/price cursor-pointer active:scale-95 transition-transform"
                      title={
                        isAssigned
                          ? "اضغط لتأكيد استلام الطلب"
                          : isDelivering
                          ? "اضغط لتأكيد تسليم الطلب"
                          : "اضغط لفتح الطلب"
                      }
                    >
                      <div className="w-[66px] h-[66px] rounded-full bg-[#0B2E8C] border-[3px] border-[#FFC107] flex items-center justify-center shadow-[0_4px_12px_rgba(11,46,140,0.22)] group-hover/price:shadow-[0_6px_16px_rgba(11,46,140,0.3)]">
                        <span className="font-mono font-black text-[#FFC107] text-[32px] leading-none tracking-tight">
                          {rawPrice}
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* شريط التواصل والاتصال السفلي */}
                  <div className="mt-2.5 h-[42px] rounded-[20px] bg-gradient-to-r from-[#E8EEFF] to-[#FFF8E1] border border-[#D0DDFB] flex items-center justify-between px-2 relative z-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                    {/* زر الاتصال السريع */}
                    <a
                      href={`tel:${r.customerPhone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 active:scale-95 transition-transform text-inherit"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#FFC107] flex items-center justify-center shadow-xs shrink-0">
                        <Phone
                          className="w-3 h-3 text-[#0B2E8C]"
                          fill="#0B2E8C"
                          strokeWidth={2.2}
                        />
                      </div>
                      <span className="font-mono font-black text-[12px] tracking-wide text-[#0B2E8C]">
                        {r.customerPhone || "لا يوجد رقم"}
                      </span>
                    </a>

                    {/* أزرار الاتصال الفرعية: خريطة، واتساب، نسخ/تنبيه */}
                    <div className="flex items-center gap-1.5">
                      {/* زر اللوكيشن */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const queryLoc = r.landmarkLine || r.regionLine || "";
                          window.open(
                            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                              queryLoc
                            )}`,
                            "_blank"
                          );
                        }}
                        className="w-6 h-6 rounded-full bg-[#0B2E8C] flex items-center justify-center shadow-xs active:scale-90 transition-transform hover:bg-[#1E4DB7] cursor-pointer"
                        title="موقع العميل"
                      >
                        <MapPin className="w-3 h-3 text-[#FFC107]" />
                      </button>

                      {/* زر واتساب */}
                      {r.customerPhone && (
                        <a
                          href={`https://wa.me/${r.customerPhone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="w-6 h-6 rounded-full bg-[#0B2E8C] flex items-center justify-center shadow-xs active:scale-90 transition-transform hover:bg-[#1E4DB7] text-white"
                          title="محادثة واتساب"
                        >
                          <MessageCircle className="w-3 h-3 text-[#FFC107]" />
                        </a>
                      )}

                      {/* زر نسخ رقم الهاتف / التنبيه */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (r.customerPhone) {
                            navigator.clipboard?.writeText(r.customerPhone);
                            showToast(`تم نسخ رقم الهاتف: ${r.customerPhone}`);
                          }
                        }}
                        className="w-6 h-6 rounded-full bg-white border border-[#D0DDFB] flex items-center justify-center shadow-2xs active:scale-90 transition-transform hover:border-[#0B2E8C]/30 cursor-pointer"
                        title="نسخ رقم الهاتف"
                      >
                        <Zap className="w-3 h-3 text-[#0B2E8C]" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* رسالة التنبيه العائمة (Toast) بستايل وصلي */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-[#0B2E8C] text-white px-4 py-2 rounded-full shadow-[0_6px_20px_rgba(11,46,140,0.35)] flex items-center gap-2 border border-[#FFC107]/40">
            <div className="w-4 h-4 rounded-full bg-[#FFC107] flex items-center justify-center shrink-0">
              <Zap className="w-2.5 h-2.5 text-[#0B2E8C] fill-[#0B2E8C]" />
            </div>
            <span className="font-bold text-[11px] whitespace-nowrap">
              {toastMessage}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
