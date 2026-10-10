"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Bell,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Inbox,
  MapPin,
  MessageCircle,
  Navigation,
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
import { formatDinarAsAlfWithUnit, formatDinarAsAlf } from "@/lib/money-alf";

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
  onToggleWasliTheme,
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
  const saderDisplay = moneyMetrics?.sumPickupOutDinar != null
    ? formatDinarAsAlf(moneyMetrics.sumPickupOutDinar)
    : `${totalCount}`;
  const wardDisplay = moneyMetrics?.sumDeliveryInDinar != null
    ? formatDinarAsAlf(moneyMetrics.sumDeliveryInDinar)
    : cashInHandStr;
  const remainingDisplay = moneyMetrics?.remainingNetDinar != null
    ? formatDinarAsAlf(moneyMetrics.remainingNetDinar)
    : "0";
  const earningsDisplay = moneyMetrics?.sumEarningsDinar != null
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
          {/* الشعار واسم وصلي */}
          <div className="flex items-center gap-2.5">
            <div className="relative w-10 h-10 rounded-full bg-[#FFC107] flex items-center justify-center shadow-[0_2px_8px_rgba(255,193,7,0.35)] shrink-0">
              <Zap className="w-5 h-5 text-[#0B2E8C] fill-[#0B2E8C]" strokeWidth={2.4} />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#0B2E8C] rounded-full border-2 border-white" />
            </div>
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

          {/* أزرار الإجراءات في الهيدر */}
          <div className="flex items-center gap-1.5">
            {/* زر الإشعارات */}
            <button
              type="button"
              onClick={() => showToast(`لديك ${totalCount} طلبات في هذا العرض`)}
              className="w-8 h-8 rounded-full bg-white border border-[#D0DDFB] flex items-center justify-center shadow-xs active:scale-90 transition-transform cursor-pointer"
              title="التنبيهات"
            >
              <Bell className="w-4 h-4 text-[#0B2E8C]" />
            </button>

            {/* شارة المندوب */}
            <div
              className="w-8 h-8 rounded-full bg-[#0B2E8C] flex items-center justify-center text-white font-black text-[12px] shadow-xs"
              title={`المندوب: ${courierName}`}
            >
              {courierName ? courierName.slice(0, 1) : "م"}
            </div>
          </div>
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <main className="mx-auto max-w-[500px] px-3 pt-3.5 pb-28 w-full box-border">
        {/* شريط الإحصائيات الأفقية التمريرية (الهوية الأصلية لوصلي) */}
        <div className="flex gap-2.5 overflow-x-auto pb-2 px-0.5 w-full no-scrollbar">
          {/* الصادر */}
          <div className="min-w-[130px] h-[76px] rounded-[16px] bg-gradient-to-br from-[#1E4DB7] to-[#0B2E8C] p-[13px] flex flex-col justify-between relative overflow-hidden shadow-[0_4px_14px_rgba(11,46,140,0.22)] shrink-0">
            <div className="flex justify-between items-start">
              <span className="text-white/90 text-[12px] font-bold">الصادر</span>
              <div className="w-6 h-6 rounded-full bg-[#FFC107] flex items-center justify-center">
                <Inbox className="w-3.5 h-3.5 text-[#0B2E8C]" strokeWidth={2.4} />
              </div>
            </div>
            <div className="flex items-end gap-1">
              <span className="font-mono font-black text-white text-[20px] leading-none">
                {saderDisplay}
              </span>
              <span className="text-[10px] text-white/70 font-bold mb-[1px]">ألف</span>
            </div>
            <Zap className="absolute -bottom-2 -left-2 w-14 h-14 text-white/10 fill-white/10 pointer-events-none" />
          </div>

          {/* الوارد */}
          <div className="min-w-[130px] h-[76px] rounded-[16px] bg-[#1E4DB7] p-[13px] flex flex-col justify-between relative overflow-hidden shadow-[0_4px_14px_rgba(30,77,183,0.18)] shrink-0">
            <div className="flex justify-between items-start">
              <span className="text-white/90 text-[12px] font-bold">الوارد</span>
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <Wallet className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <div className="flex items-end gap-1">
              <span className="font-mono font-black text-white text-[20px] leading-none">
                {wardDisplay}
              </span>
              <span className="text-[10px] text-white/70 font-bold mb-[1px]">ألف</span>
            </div>
          </div>

          {/* المتبقي */}
          <div className="min-w-[130px] h-[76px] rounded-[16px] bg-[#0A1F4D] p-[13px] flex flex-col justify-between relative overflow-hidden shadow-[0_4px_14px_rgba(10,31,77,0.25)] shrink-0">
            <div className="flex justify-between items-start">
              <span className="text-white/80 text-[12px] font-bold">المتبقي</span>
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                <Package className="w-3.5 h-3.5 text-white/80" />
              </div>
            </div>
            <div className="flex items-end gap-1">
              <span className="font-mono font-black text-white text-[20px] leading-none">
                {remainingDisplay}
              </span>
              <span className="text-[10px] text-white/70 font-bold mb-[1px]">ألف</span>
            </div>
          </div>

          {/* أرباحي */}
          <div className="min-w-[130px] h-[76px] rounded-[16px] bg-[#0B2E8C] border-[2px] border-[#FFC107] p-[13px] flex flex-col justify-between relative overflow-hidden shadow-[0_4px_14px_rgba(11,46,140,0.25)] shrink-0">
            <div className="flex justify-between items-start">
              <span className="text-white/90 text-[12px] font-bold">أرباحي</span>
              <div className="w-6 h-6 rounded-full bg-[#FFC107] flex items-center justify-center shadow-[0_2px_6px_rgba(255,193,7,0.4)]">
                <Zap className="w-3.5 h-3.5 text-[#0B2E8C] fill-[#0B2E8C]" />
              </div>
            </div>
            <div className="flex items-end gap-1">
              <span className="font-mono font-black text-[#FFC107] text-[20px] leading-none">
                {earningsDisplay}
              </span>
              <span className="text-[10px] text-[#FFC107]/80 font-bold mb-[1px]">ألف</span>
            </div>
          </div>
        </div>

        {/* شريط الأزرار التفاعلية السريعة */}
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          {/* كبسولة المحفظة */}
          <Link
            href={`/mandoub/wallet?${baseQuery.toString()}`}
            className="h-[42px] px-3.5 rounded-[14px] bg-white border border-[#D0DDFB] flex items-center gap-2 shadow-[0_2px_8px_rgba(11,46,140,0.06)] hover:border-[#0B2E8C]/30 active:scale-95 transition-transform"
            title="فتح المحفظة"
          >
            <div className="w-6 h-6 rounded-full bg-[#FFC107] flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5 text-[#0B2E8C]" />
            </div>
            <span className="font-mono font-bold text-[13px] text-[#0B2E8C]">
              {cashInHandStr}
            </span>
            <span className="text-[11px] text-[#1E4DB7]/60 font-bold">د.ع</span>
          </Link>

          {/* كبسولة اسم المندوب */}
          <div className="h-[42px] px-3.5 rounded-[14px] bg-[#0B2E8C] flex items-center gap-2 shadow-[0_4px_10px_rgba(11,46,140,0.2)]">
            <div className="w-6 h-6 rounded-full bg-[#FFC107] flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-[#0B2E8C]" />
            </div>
            <span className="font-bold text-white text-[13px] truncate max-w-[90px]">
              {courierName || "المندوب"}
            </span>
          </div>

          {/* زر التحديث */}
          <button
            type="button"
            onClick={handleRefresh}
            className="w-[42px] h-[42px] rounded-[14px] bg-white border border-[#D0DDFB] flex items-center justify-center shadow-xs active:scale-95 transition-transform cursor-pointer"
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
            className={`w-[42px] h-[42px] rounded-[14px] flex items-center justify-center shadow-xs active:scale-95 transition-all cursor-pointer ${
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
            className={`w-[42px] h-[42px] rounded-[14px] flex items-center justify-center shadow-xs active:scale-95 transition-all cursor-pointer ${
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
            className={`w-[42px] h-[42px] rounded-[14px] flex items-center justify-center shadow-[0_2px_8px_rgba(255,193,7,0.35)] active:scale-95 transition-transform cursor-pointer ${
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
            className="w-[42px] h-[42px] rounded-[14px] bg-white border border-[#D0DDFB] flex items-center justify-center shadow-xs active:scale-95 transition-transform"
            title="الإعدادات"
          >
            <Settings className="w-4 h-4 text-[#0B2E8C]" />
          </Link>
        </div>

        {/* حقل البحث المنبثق لثيم وصلي */}
        {showSearch && (
          <div className="mt-3 animate-in fade-in slide-in-from-top-2">
            <div className="h-[46px] rounded-[14px] bg-white border border-[#1E4DB7]/20 flex items-center px-3.5 gap-2.5 shadow-[0_4px_12px_rgba(11,46,140,0.08)]">
              <Search className="w-4 h-4 text-[#1E4DB7]/50" />
              <input
                autoFocus
                value={qSearch}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="ابحث برقم الطلب، المحل، الزبون، أو الهاتف..."
                className="flex-1 bg-transparent outline-none text-[13px] font-bold text-[#0B2E8C] placeholder:text-[#1E4DB7]/40"
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
          <div className="mt-3 p-2.5 rounded-[14px] bg-white border-2 border-[#FFC107] flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleAll}
                className="px-3 py-1 rounded-full bg-[#0B2E8C] text-white text-[11px] font-black"
              >
                {allSelected ? "إلغاء تحديد الكل" : "تحديد الكل"}
              </button>
              <span className="text-[12px] font-bold text-[#0B2E8C]">
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
        <div className="mt-4 h-[46px] rounded-[16px] bg-[#0B2E8C] flex items-center justify-between px-3.5 shadow-[0_4px_14px_rgba(11,46,140,0.25)] relative overflow-hidden w-full">
          <div className="absolute inset-0 bg-gradient-to-l from-[#1E4DB7]/30 to-transparent pointer-events-none" />
          <div className="flex items-center gap-2 relative z-10">
            <div className="w-7 h-7 rounded-full bg-[#FFC107] flex items-center justify-center shrink-0">
              <Calendar className="w-3.5 h-3.5 text-[#0B2E8C]" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-white text-[12px] sm:text-[13px]">
              {todayArabic}
            </span>
            <span className="bg-white/15 text-white text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-full">
              ({displayedRows.length} طلب)
            </span>
          </div>
          <div className="flex items-center gap-1.5 relative z-10 text-white/70">
            <Clock className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* قائمة بطاقات الطلبات بستايل وصلي الفاخر */}
        <div className="mt-3.5 space-y-3 w-full">
          {displayedRows.length === 0 ? (
            <div className="rounded-[20px] bg-white border border-[#D0DDFB] p-8 text-center shadow-xs">
              <div className="w-12 h-12 rounded-full bg-[#F0F4FF] mx-auto flex items-center justify-center mb-2">
                <Package className="w-6 h-6 text-[#1E4DB7]/60" />
              </div>
              <p className="font-bold text-[14px] text-[#0B2E8C]">لا توجد طلبات في هذا العرض</p>
              <p className="text-[12px] text-[#1E4DB7]/60 mt-1">تأكد من الفلترة أو التبويب الحالي</p>
            </div>
          ) : (
            displayedRows.map((r) => {
              const isExpanded = expandedId === r.id;
              const isDelivering = r.orderStatus === "delivering";
              const isDelivered = r.orderStatus === "delivered";
              const isAssigned = r.orderStatus === "assigned";
              const isUrgent = r.orderType?.includes("فوري") || r.orderType?.includes("سريع");
              const isSelected = selectedIds.has(r.id);

              // استخراج قيمة السعر بالألف
              const rawPrice = r.totalAmountDinar
                ? Math.round(r.totalAmountDinar / 1000)
                : parseInt(r.priceStr.replace(/[^0-9]/g, ""), 10) || 0;

              return (
                <div
                  key={r.id}
                  onClick={() => {
                    if (showQuickSelect) {
                      toggleOne(r.id);
                    } else {
                      setExpandedId(isExpanded ? null : r.id);
                    }
                  }}
                  className={`group bg-white border-[1.5px] rounded-[20px] p-[13px] shadow-[0_4px_12px_rgba(11,46,140,0.08)] transition-all duration-300 cursor-pointer relative overflow-hidden w-full box-border ${
                    isSelected
                      ? "border-rose-500 ring-2 ring-rose-300"
                      : isExpanded
                      ? "border-[#0B2E8C] shadow-[0_8px_24px_rgba(11,46,140,0.15)] scale-[1.01]"
                      : "border-[#D0DDFB] hover:border-[#1E4DB7]/40 hover:shadow-[0_6px_16px_rgba(11,46,140,0.12)]"
                  }`}
                >
                  {/* علامة مائية باهتة لأيقونة البرق */}
                  <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none opacity-[0.04] group-hover:opacity-[0.08] transition-opacity">
                    <Zap className="w-full h-full text-[#0B2E8C] fill-[#0B2E8C] -rotate-12" />
                  </div>

                  {/* الجزء العلوي للبطاقة: شريط المسار ورقم الطلب */}
                  <div className="flex items-center justify-between gap-2 relative z-10">
                    {/* شريط المسار */}
                    <div className="flex-1 min-w-0 flex justify-start">
                      <div className="inline-flex items-center gap-1.5 bg-gradient-to-l from-[#0B2E8C] to-[#1E4DB7] text-white text-[11px] font-bold rounded-full px-3 py-1.5 max-w-[85%] shadow-[0_2px_8px_rgba(11,46,140,0.2)]">
                        <Truck className="w-3.5 h-3.5 shrink-0 text-[#FFC107]" />
                        <span className="truncate">
                          {r.shopName || "المحل"} إلى {r.regionLine || "الوجهة"}
                        </span>
                      </div>
                    </div>

                    {/* كبسولة رقم الطلب */}
                    <div className="shrink-0 h-[32px] bg-[#0B2E8C] rounded-[10px] px-2.5 py-1 shadow-[0_2px_8px_rgba(11,46,140,0.18)] flex items-center justify-center">
                      <span className="font-mono font-black text-[#FFC107] text-[13px] leading-none tracking-wide">
                        #{r.shortId || r.id.slice(-4)}
                      </span>
                    </div>
                  </div>

                  {/* الجزء الأوسط: التفاصيل، شارة الحالة، والدائرة السعرية الكبيرة */}
                  <div className="mt-3.5 flex items-center justify-between gap-3 relative z-10 min-h-[76px]">
                    <div className="flex-1 min-w-0 flex flex-col items-start gap-2">
                      {/* تفاصيل المحتويات والملاحظات */}
                      <div className="bg-[#E8EEFF] border border-[#D0DDFB] text-[#0B2E8C] text-[12px] font-bold rounded-[20px] px-3.5 py-1.5 max-w-[200px] truncate leading-tight">
                        {r.orderType || r.landmarkLine || "طلب توصيل"}
                      </div>

                      {/* شارة حالة الطلب */}
                      <div
                        className={`h-[24px] px-3 rounded-full border text-[11px] font-black flex items-center justify-center shrink-0 ${
                          isDelivered
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : isDelivering
                            ? "bg-[#FFF0F0] border-[#FFB3B3] text-[#C53030]"
                            : isUrgent
                            ? "bg-[#FFF0F0] border-[#FFB3B3] text-[#C53030]"
                            : "bg-[#FFF8E1] border-[#FFE082] text-[#7A5A00]"
                        }`}
                      >
                        {isDelivered
                          ? "تم التسليم ✓"
                          : isDelivering
                          ? "مستلم (في الطريق)"
                          : isAssigned
                          ? "لم يتم الاستلام"
                          : r.statusAr}
                      </div>
                    </div>

                    {/* الدائرة السعرية الكبيرة الأيقونية لوصلي */}
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
                      className="shrink-0 relative flex items-center justify-center group/price cursor-pointer"
                      title={
                        isAssigned
                          ? "اضغط لتأكيد استلام الطلب"
                          : isDelivering
                          ? "اضغط لتأكيد تسليم الطلب"
                          : "اضغط للتفاصيل"
                      }
                    >
                      <div className="w-[68px] h-[68px] rounded-full bg-[#0B2E8C] border-[3px] border-[#FFC107] flex items-center justify-center shadow-[0_4px_12px_rgba(11,46,140,0.25)] group-active/price:scale-95 transition-transform group-hover/price:shadow-[0_6px_18px_rgba(11,46,140,0.35)]">
                        <span className="font-mono font-black text-[#FFC107] text-[34px] leading-none tracking-tight">
                          {rawPrice}
                        </span>
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-[20px] h-[20px] rounded-full bg-[#FFC107] flex items-center justify-center shadow-[0_2px_6px_rgba(255,193,7,0.4)] border-2 border-white">
                        <Zap className="w-[10px] h-[10px] text-[#0B2E8C] fill-[#0B2E8C]" />
                      </div>
                    </button>
                  </div>

                  {/* التفاصيل القابلة للتوسيع (Accordion) */}
                  <div
                    className={`grid transition-all duration-300 ease-out ${
                      isExpanded
                        ? "grid-rows-[1fr] opacity-100 mt-3"
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="bg-[#F8FAFF] rounded-[14px] border border-[#D0DDFB]/70 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#1E4DB7]/60">
                            العميل:
                          </span>
                          <span className="text-[13px] font-bold text-[#0B2E8C]">
                            {r.customerName || "غير محدد"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#1E4DB7]/60">
                            العنوان التفصيلي:
                          </span>
                          <span className="text-[12px] font-bold text-[#0B2E8C] max-w-[65%] text-left truncate">
                            {r.landmarkLine || r.regionLine || "لا توجد تفاصيل"}
                          </span>
                        </div>

                        {/* أزرار الإجراءات في القسم المنسدل */}
                        <div className="flex gap-2 pt-1">
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
                            className="flex-1 h-9 rounded-full bg-[#0B2E8C] text-white font-bold text-[12px] flex items-center justify-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
                          >
                            <Navigation className="w-3.5 h-3.5 text-[#FFC107]" />
                            <span>فتح الخريطة</span>
                          </button>

                          {isAssigned && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPickupOrder(r);
                              }}
                              className="flex-1 h-9 rounded-full bg-[#FFC107] text-[#0B2E8C] font-black text-[12px] flex items-center justify-center gap-1.5 active:scale-95 transition-transform shadow-[0_2px_8px_rgba(255,193,7,0.35)] cursor-pointer"
                            >
                              تأكيد الاستلام
                            </button>
                          )}

                          {isDelivering && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeliveryOrder(r);
                              }}
                              className="flex-1 h-9 rounded-full bg-emerald-600 text-white font-black text-[12px] flex items-center justify-center gap-1.5 active:scale-95 transition-transform shadow-xs cursor-pointer"
                            >
                              تأكيد التسليم
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenRow(r.id);
                            }}
                            className="h-9 px-3 rounded-full bg-white border border-[#D0DDFB] text-[#0B2E8C] font-bold text-[12px] active:scale-95 transition-transform cursor-pointer"
                            title="كل التفاصيل والخيارات المتقدمة"
                          >
                            كل التفاصيل
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* شريط التواصل السفلي الفاخر لثيم وصلي */}
                  <div className="mt-3 h-[46px] rounded-[24px] bg-gradient-to-r from-[#E8EEFF] to-[#FFF8E1] border border-[#D0DDFB] flex items-center justify-between px-2.5 relative z-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                    {/* زر الاتصال السريع */}
                    <a
                      href={`tel:${r.customerPhone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 active:scale-95 transition-transform text-inherit"
                    >
                      <div className="w-7 h-7 rounded-full bg-[#FFC107] flex items-center justify-center shadow-[0_2px_6px_rgba(255,193,7,0.35)] shrink-0">
                        <Phone
                          className="w-3.5 h-3.5 text-[#0B2E8C]"
                          fill="#0B2E8C"
                          strokeWidth={2.2}
                        />
                      </div>
                      <span className="font-mono font-black text-[13px] tracking-wide text-[#0B2E8C]">
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
                        className="w-7 h-7 rounded-full bg-[#0B2E8C] flex items-center justify-center shadow-[0_2px_6px_rgba(11,46,140,0.2)] active:scale-90 transition-transform hover:bg-[#1E4DB7] cursor-pointer"
                        title="موقع العميل"
                      >
                        <MapPin className="w-3.5 h-3.5 text-[#FFC107]" />
                      </button>

                      {/* زر واتساب */}
                      {r.customerPhone && (
                        <a
                          href={`https://wa.me/${r.customerPhone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="w-7 h-7 rounded-full bg-[#0B2E8C] flex items-center justify-center shadow-[0_2px_6px_rgba(11,46,140,0.2)] active:scale-90 transition-transform hover:bg-[#1E4DB7] text-white"
                          title="محادثة واتساب"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-[#FFC107]" />
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
                        className="w-7 h-7 rounded-full bg-white border border-[#D0DDFB] flex items-center justify-center shadow-xs active:scale-90 transition-transform hover:border-[#0B2E8C]/30 cursor-pointer"
                        title="نسخ رقم الهاتف"
                      >
                        <Bell className="w-3.5 h-3.5 text-[#0B2E8C]" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* كرت نظام وصلي الذكي الإرشادي */}
        <div className="mt-6 rounded-[16px] bg-white border border-dashed border-[#D0DDFB] p-3.5 flex items-center gap-3 w-full box-border">
          <div className="w-9 h-9 rounded-full bg-[#F0F4FF] flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-[#1E4DB7]" />
          </div>
          <div>
            <p className="font-bold text-[13px] text-[#0B2E8C]">نظام وصلي الذكي</p>
            <p className="text-[11px] font-bold text-[#1E4DB7]/60 mt-0.5">
              اضغط على البطاقة للتفاصيل • اضغط على دائرة السعر لتأكيد الاستلام أو التسليم
            </p>
          </div>
        </div>

        {/* تذييل وصلي */}
        <div className="mt-6 text-center">
          <p className="text-[11px] font-bold text-[#1E4DB7]/40">
            وصلي - راحتك أكثر، تعبك يصغر • إصدار 2.1
          </p>
        </div>
      </main>

      {/* الشريط العائم السفلي لوصلي (Floating Bar) */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 max-w-[480px] w-[calc(100%-20px)] z-30">
        <div className="h-[52px] rounded-full bg-[#0B2E8C] shadow-[0_8px_24px_rgba(11,46,140,0.35)] flex items-center justify-between px-2.5">
          <div className="flex items-center gap-2.5 pr-1">
            <div className="w-8 h-8 rounded-full bg-[#FFC107] flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4 text-[#0B2E8C]" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-white font-black text-[12px] leading-none">
                {displayedRows.length} طلب نشط
              </p>
              <p className="text-white/60 font-bold text-[10px] mt-0.5">
                وصلي • متابعة مستمرة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            className="h-[38px] px-4 rounded-full bg-[#FFC107] text-[#0B2E8C] font-black text-[12px] flex items-center gap-1.5 active:scale-95 transition-transform shadow-[0_2px_8px_rgba(255,193,7,0.4)] cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>تحديث الطلبات</span>
          </button>
        </div>
      </div>

      {/* رسالة التنبيه العائمة (Toast) بستايل وصلي */}
      {toastMessage && (
        <div className="fixed bottom-[74px] left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-[#0B2E8C] text-white px-4 py-2.5 rounded-full shadow-[0_8px_24px_rgba(11,46,140,0.35)] flex items-center gap-2 border border-[#FFC107]/40">
            <div className="w-5 h-5 rounded-full bg-[#FFC107] flex items-center justify-center shrink-0">
              <Zap className="w-3 h-3 text-[#0B2E8C] fill-[#0B2E8C]" />
            </div>
            <span className="font-bold text-[12px] whitespace-nowrap">
              {toastMessage}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
