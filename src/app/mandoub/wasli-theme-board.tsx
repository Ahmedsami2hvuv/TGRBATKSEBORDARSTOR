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
  Truck,
  Wallet,
  Zap,
  ArrowUpDown,
  Camera,
  X,
  ExternalLink,
  ChevronUp,
  ChevronDown,
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
  onToggleWasliTheme?: () => void;
  onOpenRow: (id: string) => void;
  setPickupOrder: (row: MandoubRow) => void;
  setDeliveryOrder: (row: MandoubRow) => void;
  showQuickSelect: boolean;
  setShowQuickSelect: React.Dispatch<React.SetStateAction<boolean>> | ((v: boolean) => void);
  selectedIds: Set<string>;
  toggleOne: (id: string) => void;
  toggleAll: () => void;
  allSelected: boolean;
  qSearch: string;
  onSearchChange: (q: string) => void;
  showSearch: boolean;
  setShowSearch: React.Dispatch<React.SetStateAction<boolean>> | ((v: boolean) => void);
  isSortingMode?: boolean;
  setIsSortingMode?: React.Dispatch<React.SetStateAction<boolean>> | ((v: boolean) => void);
  moveRow?: (id: string, direction: "up" | "down") => void;
  smartSortByRegion?: () => void;
  resetSortOrder?: () => void;
};

// دالة ذكية وشاملة لاستخراج السعر الكلي الحقيقي للطلب بالألف دون أن يظهر 0
function extractCardDisplayPrice(r: MandoubRow): string {
  // 1. إذا كان إجمالي المبلغ متوفراً في totalAmountDinar
  if (r.totalAmountDinar != null && !isNaN(Number(r.totalAmountDinar))) {
    const val = Number(r.totalAmountDinar);
    if (val > 0) {
      if (val >= 500) {
        return `${Math.round(val / 1000)}`;
      }
      return `${val}`;
    }
  }

  // 2. إذا كان priceStr متوفراً
  if (r.priceStr && r.priceStr !== "-" && r.priceStr !== "—") {
    const cleaned = r.priceStr
      .replace(/ألف|دينار|الف|د\.ع/g, "")
      .replace(/,/g, ".")
      .replace(/[^\d.]/g, "")
      .replace(/\.$/, "")
      .trim();
    if (cleaned && !isNaN(Number(cleaned)) && Number(cleaned) > 0) {
      const num = Number(cleaned);
      if (num >= 500) return `${Math.round(num / 1000)}`;
      return `${num}`;
    }
    return r.priceStr;
  }

  // 3. جمع سعر البضاعة وسعر التوصيل كخيار احتياطي
  const sub = Number(r.orderSubtotalDinar || 0);
  const del = Number(r.deliveryPriceDinar || 0);
  const sum = sub + del;
  if (sum > 0) {
    if (sum >= 500) return `${Math.round(sum / 1000)}`;
    return `${sum}`;
  }

  return "0";
}

// دالة تحويل الرقم العراقي إلى صيغة واتساب الدولية المضمونة
function toInternationalWhatsApp(raw: string | null | undefined): string {
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00964")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("964")) {
    // يحتوي بالفعل على رمز الدولة
  } else if (digits.startsWith("07")) {
    digits = "964" + digits.slice(1);
  } else if (digits.startsWith("7")) {
    digits = "964" + digits;
  }
  return `https://wa.me/${digits}`;
}

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
  isSortingMode = false,
  setIsSortingMode,
  moveRow,
  smartSortByRegion,
  resetSortOrder,
}: WasliThemeBoardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "assigned" | "delivering" | "delivered">("all");

  // نوافذ الخيارات السريعة للاتصال، واتساب، اللوكيشن، وصور الأبواب
  const [actionModal, setActionModal] = useState<{
    type: "call" | "whatsapp" | "location" | "doorPhoto";
    row: MandoubRow;
  } | null>(null);

  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<{ url: string; title: string } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const baseQuery = new URLSearchParams();
  if (auth.c) baseQuery.set("c", auth.c);
  if (auth.exp) baseQuery.set("exp", auth.exp);
  if (auth.s) baseQuery.set("s", auth.s);

  // حساب الإحصائيات للملخص العلوي
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

  // تلوين بلوك اسم المحل والمنطقة حسب الحالة (الطلب الرابع)
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
          {/* الشعار واسم وصلي (الشعار الرسمي) */}
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

          {/* اسم المندوب في الهيدر */}
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-full bg-[#0B2E8C] text-white text-[12px] font-black flex items-center gap-1.5 shadow-xs border border-[#FFC107]/30">
              <span className="text-[#FFC107]">👤</span>
              <span className="truncate max-w-[120px]">{courierName || "المندوب"}</span>
            </div>
          </div>
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <main className="mx-auto max-w-[500px] px-3 pt-3 pb-16 w-full box-border">
        {/* بلوكات الصادر والوارد والمتبقي والأرباح بحجم أصغر وتظهر جميعاً بالواجهة بدون سحب */}
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

        {/* شريط الأزرار التفاعلية السريعة:
            - أزرار العمليات (الإعدادات على اليمين، تحديث، بحث، تحديد، تحريك)
            - المحفظة في اليسار
        */}
        <div className="mt-3 flex items-center justify-between gap-1.5 w-full">
          {/* الجانب الأيمن: زر الإعدادات وأدوات العمليات والتحريك */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* زر الإعدادات على اليمين */}
            <Link
              href={`/mandoub/settings?${baseQuery.toString()}`}
              className="w-[38px] h-[38px] rounded-[12px] bg-white border border-[#D0DDFB] flex items-center justify-center shadow-xs active:scale-95 transition-transform shrink-0"
              title="إعدادات التطبيق"
            >
              <Settings className="w-4 h-4 text-[#0B2E8C]" />
            </Link>

            {/* زر التحديث */}
            <button
              type="button"
              onClick={handleRefresh}
              className="w-[38px] h-[38px] rounded-[12px] bg-white border border-[#D0DDFB] flex items-center justify-center shadow-xs active:scale-95 transition-transform cursor-pointer"
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
              className={`w-[38px] h-[38px] rounded-[12px] flex items-center justify-center shadow-xs active:scale-95 transition-all cursor-pointer ${
                showSearch
                  ? "bg-[#0B2E8C] text-white"
                  : "bg-white border border-[#D0DDFB] text-[#0B2E8C]"
              }`}
              title="بحث في الطلبات"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* زر التحديد (أبيض مثل البلوكات التي بجانبه) */}
            <button
              type="button"
              onClick={() => {
                if (!showQuickSelect) {
                  if (typeof setShowQuickSelect === "function") {
                    setShowQuickSelect(true);
                  }
                  showToast(`تم تفعيل التحديد السريع (${rows.length} طلب)`);
                } else {
                  toggleAll();
                }
              }}
              className={`w-[38px] h-[38px] rounded-[12px] flex items-center justify-center shadow-xs active:scale-95 transition-transform cursor-pointer ${
                showQuickSelect
                  ? "bg-[#0B2E8C] text-white border border-[#0B2E8C]"
                  : "bg-white border border-[#D0DDFB] text-[#0B2E8C]"
              }`}
              title={showQuickSelect ? "تحديد / إلغاء تحديد الكل" : "تفعيل نمط التحديد"}
            >
              <Check className="w-4 h-4" strokeWidth={2.5} />
            </button>

            {/* زر تحريك الطلبات (إرجاع زر تحريك الطلبات) */}
            {setIsSortingMode && (
              <button
                type="button"
                onClick={() => {
                  setIsSortingMode(!isSortingMode);
                  showToast(!isSortingMode ? "تم تفعيل وضع ترتيب المسار ⇅" : "تم إيقاف وضع الترتيب");
                }}
                className={`w-[38px] h-[38px] rounded-[12px] flex items-center justify-center shadow-xs active:scale-95 transition-all cursor-pointer ${
                  isSortingMode
                    ? "bg-amber-600 border border-amber-500 text-white animate-pulse"
                    : "bg-white border border-[#D0DDFB] text-[#0B2E8C]"
                }`}
                title="ترتيب وتحريك الطلبات"
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* الجانب الأيسر: كبسولة المحفظة فقط */}
          <div className="flex items-center gap-1.5 ms-auto">
            <Link
              href={`/mandoub/wallet?${baseQuery.toString()}`}
              className="h-[38px] px-2.5 sm:px-3 rounded-[12px] bg-white border border-[#D0DDFB] flex items-center gap-1.5 shadow-[0_2px_6px_rgba(11,46,140,0.06)] hover:border-[#0B2E8C]/30 active:scale-95 transition-transform"
              title="فتح المحفظة"
            >
              <div className="w-5 h-5 rounded-full bg-[#FFC107] flex items-center justify-center shrink-0">
                <Wallet className="w-3 h-3 text-[#0B2E8C]" />
              </div>
              <span className="font-mono font-bold text-[12px] text-[#0B2E8C]">
                {cashInHandStr}
              </span>
              <span className="text-[10px] text-[#1E4DB7]/60 font-bold">د.ع</span>
            </Link>
          </div>
        </div>

        {/* شريط أدوات الترتيب الذكي عند تفعيل وضع الترتيب */}
        {isSortingMode && (
          <div className="mt-2.5 p-2 rounded-[14px] bg-amber-50 border border-amber-200 flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              {smartSortByRegion && (
                <button
                  type="button"
                  onClick={smartSortByRegion}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] shadow-xs active:scale-95"
                >
                  ترتيب ذكي حسب المنطقة
                </button>
              )}
              {resetSortOrder && (
                <button
                  type="button"
                  onClick={resetSortOrder}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-[11px] active:scale-95"
                >
                  الترتيب الأصلي
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsSortingMode && setIsSortingMode(false)}
              className="text-[11px] font-bold text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded-md"
            >
              تم
            </button>
          </div>
        )}

        {/* حقل البحث المنبثق لثيم وصلي */}
        {showSearch && (
          <div className="mt-2 animate-in fade-in slide-in-from-top-2">
            <div className="h-[42px] rounded-[12px] bg-white border border-[#1E4DB7]/20 flex items-center px-3 gap-2 shadow-[0_4px_12px_rgba(11,46,140,0.08)]">
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
                  if (typeof setShowSearch === "function") {
                    setShowSearch(false);
                  }
                  showToast("تم إغلاق البحث");
                }}
                className="text-[11px] font-bold text-[#1E4DB7] bg-[#F0F4FF] px-2.5 py-0.5 rounded-full cursor-pointer hover:bg-[#E8EEFF]"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}

        {/* شريط شارة التحديد السريع إن كان مفعلًا */}
        {showQuickSelect && (
          <div className="mt-2 p-2 rounded-[12px] bg-white border-2 border-[#FFC107] flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
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
              onClick={() => {
                if (typeof setShowQuickSelect === "function") {
                  setShowQuickSelect(false);
                }
              }}
              className="text-[12px] text-slate-400 hover:text-slate-700 px-2 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* شريط التاريخ وعدد الطلبات */}
        <div className="mt-3 h-[40px] rounded-[14px] bg-[#0B2E8C] flex items-center justify-between px-3 shadow-[0_3px_10px_rgba(11,46,140,0.22)] relative overflow-hidden w-full">
          <div className="absolute inset-0 bg-gradient-to-l from-[#1E4DB7]/30 to-transparent pointer-events-none" />
          <div className="flex items-center gap-2 relative z-10">
            <div className="w-5 h-5 rounded-full bg-[#FFC107] flex items-center justify-center shrink-0">
              <Calendar className="w-3 h-3 text-[#0B2E8C]" strokeWidth={2.5} />
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
        <div className="mt-2.5 space-y-2.5 w-full">
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

              // استخراج سعر الطلب الكلي الحقيقي بدقة تامة
              const displayPriceValue = extractCardDisplayPrice(r);

              // وقت الطلبية
              const orderTimeText = r.timeLine || r.orderNoteTime || "اليوم";

              return (
                <div
                  key={r.id}
                  onClick={() => {
                    // عند النقر على البطاقة تُفتح تفاصيل الطلب مباشرة
                    if (showQuickSelect) {
                      toggleOne(r.id);
                    } else {
                      onOpenRow(r.id);
                    }
                  }}
                  className={`group bg-white border-[1.5px] rounded-[18px] p-[12px] shadow-[0_3px_10px_rgba(11,46,140,0.06)] transition-all duration-200 cursor-pointer relative overflow-hidden w-full box-border hover:border-[#1E4DB7]/50 hover:shadow-[0_4px_14px_rgba(11,46,140,0.1)] active:scale-[0.99] ${
                    isSelected
                      ? "border-[#0B2E8C] ring-2 ring-[#0B2E8C]/25 bg-[#F0F5FF]"
                      : "border-[#D0DDFB]"
                  }`}
                >
                  {/* علامة مائية باهتة لأيقونة البرق */}
                  <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                    <Zap className="w-full h-full text-[#0B2E8C] fill-[#0B2E8C] -rotate-12" />
                  </div>

                  {/* الجزء العلوي للبطاقة: شريط المسار الملون ورقم الطلب وبلوك التحديد */}
                  <div className="flex items-center justify-between gap-2 relative z-10">
                    {/* شريط المسار وبلوك التحديد */}
                    <div className="flex-1 min-w-0 flex items-center gap-1.5 justify-start">
                      {/* بلوك التحديد (صح) عند تفعيل نمط التحديد السريع */}
                      {showQuickSelect && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleOne(r.id);
                          }}
                          className={`w-[26px] h-[26px] rounded-[8px] flex items-center justify-center shrink-0 cursor-pointer transition-all duration-150 shadow-2xs ${
                            isSelected
                              ? "bg-[#0B2E8C] text-[#FFC107] border-2 border-[#0B2E8C] ring-2 ring-[#FFC107]/50 scale-105"
                              : "bg-white border-2 border-[#D0DDFB] text-transparent hover:border-[#0B2E8C]"
                          }`}
                          title={isSelected ? "إلغاء التحديد" : "تحديد هذا الطلب"}
                        >
                          <Check
                            className={`w-3.5 h-3.5 stroke-[3] transition-opacity ${
                              isSelected ? "opacity-100" : "opacity-0"
                            }`}
                          />
                        </div>
                      )}

                      {/* شريط المسار الملون حسب الحالة */}
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

                    {/* أزرار التحريك عند تفعيل وضع الترتيب */}
                    {isSortingMode && moveRow && (
                      <div
                        className="flex items-center gap-1 bg-[#F0F4FF] border border-[#D0DDFB] rounded-lg p-0.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => moveRow(r.id, "up")}
                          className="w-6 h-6 rounded bg-white text-[#0B2E8C] flex items-center justify-center shadow-2xs hover:bg-[#0B2E8C] hover:text-white transition-colors"
                          title="تحريك لأعلى"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveRow(r.id, "down")}
                          className="w-6 h-6 rounded bg-white text-[#0B2E8C] flex items-center justify-center shadow-2xs hover:bg-[#0B2E8C] hover:text-white transition-colors"
                          title="تحريك لأسفل"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* كبسولة رقم الطلب */}
                    <div className="shrink-0 h-[28px] bg-[#0B2E8C] rounded-[8px] px-2 py-0.5 shadow-xs flex items-center justify-center">
                      <span className="font-mono font-black text-[#FFC107] text-[12px] leading-none tracking-wide">
                        #{r.shortId || r.id.slice(-4)}
                      </span>
                    </div>
                  </div>

                  {/* الجزء الأوسط: تفاصيل الطلب، وقت الطلبية، ودائرة سعر الطلب الكبيرة (التي تنفذ الاستلام والتسليم) */}
                  <div className="mt-2.5 flex items-center justify-between gap-3 relative z-10 min-h-[66px]">
                    <div className="flex-1 min-w-0 flex flex-col items-start gap-1.5">
                      {/* تفاصيل المحتويات والملاحظات */}
                      <div className="bg-[#E8EEFF] border border-[#D0DDFB] text-[#0B2E8C] text-[11px] font-bold rounded-[14px] px-3 py-1 max-w-[200px] truncate leading-tight">
                        {r.orderType || r.landmarkLine || "طلب توصيل"}
                      </div>

                      {/* وقت الطلبية متناسق مع الثيم */}
                      <div className="h-[24px] px-2.5 rounded-full border border-[#D0DDFB] bg-[#F0F4FF] text-[#0B2E8C] text-[10px] font-black flex items-center gap-1 shrink-0 shadow-2xs">
                        <Clock className="w-3 h-3 text-[#1E4DB7]" />
                        <span>{orderTimeText}</span>
                      </div>
                    </div>

                    {/* دائرة سعر الطلب الكبيرة: هي نفسها زر الاستلام والتسليم المباشر */}
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
                        <span className="font-mono font-black text-[#FFC107] text-[30px] leading-none tracking-tight">
                          {displayPriceValue}
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* شريط التواصل والاتصال والخيارات السفلي */}
                  <div className="mt-2.5 h-[42px] rounded-[20px] bg-gradient-to-r from-[#E8EEFF] to-[#FFF8E1] border border-[#D0DDFB] flex items-center justify-between px-2 relative z-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                    {/* بلوك الاتصال: يفتح خيارات الاتصال بالزبون أو العميل */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionModal({ type: "call", row: r });
                      }}
                      className="flex items-center gap-1.5 active:scale-95 transition-transform text-inherit cursor-pointer"
                      title="خيارات الاتصال الهاتفي"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#FFC107] flex items-center justify-center shadow-xs shrink-0">
                        <Phone
                          className="w-3 h-3 text-[#0B2E8C]"
                          fill="#0B2E8C"
                          strokeWidth={2.2}
                        />
                      </div>
                      <span className="font-mono font-black text-[12px] tracking-wide text-[#0B2E8C]">
                        {r.customerPhone || "اتصال"}
                      </span>
                    </button>

                    {/* أزرار الإجراءات: لوكيشن، واتساب، صورة الباب */}
                    <div className="flex items-center gap-1.5">
                      {/* زر اللوكيشن: يفتح خيارات لوكيشن الزبون أو العميل */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionModal({ type: "location", row: r });
                        }}
                        className="w-7 h-7 rounded-full bg-[#0B2E8C] flex items-center justify-center shadow-xs active:scale-90 transition-transform hover:bg-[#1E4DB7] cursor-pointer"
                        title="فتح الموقع الجغرافي (الزبون / المحل)"
                      >
                        <MapPin className="w-3.5 h-3.5 text-[#FFC107]" />
                      </button>

                      {/* زر واتساب: يفتح خيارات مراسلة واتساب للزبون أو العميل */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionModal({ type: "whatsapp", row: r });
                        }}
                        className="w-7 h-7 rounded-full bg-[#0B2E8C] flex items-center justify-center shadow-xs active:scale-90 transition-transform hover:bg-[#1E4DB7] text-white cursor-pointer"
                        title="مراسلة عبر واتساب (الزبون / المحل)"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-[#FFC107]" />
                      </button>

                      {/* زر صورة الباب: يفتح خيارات صورة باب الزبون أو العميل */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionModal({ type: "doorPhoto", row: r });
                        }}
                        className="w-7 h-7 rounded-full bg-white border border-[#D0DDFB] flex items-center justify-center shadow-2xs active:scale-90 transition-transform hover:border-[#0B2E8C]/40 text-[#0B2E8C] cursor-pointer"
                        title="صور الأبواب (الزبون / المحل)"
                      >
                        <Camera className="w-3.5 h-3.5 text-[#0B2E8C]" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* نافذة خيارات الإجراءات المنبثقة (اتصال، واتساب، لوكيشن، صور الباب) */}
      {actionModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setActionModal(null)}
        >
          <div
            className="w-full max-w-[420px] bg-white rounded-t-[24px] sm:rounded-[24px] border border-[#D0DDFB] p-4 shadow-2xl text-right animate-in slide-in-from-bottom-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* رأس النافذة */}
            <div className="flex items-center justify-between pb-3 border-b border-[#D0DDFB]/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#FFC107] flex items-center justify-center text-[#0B2E8C]">
                  {actionModal.type === "call" && <Phone className="w-4 h-4" />}
                  {actionModal.type === "whatsapp" && <MessageCircle className="w-4 h-4" />}
                  {actionModal.type === "location" && <MapPin className="w-4 h-4" />}
                  {actionModal.type === "doorPhoto" && <Camera className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-black text-[14px] text-[#0B2E8C]">
                    {actionModal.type === "call" && "خيارات الاتصال الهاتفي 📞"}
                    {actionModal.type === "whatsapp" && "مراسلة عبر واتساب 💬"}
                    {actionModal.type === "location" && "الموقع الجغرافي (اللوكيشن) 📍"}
                    {actionModal.type === "doorPhoto" && "صور الأبواب 🚪"}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-bold">
                    الطلب #{actionModal.row.shortId || actionModal.row.id.slice(-4)} • {actionModal.row.shopName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* محتوى الخيارات بناءً على النوع */}
            <div className="mt-3.5 space-y-2">
              {/* 1. خيارات الاتصال */}
              {actionModal.type === "call" && (
                <>
                  {/* اتصال بالزبون */}
                  <a
                    href={`tel:${actionModal.row.customerPhone}`}
                    className="flex items-center justify-between p-3 rounded-[14px] bg-[#F0F4FF] hover:bg-[#E8EEFF] border border-[#D0DDFB] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#0B2E8C] text-[#FFC107] flex items-center justify-center">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-[#0B2E8C]">
                          اتصال بالزبون: {actionModal.row.customerName || "الزبون"}
                        </p>
                        <p className="text-[11px] font-mono font-bold text-slate-600">
                          {actionModal.row.customerPhone || "لا يوجد رقم"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#1E4DB7]">اتصال 📞</span>
                  </a>

                  {/* اتصال بالزبون الثاني إن وجد */}
                  {actionModal.row.secondCustomerPhone && (
                    <a
                      href={`tel:${actionModal.row.secondCustomerPhone}`}
                      className="flex items-center justify-between p-3 rounded-[14px] bg-[#F0F4FF] hover:bg-[#E8EEFF] border border-[#D0DDFB] transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#0B2E8C] text-[#FFC107] flex items-center justify-center">
                          <Phone className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-[#0B2E8C]">اتصال بالزبون الثاني</p>
                          <p className="text-[11px] font-mono font-bold text-slate-600">
                            {actionModal.row.secondCustomerPhone}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-[#1E4DB7]">اتصال 📞</span>
                    </a>
                  )}

                  {/* اتصال بالعميل / المحل */}
                  <a
                    href={actionModal.row.shopPhone ? `tel:${actionModal.row.shopPhone}` : "#"}
                    onClick={(e) => {
                      if (!actionModal.row.shopPhone) {
                        e.preventDefault();
                        showToast("رقم هاتف المحل غير متوفر في هذا الطلب");
                      }
                    }}
                    className={`flex items-center justify-between p-3 rounded-[14px] border transition-colors ${
                      actionModal.row.shopPhone
                        ? "bg-amber-50 hover:bg-amber-100 border-amber-200"
                        : "bg-slate-50 border-slate-200 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-amber-950">
                          اتصال بالعميل (المحل): {actionModal.row.shopName || "المحل"}
                        </p>
                        <p className="text-[11px] font-mono font-bold text-slate-600">
                          {actionModal.row.shopPhone || "رقم المحل غير مسجل"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-amber-800">اتصال 📞</span>
                  </a>
                </>
              )}

              {/* 2. خيارات واتساب */}
              {actionModal.type === "whatsapp" && (
                <>
                  {/* واتساب الزبون */}
                  <a
                    href={toInternationalWhatsApp(actionModal.row.customerPhone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-[14px] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-emerald-950">
                          واتساب الزبون: {actionModal.row.customerName || "الزبون"}
                        </p>
                        <p className="text-[11px] font-mono font-bold text-emerald-800">
                          {actionModal.row.customerPhone}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      فتح <ExternalLink className="w-3 h-3" />
                    </span>
                  </a>

                  {/* واتساب الزبون الثاني إن وجد */}
                  {actionModal.row.secondCustomerPhone && (
                    <a
                      href={toInternationalWhatsApp(actionModal.row.secondCustomerPhone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-[14px] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                          <MessageCircle className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-emerald-950">واتساب الزبون الثاني</p>
                          <p className="text-[11px] font-mono font-bold text-emerald-800">
                            {actionModal.row.secondCustomerPhone}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        فتح <ExternalLink className="w-3 h-3" />
                      </span>
                    </a>
                  )}

                  {/* واتساب العميل / المحل */}
                  <a
                    href={actionModal.row.shopPhone ? toInternationalWhatsApp(actionModal.row.shopPhone) : "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (!actionModal.row.shopPhone) {
                        e.preventDefault();
                        showToast("رقم واتساب المحل غير متوفر");
                      }
                    }}
                    className={`flex items-center justify-between p-3 rounded-[14px] border transition-colors ${
                      actionModal.row.shopPhone
                        ? "bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
                        : "bg-slate-50 border-slate-200 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-emerald-950">
                          واتساب العميل (المحل): {actionModal.row.shopName}
                        </p>
                        <p className="text-[11px] font-mono font-bold text-emerald-800">
                          {actionModal.row.shopPhone || "رقم المحل غير مسجل"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      فتح <ExternalLink className="w-3 h-3" />
                    </span>
                  </a>
                </>
              )}

              {/* 3. خيارات الموقع الجغرافي */}
              {actionModal.type === "location" && (
                <>
                  {/* لوكيشن الزبون */}
                  <button
                    type="button"
                    onClick={() => {
                      const url =
                        actionModal.row.customerLocationUrl ||
                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          actionModal.row.landmarkLine || actionModal.row.regionLine || ""
                        )}`;
                      window.open(url, "_blank");
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-[14px] bg-[#F0F4FF] hover:bg-[#E8EEFF] border border-[#D0DDFB] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#0B2E8C] text-[#FFC107] flex items-center justify-center">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="text-right">
                        <p className="text-[13px] font-bold text-[#0B2E8C]">موقع الزبون (اللوكيشن)</p>
                        <p className="text-[11px] text-slate-600 truncate max-w-[230px]">
                          {actionModal.row.landmarkLine || actionModal.row.regionLine || "فتح الخريطة"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#1E4DB7] flex items-center gap-1">
                      خريطة <ExternalLink className="w-3 h-3" />
                    </span>
                  </button>

                  {/* لوكيشن الزبون الثاني إن وجد */}
                  {actionModal.row.secondCustomerLocationUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        window.open(actionModal.row.secondCustomerLocationUrl!, "_blank");
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-[14px] bg-[#F0F4FF] hover:bg-[#E8EEFF] border border-[#D0DDFB] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#0B2E8C] text-[#FFC107] flex items-center justify-center">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="text-right">
                          <p className="text-[13px] font-bold text-[#0B2E8C]">موقع الزبون الثاني</p>
                          <p className="text-[11px] text-slate-600">فتح الخريطة المباشرة</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-[#1E4DB7] flex items-center gap-1">
                        خريطة <ExternalLink className="w-3 h-3" />
                      </span>
                    </button>
                  )}

                  {/* لوكيشن العميل / المحل */}
                  <button
                    type="button"
                    onClick={() => {
                      if (actionModal.row.shopLocationUrl) {
                        window.open(actionModal.row.shopLocationUrl, "_blank");
                      } else {
                        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          actionModal.row.shopRegionName || actionModal.row.shopName || ""
                        )}`;
                        window.open(url, "_blank");
                      }
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-[14px] bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="text-right">
                        <p className="text-[13px] font-bold text-amber-950">
                          موقع العميل (المحل): {actionModal.row.shopName}
                        </p>
                        <p className="text-[11px] text-slate-600 truncate max-w-[230px]">
                          {actionModal.row.shopRegionName || "خريطة موقع المحل"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
                      خريطة <ExternalLink className="w-3 h-3" />
                    </span>
                  </button>
                </>
              )}

              {/* 4. خيارات صور الأبواب */}
              {actionModal.type === "doorPhoto" && (
                <>
                  {/* باب الزبون */}
                  <button
                    type="button"
                    onClick={() => {
                      if (actionModal.row.customerDoorPhotoUrl) {
                        setPreviewPhotoUrl({
                          url: actionModal.row.customerDoorPhotoUrl,
                          title: "صورة باب الزبون",
                        });
                        setActionModal(null);
                      } else {
                        showToast("لا توجد صورة مسجلة لباب الزبون في هذا الطلب");
                      }
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-[14px] border transition-colors cursor-pointer ${
                      actionModal.row.customerDoorPhotoUrl
                        ? "bg-[#F0F4FF] hover:bg-[#E8EEFF] border-[#D0DDFB]"
                        : "bg-slate-50 border-slate-200 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#0B2E8C] text-[#FFC107] flex items-center justify-center">
                        <Camera className="w-4 h-4" />
                      </div>
                      <div className="text-right">
                        <p className="text-[13px] font-bold text-[#0B2E8C]">صورة باب الزبون</p>
                        <p className="text-[11px] text-slate-500">
                          {actionModal.row.customerDoorPhotoUrl ? "متوفرة (اضغط للمعاينة)" : "غير متوفرة"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#1E4DB7]">
                      {actionModal.row.customerDoorPhotoUrl ? "عرض 🖼️" : "لا يوجد"}
                    </span>
                  </button>

                  {/* باب المحل / العميل */}
                  <button
                    type="button"
                    onClick={() => {
                      if (actionModal.row.shopDoorPhotoUrl) {
                        setPreviewPhotoUrl({
                          url: actionModal.row.shopDoorPhotoUrl,
                          title: `صورة باب المحل (${actionModal.row.shopName})`,
                        });
                        setActionModal(null);
                      } else {
                        showToast("لا توجد صورة مسجلة لباب المحل");
                      }
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-[14px] border transition-colors cursor-pointer ${
                      actionModal.row.shopDoorPhotoUrl
                        ? "bg-amber-50 hover:bg-amber-100 border-amber-200"
                        : "bg-slate-50 border-slate-200 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center">
                        <Camera className="w-4 h-4" />
                      </div>
                      <div className="text-right">
                        <p className="text-[13px] font-bold text-amber-950">صورة باب العميل (المحل)</p>
                        <p className="text-[11px] text-slate-500">
                          {actionModal.row.shopDoorPhotoUrl ? "متوفرة (اضغط للمعاينة)" : "غير متوفرة"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-amber-800">
                      {actionModal.row.shopDoorPhotoUrl ? "عرض 🖼️" : "لا يوجد"}
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* نافذة معاينة صورة الباب المكبرة */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div
            className="relative max-w-[90vw] max-h-[85vh] bg-white rounded-2xl overflow-hidden p-2 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-2 border-b border-slate-200 mb-2">
              <span className="font-bold text-sm text-[#0B2E8C]">{previewPhotoUrl.title}</span>
              <button
                type="button"
                onClick={() => setPreviewPhotoUrl(null)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={previewPhotoUrl.url}
              alt={previewPhotoUrl.title}
              className="max-h-[70vh] object-contain rounded-xl mx-auto"
            />
          </div>
        </div>
      )}

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
