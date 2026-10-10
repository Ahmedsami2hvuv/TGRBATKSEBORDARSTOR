"use client";

import { useActionState, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { MandoubRow } from "@/app/mandoub/mandoub-order-table";
import {
  bulkAssignOrdersByPreparer,
  type PreparerActionState,
} from "./actions";
import { PickupMoneyForm } from "./preparer-order-money-flow";
import { submitPreparerPickupMoney } from "./preparer-cash-actions";
import { dinarDecimalToAlfInputString, formatDinarAsAlf } from "@/lib/money-alf";
import { createPortal } from "react-dom";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";
import { PreparerOrderDetailSection } from "./preparer-order-detail-section";
import { formatBaghdadDateFriendly, getBaghdadDateString } from "@/lib/baghdad-time";
import { isReversePickupOrderType } from "@/lib/order-type-flags";
import { toast } from "sonner";
import { LuxuryReverseOrderButton } from "@/components/luxury-reverse-order-button";
import { createReverseOrderFromExisting } from "@/app/abo1stor3hlaa2kbr8-47/(dashboard)/orders/[orderId]/reverse-order-actions";
import { OrderCountUpTimer } from "@/components/order-count-up-timer";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import {
  Truck,
  Phone,
  Clock,
  MapPin,
  Pencil,
  X,
  RotateCcw,
  User,
  UserCheck,
  ArrowDown,
  ArrowUp,
  MessageCircle,
  Camera,
  Check,
} from "lucide-react";

// تلوين شريط المسار حسب حالة الطلب مثل حساب المندوب
const getRouteBadgeStyle = (status: string) => {
  switch (status) {
    case "new":
    case "pending":
      return "bg-gradient-to-l from-sky-500 to-sky-400 text-white shadow-[0_2px_8px_rgba(14,165,233,0.25)]";
    case "assigned":
      return "bg-gradient-to-l from-rose-600 to-red-500 text-white shadow-[0_2px_8px_rgba(225,29,72,0.25)]";
    case "delivering":
      return "bg-gradient-to-l from-[#FFC107] to-amber-400 text-[#0B2E8C] font-black shadow-[0_2px_8px_rgba(245,158,11,0.25)]";
    case "delivered":
      return "bg-gradient-to-l from-[#0B2E8C] to-[#1E4DB7] text-white shadow-[0_2px_8px_rgba(11,46,140,0.2)]";
    case "cancelled":
      return "bg-gradient-to-l from-slate-600 to-slate-500 text-white shadow-[0_2px_8px_rgba(100,116,139,0.2)]";
    default:
      return "bg-gradient-to-l from-[#0B2E8C] to-[#1E4DB7] text-white shadow-[0_2px_8px_rgba(11,46,140,0.2)]";
  }
};

function PreparerSaderSideBadge({ o }: { o: any }) {
  const pickup = o.pickupSumDinar ?? null;
  const preparerPickup = o.preparerPickupSumDinar ?? null;
  const adminPickup = o.adminPickupSumDinar ?? null;

  const showPickup = pickup != null && Number.isFinite(pickup) && pickup > 0;
  const showPreparerPickup = preparerPickup != null && Number.isFinite(preparerPickup) && preparerPickup > 0;
  const showAdminPickup = adminPickup != null && Number.isFinite(adminPickup) && adminPickup > 0;

  let text = "";
  let tooltip = "";
  let badgeStyle = "bg-[#E8F8F0] border border-[#34D399] text-[#065F46]"; // افتراضي أخضر فاتح

  if (showPreparerPickup) {
    text = formatDinarAsAlf(preparerPickup);
    tooltip = `صادر المجهز: ${text}`;
    badgeStyle = "bg-[#FFFBEB] border border-[#FBBF24] text-[#92400E]"; // صادر المجهز أصفر
  } else if (showPickup) {
    text = formatDinarAsAlf(pickup);
    tooltip = `صادر المندوب: ${text}`;
    badgeStyle = "bg-[#E8F8F0] border border-[#34D399] text-[#065F46]"; // صادر المندوب أخضر فاتح
  } else if (showAdminPickup) {
    text = formatDinarAsAlf(adminPickup);
    tooltip = `صادر الإدارة: ${text}`;
    badgeStyle = "bg-[#EFF6FF] border border-[#60A5FA] text-[#1E40AF]"; // صادر الإدارة أزرق
  } else if (o.saderMismatchType === "excess") {
    text = "زيادة";
    tooltip = "زيادة بالصادر";
    badgeStyle = "bg-[#FFFBEB] border border-amber-400 text-amber-800";
  }

  if (!text) return null;

  return (
    <div
      className={`h-[24px] px-2 rounded-[7px] flex items-center justify-center select-none shrink-0 shadow-2xs font-mono font-black text-[11px] leading-none tracking-tight ${badgeStyle}`}
      title={tooltip}
    >
      <span className="truncate max-w-full text-center">{text}</span>
    </div>
  );
}

function PreparerWardSideBadge({ o }: { o: any }) {
  const delivery = o.deliverySumDinar ?? null;
  const preparerDelivery = o.preparerDeliverySumDinar ?? null;

  const showDelivery = delivery != null && Number.isFinite(delivery) && delivery > 0;
  const showPreparerDelivery = preparerDelivery != null && Number.isFinite(preparerDelivery) && preparerDelivery > 0;

  let text = "";
  let tooltip = "";
  let badgeStyle = "bg-[#FEF2F2] border border-[#F87171] text-[#991B1B]"; // افتراضي أحمر

  if (showPreparerDelivery) {
    text = formatDinarAsAlf(preparerDelivery);
    tooltip = `وارد المجهز: ${text}`;
    badgeStyle = "bg-[#F5F3FF] border border-[#A78BFA] text-[#5B21B6]"; // وارد المجهز بنفسجي
  } else if (showDelivery) {
    text = formatDinarAsAlf(delivery);
    tooltip = `وارد المندوب: ${text}`;
    badgeStyle = "bg-[#FEF2F2] border border-[#F87171] text-[#991B1B]"; // وارد المندوب أحمر
  } else if (o.wardMismatchType === "deficit") {
    text = "نقص";
    tooltip = "نقص بالوارد";
    badgeStyle = "bg-[#FEF2F2] border border-rose-500 text-rose-700";
  } else if (o.wardMismatchType === "excess") {
    text = "زيادة";
    tooltip = "زيادة بالوارد";
    badgeStyle = "bg-[#ECFDF5] border border-emerald-500 text-emerald-700";
  } else if (o.noWardRecorded && o.orderStatus === "delivered") {
    text = "بدون";
    tooltip = "بدون وارد مسجل";
    badgeStyle = "bg-slate-100 border border-slate-300 text-slate-700";
  }

  if (!text) return null;

  return (
    <div
      className={`h-[24px] px-2 rounded-[7px] flex items-center justify-center select-none shrink-0 shadow-2xs font-mono font-black text-[11px] leading-none tracking-tight ${badgeStyle}`}
      title={tooltip}
    >
      <span className="truncate max-w-full text-center">{text}</span>
    </div>
  );
}

function PreparerCardMoneyBadges({ o, icons }: { o: any; icons?: GlobalIconsConfig | null }) {
  const hasMismatch =
    Boolean(o.wardMismatchType) ||
    o.saderMismatchType === "excess" ||
    Boolean(o.orderStatus === "delivered" && o.noWardRecorded);

  if (!hasMismatch) return null;

  return (
    <div
      className="absolute -top-3.5 left-4 sm:left-6 z-30 pointer-events-none flex items-center gap-1.5 flex-wrap"
      onClick={(e) => e.stopPropagation()}
    >
      {o.wardMismatchType === "deficit" && (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] sm:text-xs font-black leading-none shadow-md border border-rose-500 bg-rose-600 text-white animate-pulse drop-shadow-sm select-none pointer-events-auto"
          title="نقص بالوارد"
        >
          <DynamicIcon iconKey="finance_deficit" config={icons} fallback="🔴" className="w-2.5 h-2.5" />
          نقص بالوارد
        </span>
      )}
      {o.wardMismatchType === "excess" && (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] sm:text-xs font-black leading-none shadow-md border border-emerald-500 bg-emerald-600 text-white drop-shadow-sm select-none pointer-events-auto"
          title="زيادة بالوارد"
        >
          <DynamicIcon iconKey="finance_excess" config={icons} fallback="🟢" className="w-2.5 h-2.5" />
          زيادة بالوارد
        </span>
      )}
      {o.saderMismatchType === "excess" && (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] sm:text-xs font-black leading-none shadow-md border border-sky-500 bg-sky-600 text-white drop-shadow-sm select-none pointer-events-auto"
          title="زيادة بالصادر"
        >
          <DynamicIcon iconKey="finance_sader_excess" config={icons} fallback="📈" className="w-2.5 h-2.5" />
          زيادة بالصادر
        </span>
      )}
      {o.orderStatus === "delivered" && o.noWardRecorded && (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] sm:text-xs font-black leading-none shadow-md border border-[#C9A86A] bg-slate-900 text-[#F5D77F] animate-pulse drop-shadow-sm select-none pointer-events-auto"
          title="بدون وارد مسجل"
        >
          <DynamicIcon iconKey="ui_warning" config={icons} fallback="⚠️" className="w-2.5 h-2.5" />
          بدون وارد
        </span>
      )}
    </div>
  );
}

function RedGlassOrbButton3D({
  onClick,
  title,
  href,
}: {
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  href?: string | null;
}) {
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={title || "فتح موقع الزبون 📍"}
        className="w-5.5 h-5.5 sm:w-6.5 sm:h-6.5 rounded-full bg-no-repeat bg-contain select-none shrink-0 hover:scale-110 active:scale-95 transition cursor-pointer"
        style={{
          backgroundImage: "url('/images/order-luxury/btn-open-location.webp?v=royalLocV2')",
        }}
      />
    );
  }

  return (
    <div
      onClick={onClick}
      title={title || "بدون لوكيشن"}
      className="w-5.5 h-5.5 sm:w-6.5 sm:h-6.5 rounded-full bg-no-repeat bg-contain select-none shrink-0 opacity-80 cursor-default"
      style={{
        backgroundImage: "url('/images/order-luxury/btn-no-location.webp?v=royalLocV2')",
      }}
    />
  );
}

function isAssignableBeforeCourierReceipt(status: string | undefined): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  return s === "pending" || s === "assigned";
}

const bulkInitial: PreparerActionState = {};

export function PreparerOrderTable({
  rows,
  auth,
  tab,
  qSearch,
  couriers = [],
  icons,
}: {
  rows: MandoubRow[];
  auth: { p: string; exp: string; s: string };
  tab: string;
  qSearch: string;
  couriers?: { id: string; name: string }[];
  icons?: GlobalIconsConfig | null;
}) {
  const preparerAuth = auth;
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeOrderParam = searchParams?.get("activeOrderId");
  const [activeOrderId, setActiveOrderId] = useState<string | null>(activeOrderParam || null);

  useEffect(() => {
    setActiveOrderId(activeOrderParam);
  }, [activeOrderParam]);

  const activeOrderData = useMemo(() => {
    if (!activeOrderId) return null;
    return rows.find((r) => r.id === activeOrderId) || null;
  }, [rows, activeOrderId]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showQuickSelect, setShowQuickSelect] = useState(false);
  const [viewMode, setViewMode] = useState<"royal" | "normal">("royal");

  useEffect(() => {
    const saved = localStorage.getItem("preparer_view_mode");
    if (saved === "normal" || saved === "royal") {
      setViewMode(saved);
    }
    const handleStorage = () => {
      const s = localStorage.getItem("preparer_view_mode");
      if (s === "normal" || s === "royal") {
        setViewMode(s);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const handleSetViewMode = (mode: "royal" | "normal") => {
    setViewMode(mode);
    localStorage.setItem("preparer_view_mode", mode);
    toast.success(mode === "royal" ? "تم تفعيل الوضع الملكي 👑" : "تم تفعيل الوضع العادي 📋");
  };

  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkAssignOrdersByPreparer,
    bulkInitial,
  );
  const [payOrder, setPayOrder] = useState<MandoubRow | null>(null);
  const [assignOrder, setAssignOrder] = useState<MandoubRow | null>(null);
  const [payState, payAction, payPending] = useActionState(
    submitPreparerPickupMoney,
    {},
  );

  // مودال إجراءات الاتصال / الواتساب / اللوكيشن / الباب
  const [actionModalState, setActionModalState] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    type: "call" | "chat" | "location" | "door" | "customer";
    options: any[];
    previewImageUrl?: string | null;
  }>({
    isOpen: false,
    title: "",
    type: "chat",
    options: [],
    previewImageUrl: null,
  });

  const handleOpenActionModal = (o: any, type: "call" | "chat" | "location" | "door" | "customer") => {
    const custPhone = o.customerPhone || "";
    const shopPh = o.shopPhone || "";
    const secPhone = o.secondCustomerPhone || o.alternatePhone || "";

    const custLoc = o.customerLocationUrl || "";
    const shopLoc = o.shopLocationUrl || "";
    const secLoc = o.secondCustomerLocationUrl || "";

    const custDoor = o.customerDoorPhotoUrl || "";
    const shopDoor = o.shopDoorPhotoUrl || "";
    const secDoor = o.secondCustomerDoorPhotoUrl || "";

    if (type === "chat") {
      const options: any[] = [];
      if (custPhone) {
        options.push({
          title: "مراسلة الزبون",
          icon: "💬",
          colorVariant: "emerald",
          actionUrl: `https://wa.me/${custPhone.replace(/[^0-9]/g, "").replace(/^0/, "964")}`,
        });
      }
      if (shopPh) {
        options.push({
          title: `مراسلة العميل (${o.shopName || "المحل"})`,
          icon: "🏪",
          colorVariant: "amber",
          actionUrl: `https://wa.me/${shopPh.replace(/[^0-9]/g, "").replace(/^0/, "964")}`,
        });
      }
      if (secPhone) {
        options.push({
          title: "مراسلة الزبون الثاني",
          icon: "💬",
          colorVariant: "emerald",
          actionUrl: `https://wa.me/${secPhone.replace(/[^0-9]/g, "").replace(/^0/, "964")}`,
        });
      }
      if (options.length === 0 && custPhone) {
        window.open(`https://wa.me/${custPhone.replace(/[^0-9]/g, "").replace(/^0/, "964")}`, "_blank");
        return;
      }
      setActionModalState({
        isOpen: true,
        title: "اختر جهة المراسلة عبر واتساب",
        subtitle: `طلب رقم: #${o.shortId} - ${o.shopName || ""}`,
        type: "chat",
        options,
      });
    } else if (type === "call") {
      const options: any[] = [];
      if (custPhone) {
        options.push({
          title: "اتصال بالزبون",
          icon: "📞",
          colorVariant: "emerald",
          actionUrl: `tel:${custPhone}`,
        });
      }
      if (shopPh) {
        options.push({
          title: `اتصال بالعميل (${o.shopName || "المحل"})`,
          icon: "🏪",
          colorVariant: "amber",
          actionUrl: `tel:${shopPh}`,
        });
      }
      if (secPhone) {
        options.push({
          title: "اتصال بالزبون الثاني",
          icon: "📞",
          colorVariant: "emerald",
          actionUrl: `tel:${secPhone}`,
        });
      }
      if (options.length <= 1 && custPhone) {
        window.location.href = `tel:${custPhone}`;
        return;
      }
      setActionModalState({
        isOpen: true,
        title: "اختر جهة الاتصال الهاتفي",
        subtitle: `طلب رقم: #${o.shortId} - ${o.shopName || ""}`,
        type: "call",
        options,
      });
    } else if (type === "location") {
      const options: any[] = [];
      if (custLoc) {
        options.push({
          title: "موقع الزبون",
          icon: "📍",
          colorVariant: "emerald",
          actionUrl: custLoc,
        });
      }
      if (shopLoc) {
        options.push({
          title: `موقع العميل (${o.shopName || "المحل"})`,
          icon: "🏪",
          colorVariant: "amber",
          actionUrl: shopLoc,
        });
      }
      if (secLoc) {
        options.push({
          title: "موقع الزبون الثاني",
          icon: "📍",
          colorVariant: "emerald",
          actionUrl: secLoc,
        });
      }
      if (options.length === 1) {
        window.open(options[0].actionUrl, "_blank");
        return;
      }
      setActionModalState({
        isOpen: true,
        title: "اختر الموقع المطلوب على الخريطة",
        subtitle: `طلب رقم: #${o.shortId} - ${o.shopName || ""}`,
        type: "location",
        options,
      });
    } else if (type === "door") {
      const options: any[] = [];
      if (custDoor) {
        options.push({
          title: "باب الزبون",
          icon: "🚪",
          colorVariant: "emerald",
          imageUrl: custDoor,
        });
      }
      if (shopDoor) {
        options.push({
          title: `باب العميل (${o.shopName || "المحل"})`,
          icon: "🏪",
          colorVariant: "amber",
          imageUrl: shopDoor,
        });
      }
      if (secDoor) {
        options.push({
          title: "باب الزبون الثاني",
          icon: "🚪",
          colorVariant: "emerald",
          imageUrl: secDoor,
        });
      }
      setActionModalState({
        isOpen: true,
        title: "اختر صورة الباب المطلوبة",
        subtitle: `طلب رقم: #${o.shortId} - ${o.shopName || ""}`,
        type: "door",
        options,
        previewImageUrl: options.length === 1 ? (custDoor || shopDoor || secDoor) : null,
      });
    } else if (type === "customer") {
      const options: any[] = [];
      // 1. خيار الطلب العكسي الفوري
      options.push({
        title: "🔄 إنشاء طلب عكسي فوري",
        icon: "🔄",
        colorVariant: "amber",
        onClick: async () => {
          toast.loading("جاري إنشاء الطلب العكسي...", { id: "reverse-preparer-toast" });
          try {
            const res = await createReverseOrderFromExisting(o.id);
            if (res.ok && res.newOrderId) {
              toast.success(`تم إنشاء الطلب العكسي #${res.orderNumber || ""} بنجاح!`, { id: "reverse-preparer-toast" });
              router.refresh();
            } else {
              toast.error(res.error || "تعذر إنشاء الطلب العكسي", { id: "reverse-preparer-toast" });
            }
          } catch (err: any) {
            toast.error(err?.message || "حدث خطأ غير متوقع", { id: "reverse-preparer-toast" });
          }
        },
      });

      // 2. اتصال
      if (custPhone) {
        options.push({
          title: `اتصال: ${custPhone}`,
          icon: "📞",
          colorVariant: "emerald",
          actionUrl: `tel:${custPhone}`,
        });
      }

      // 3. مراسلة واتساب
      if (custPhone) {
        options.push({
          title: "مراسلة عبر واتساب",
          icon: "💬",
          colorVariant: "emerald",
          actionUrl: `https://wa.me/${custPhone.replace(/[^0-9]/g, "").replace(/^0/, "964")}`,
        });
      }

      // 4. نسخ الرقم
      if (custPhone) {
        options.push({
          title: "نسخ رقم الهاتف",
          icon: "📋",
          colorVariant: "blue",
          onClick: () => {
            void navigator.clipboard.writeText(custPhone);
            toast.success("تم نسخ رقم الهاتف بنجاح 📋");
          },
        });
      }

      setActionModalState({
        isOpen: true,
        title: `خيارات الزبون (${custPhone || "—"})`,
        subtitle: `طلب رقم: #${o.shortId} - ${o.shopName || ""}`,
        type: "customer",
        options,
      });
    }
  };

  // حماية وتجميد الـ Pull-To-Refresh لمنع رفرش الصفحة عند سحب النوافذ المنبثقة
  useEffect(() => {
    const isAnyModalOpen = Boolean(payOrder || assignOrder || activeOrderId || actionModalState.isOpen);
    if (!isAnyModalOpen) return;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehaviorY = "none";

    return () => {
      document.body.style.overflow = "";
      document.body.style.overscrollBehaviorY = "";
    };
  }, [payOrder, assignOrder, activeOrderId, actionModalState.isOpen]);

  const prevBulkPending = useRef(false);

  const pendingIds = useMemo(
    () => rows.filter((r) => isAssignableBeforeCourierReceipt(r.orderStatus)).map((r) => r.id),
    [rows],
  );

  const showBulkRow = couriers.length > 0 && pendingIds.length > 0;
  const allPendingSelected = pendingIds.length > 0 && pendingIds.every((id) => selectedIds.has(id));

  useEffect(() => {
    if (prevBulkPending.current && !bulkPending && bulkState.ok) {
      setSelectedIds(new Set());
      router.refresh();
    }
    prevBulkPending.current = bulkPending;
  }, [bulkPending, bulkState.ok, router]);

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = allPendingSelected || (rows.length > 0 && rows.every((r) => selectedIds.has(r.id)));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  }

  function toggleAllPending() {
    if (allPendingSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(pendingIds));
  }

  // تجميع الطلبات حسب اليوم بالتاريخ البغدادي الدقيق
  const groupedByDate: { dateKey: string; dateLabel: string; items: MandoubRow[] }[] = [];
  rows.forEach((row) => {
    const rawDate = row.createdAt ? (typeof row.createdAt === "string" ? new Date(row.createdAt) : row.createdAt) : null;
    const dateKey = rawDate ? getBaghdadDateString(rawDate) : "unknown";
    const dateLabel = rawDate ? formatBaghdadDateFriendly(rawDate) : "طلبات أخرى";

    const lastGroup = groupedByDate[groupedByDate.length - 1];
    if (lastGroup && lastGroup.dateKey === dateKey) {
      lastGroup.items.push(row);
    } else {
      groupedByDate.push({ dateKey, dateLabel, items: [row] });
    }
  });

  // الاستماع لحدث فتح/إغلاق التحديد السريع من ترويسة الصفحة
  useEffect(() => {
    const handler = () => setShowQuickSelect((v) => !v);
    window.addEventListener("preparer:toggle-quick-select", handler);
    return () => window.removeEventListener("preparer:toggle-quick-select", handler);
  }, []);

  const prepQuickBtn =
    "min-h-[38px] shrink-0 rounded-xl border-2 border-[#C9A86A] bg-[#0A3D2E] px-3.5 py-1.5 text-xs font-black text-white shadow-[0_2px_8px_rgba(10,61,46,0.3)] hover:bg-[#104D3B] active:scale-95 transition cursor-pointer";

  return (
    <div className="w-full">
      {bulkState.error ? (
        <div className="mb-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-900">
          {bulkState.error}
        </div>
      ) : null}

      {showBulkRow && showQuickSelect && (
        <div className="mb-3 px-2 sm:px-4 animate-in slide-in-from-top-2 duration-200" dir="rtl">
          <div className="rounded-[18px] border-2 border-[#C9A86A] bg-[#FFFEFB] p-3 sm:p-3.5 shadow-[0_4px_16px_rgba(201,168,106,0.2)]">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[#C9A86A]/25">
              <p className="text-xs font-black text-[#0A3D2E] flex items-center gap-1.5">
                <span className="text-amber-500">⚡</span>
                <span>تحديد سريع — للطلبات الجديدة وبانتظار المندوب</span>
              </p>
              <button
                type="button"
                onClick={() => setShowQuickSelect(false)}
                className="w-6 h-6 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold flex items-center justify-center cursor-pointer hover:bg-rose-100"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={toggleAllPending} className={prepQuickBtn}>
                {allPendingSelected ? "إلغاء تحديد الكل" : "تحديد كل القابل للإسناد"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="min-h-[38px] rounded-xl border-[1.5px] border-[#C9A86A]/60 bg-[#FDF6E3] px-3.5 py-1.5 text-xs font-bold text-[#8B6A2A] hover:bg-[#FAF0D7] active:scale-95 transition cursor-pointer"
              >
                إفراغ التحديد
              </button>
              <span className="mr-auto text-xs font-bold text-slate-500">
                المحدد: <strong className="text-[#0A3D2E] font-black">{selectedIds.size}</strong> من {pendingIds.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* عرض كروت المجهز الرسمية بثيم وصلي الكامل مع زر الإسناد وبدون هيدر المندوب */}
      <div className="space-y-6 pb-12">
        {groupedByDate.map((group) => {
          const dateDayNumber = group.items[0]?.createdAt
            ? new Date(group.items[0].createdAt).getDate()
            : 1;

          return (
            <div key={group.dateKey} className="space-y-3.5">
              {/* شريط الفاصل الزمني الأنيق بين الأيام بثيم وصلي */}
              <div className="relative overflow-hidden rounded-[16px] bg-gradient-to-r from-[#0B2E8C] via-[#1E4DB7] to-[#0B2E8C] px-4 py-2.5 text-white shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs bg-white/10 px-2 py-0.5 rounded-md">
                    {group.items.length} طلب
                  </span>
                </div>

                <div className="text-center font-black text-sm tracking-wide text-white">
                  {group.dateLabel}
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-[10px] bg-[#FFC107] text-[#0B2E8C] flex flex-col items-center justify-center font-mono font-black text-xs shadow-xs leading-none">
                    <span className="text-[8px] font-bold">يوم</span>
                    <span>{dateDayNumber}</span>
                  </div>
                </div>
              </div>

              {/* شبكة كروت المجهز بثيم وصلي */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-w-4xl mx-auto w-full">
                {group.items.map((o) => {
                  const isPending = o.orderStatus === "pending" || o.orderStatus === "new";
                  const isAssigned = o.orderStatus === "assigned";
                  const isDelivering = o.orderStatus === "delivering";
                  const isDelivered = o.orderStatus === "delivered";
                  const isCancelled = o.orderStatus === "cancelled";
                  const selected = selectedIds.has(o.id);

                  const displayTotal = o.hasDebt && o.priceWithDebtLabel
                    ? o.priceWithDebtLabel
                    : (o.totalAmountDinar != null ? `${o.totalAmountDinar} ألف` : (o.priceStr || "—"));

                  const numericPrice = displayTotal
                    .replace(/ألف|دينار|الف/g, "")
                    .replace(/,/g, ".")
                    .replace(/[^\d.]/g, "")
                    .replace(/\.$/, "")
                    .trim() || displayTotal;

                  const isAllPaid = Boolean(
                    o.prepaidAll ||
                    displayTotal === "كل شي واصل" ||
                    displayTotal === "واصل" ||
                    displayTotal?.includes("واصل") ||
                    o.priceStr === "كل شي واصل" ||
                    o.priceStr === "واصل" ||
                    o.priceStr?.includes("واصل")
                  );

                  const displayGoodsType = o.orderType && o.orderType !== "عام" && o.orderType !== "—"
                    ? o.orderType
                    : o.summary && o.summary.trim()
                    ? o.summary
                    : o.orderType || "طلب توصيل";

                  const hasAssignedCourier = Boolean(
                    (o.assignedCourierName && o.assignedCourierName !== "—" && o.assignedCourierName.trim() !== "") ||
                    o.assignedCourierId
                  );

                  const isReverse = Boolean(isReversePickupOrderType(o.orderType) || o.orderType?.includes("عكسي") || o.orderType?.includes("راجع"));

                  const preparerPickupDinar = o.preparerPickupSumDinar ?? null;
                  const hasPaidSomething = (preparerPickupDinar != null && Number.isFinite(preparerPickupDinar) && preparerPickupDinar > 0) || Boolean(o.pickupComplete);

                  return (
                    <div
                      key={o.id}
                      onClick={() => {
                        if (showQuickSelect) {
                          toggleOne(o.id);
                        } else {
                          setActiveOrderId(o.id);
                          const p = new URLSearchParams(window.location.search);
                          p.set("activeOrderId", o.id);
                          window.history.pushState({ orderId: o.id }, "", `?${p.toString()}`);
                        }
                      }}
                      className={`group bg-white border-[1.5px] rounded-[18px] p-[12px] shadow-[0_3px_10px_rgba(11,46,140,0.06)] transition-all duration-200 cursor-pointer relative overflow-hidden w-full box-border hover:border-[#1E4DB7]/50 hover:shadow-[0_4px_14px_rgba(11,46,140,0.1)] active:scale-[0.99] ${
                        selected
                          ? "border-[#0B2E8C] ring-2 ring-[#0B2E8C]/25 bg-[#F0F5FF]"
                          : "border-[#D0DDFB]"
                      }`}
                    >
                      {/* البادجات المالية العائمة أعلى الكرت إن وجدت */}
                      <PreparerCardMoneyBadges o={o} icons={icons} />

                      {/* 1. السطر العلوي للبطاقة: شريط المسار الملون + كبسولة رقم الطلب */}
                      <div className="flex items-center justify-between gap-2 relative z-10">
                        {/* شريط المسار الملون وبلوك التحديد */}
                        <div className="flex-1 min-w-0 flex items-center gap-1.5 justify-start">
                          {showQuickSelect && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleOne(o.id);
                              }}
                              className={`w-[26px] h-[26px] rounded-[8px] flex items-center justify-center shrink-0 cursor-pointer transition-all duration-150 shadow-2xs ${
                                selected
                                  ? "bg-[#0B2E8C] text-[#FFC107] border-2 border-[#0B2E8C] ring-2 ring-[#FFC107]/50 scale-105"
                                  : "bg-white border-2 border-[#D0DDFB] text-transparent hover:border-[#0B2E8C]"
                              }`}
                              title={selected ? "إلغاء التحديد" : "تحديد هذا الطلب"}
                            >
                              <Check
                                className={`w-3.5 h-3.5 stroke-[3] transition-opacity ${
                                  selected ? "opacity-100" : "opacity-0"
                                }`}
                              />
                            </div>
                          )}

                          {/* شريط المسار الملون حسب الحالة */}
                          <div
                            className={`flex-1 w-full min-w-0 flex items-center gap-2 text-[14px] sm:text-[15px] font-black rounded-[14px] px-3.5 py-2 shadow-sm transition-all ${getRouteBadgeStyle(
                              o.orderStatus
                            )}`}
                          >
                            <Truck
                              className={`w-4 h-4 shrink-0 ${
                                isDelivering ? "text-[#0B2E8C]" : "text-[#FFC107]"
                              }`}
                              strokeWidth={2.5}
                            />
                            <span className="flex-1 min-w-0 tracking-wide flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-ellipsis">
                              <span className="font-black shrink-0">{o.shopName || "المحل"}</span>
                              <span className="opacity-70 text-[12px] shrink-0 font-bold">←</span>
                              <span className="font-black truncate">{o.regionLine || "الوجهة"}</span>
                            </span>
                          </div>
                        </div>

                        {/* كبسولة رقم الطلب */}
                        <div className="shrink-0 h-[28px] bg-[#0B2E8C] rounded-[8px] px-2.5 py-0.5 shadow-xs flex items-center justify-center">
                          <span className="font-mono font-black text-[#FFC107] text-[12px] leading-none tracking-wide">
                            #{o.shortId}
                          </span>
                        </div>
                      </div>

                      {/* 2. الجزء الأوسط: نوع البضاعة باليمين، ودائرة السعر التفاعلية باليسار وبجانبها الأيمن بادجات الصادر والوارد */}
                      <div className="mt-2.5 flex items-center justify-between gap-2.5 relative z-10 min-h-[66px]">
                        <div className="flex-1 min-w-0 flex flex-col items-start gap-1.5">
                          {/* نوع البضاعة */}
                          <div className="bg-[#E8EEFF] border border-[#D0DDFB] text-[#0B2E8C] text-[11px] font-bold rounded-[14px] px-3 py-1 max-w-[200px] truncate leading-tight">
                            {displayGoodsType}
                          </div>
                        </div>

                        {/* دائرة السعر التفاعلية وبجانبها الأيمن بادجات الصادر والوارد (الصادر فوق والوارد بالأسفل) */}
                        <div className="flex items-center gap-1.5 shrink-0 relative">
                          {/* حاوية الصادر والوارد: كلاهما على يمين دائرة السعر، الصادر فوق والوارد بالأسفل */}
                          <div className="flex flex-col items-center justify-center gap-1 shrink-0">
                            {/* الصادر فوق */}
                            <PreparerSaderSideBadge o={o} />

                            {/* الوارد بالأسفل */}
                            <PreparerWardSideBadge o={o} />
                          </div>

                          {/* دائرة السعر التفاعلية للمجهز (تفتح نافذة الدفع للعميل) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPayOrder(o);
                            }}
                            className="shrink-0 relative flex items-center justify-center group/price cursor-pointer active:scale-95 transition-transform"
                            title="سعر الطلب - اضغط لتسجيل دفع للعميل"
                          >
                            <div
                              className={`w-[66px] h-[66px] rounded-full flex flex-col items-center justify-center shadow-[0_4px_12px_rgba(11,46,140,0.22)] border-[3px] transition-colors ${
                                hasPaidSomething
                                  ? "bg-emerald-700 border-emerald-400 text-white"
                                  : "bg-[#0B2E8C] border-[#FFC107] text-[#FFC107]"
                              }`}
                            >
                              {isAllPaid ? (
                                <span className="font-black text-xs leading-none">واصل</span>
                              ) : (
                                <span className="font-mono font-black text-[26px] leading-none tracking-tight">
                                  {numericPrice || "—"}
                                </span>
                              )}
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* 3. الشريط السفلي: زر التعديل، وقت الطلب، عداد الوقت، والأهم زر الإسناد */}
                      <div className="mt-2.5 h-[46px] rounded-[18px] bg-gradient-to-r from-[#E8EEFF] via-white to-[#FFF8E1] border border-[#D0DDFB] flex items-center justify-between px-2 relative z-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                        {/* قسم اليمين: زر التعديل + عداد وقت رفع الطلب + وقت الطلب */}
                        <div className="flex items-center gap-1.5 min-w-0">
                          {/* زر التعديل */}
                          <Link
                            href={`/preparer/order/${o.id}/edit?p=${auth.p}&exp=${auth.exp}&s=${auth.s}&tab=${tab}&q=${qSearch}`}
                            onClick={(e) => e.stopPropagation()}
                            className="h-[30px] px-2.5 rounded-[10px] bg-[#0B2E8C] hover:bg-[#1E4DB7] text-[#FFC107] font-black text-[11px] flex items-center gap-1 shadow-xs active:scale-95 transition-transform shrink-0"
                            title="تعديل الطلب"
                          >
                            <Pencil className="w-3 h-3 text-[#FFC107]" />
                            <span>تعديل</span>
                          </Link>

                          {/* عداد وقت رفع الطلب التصاعدي */}
                          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                            <OrderCountUpTimer createdAt={o.createdAt} orderStatus={o.orderStatus} variant="normal" />
                          </div>

                          {/* وقت الطلبية */}
                          <div
                            className="h-[24px] px-2 rounded-full border border-[#D0DDFB] bg-white text-[#0B2E8C] text-[10px] font-black flex items-center gap-1 shrink-0 shadow-2xs"
                            title="وقت الطلب"
                          >
                            <Clock className="w-3 h-3 text-[#1E4DB7]" />
                            <span>{o.orderNoteTime || o.timeLine || "فوري"}</span>
                          </div>
                        </div>

                        {/* قسم اليسار: زر الإسناد لمندوب + زر الطلب العكسي + أزرار التواصل */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* زر الإسناد للمندوب */}
                          {!isCancelled && isAssignableBeforeCourierReceipt(o.orderStatus) && couriers.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (couriers.length === 1 && !hasAssignedCourier) {
                                  const fd = new FormData();
                                  fd.append("p", auth.p);
                                  fd.append("exp", auth.exp);
                                  fd.append("s", auth.s);
                                  fd.append("orderIds", o.id);
                                  fd.append("courierId", couriers[0].id);
                                  startTransition(() => {
                                    bulkAction(fd);
                                  });
                                } else {
                                  setAssignOrder(o);
                                }
                              }}
                              className={`h-[30px] px-2.5 rounded-[10px] font-black text-[11px] flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer ${
                                hasAssignedCourier
                                  ? "bg-slate-900 border border-[#FFC107] text-[#FFC107]"
                                  : "bg-gradient-to-r from-blue-700 to-indigo-700 text-white border border-blue-400"
                              }`}
                              title={hasAssignedCourier ? `المسند: ${o.assignedCourierName} (انقر لتعديل الإسناد)` : "إسناد الطلب لمندوب"}
                            >
                              {hasAssignedCourier ? (
                                <UserCheck className="w-3 h-3 text-[#FFC107]" />
                              ) : (
                                <User className="w-3 h-3 text-white" />
                              )}
                              <span className="truncate max-w-[80px] sm:max-w-[110px]">
                                {hasAssignedCourier ? o.assignedCourierName : "إسناد"}
                              </span>
                            </button>
                          )}

                          {/* زر الطلب العكسي */}
                          {isReverse && (
                            <LuxuryReverseOrderButton
                              orderId={o.id}
                              orderNumber={o.shortId}
                              customerPhone={o.customerPhone || ""}
                              role="preparer"
                              size="sm"
                            />
                          )}

                          {/* زر الاتصال */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenActionModal(o, "call");
                            }}
                            className="w-7 h-7 rounded-full bg-[#FFC107] flex items-center justify-center shadow-xs active:scale-90 transition-transform cursor-pointer shrink-0"
                            title="اتصال هاتفي"
                          >
                            <Phone className="w-3.5 h-3.5 text-[#0B2E8C]" fill="#0B2E8C" />
                          </button>

                          {/* زر الواتساب */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenActionModal(o, "chat");
                            }}
                            className="w-7 h-7 rounded-full bg-[#25D366] flex items-center justify-center shadow-xs active:scale-90 transition-transform cursor-pointer shrink-0"
                            title="مراسلة واتساب"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-white" fill="white" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>



      {/* نافذة خيارات الإجراء السريع (Action Modal) للاتصال أو الواتساب أو اللوكيشن أو صورة الباب */}
      {actionModalState.isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setActionModalState((prev) => ({ ...prev, isOpen: false }))}
            dir="rtl"
          >
            <div
              className="relative w-full max-w-sm rounded-[28px] border-[2px] border-[#C9A86A] bg-gradient-to-b from-[#FAF6EE] via-[#F4EDE0] to-[#FAF6EE] p-5 shadow-2xl animate-in zoom-in-95 duration-200 text-[#0A3D2E]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#C9A86A]/40 pb-3 mb-3">
                <div>
                  <h3 className="text-base font-black text-[#0A3D2E]">{actionModalState.title}</h3>
                  {actionModalState.subtitle && (
                    <p className="text-xs font-bold text-slate-500 mt-0.5">{actionModalState.subtitle}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setActionModalState((prev) => ({ ...prev, isOpen: false }))}
                  className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 hover:bg-rose-200 flex items-center justify-center font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              {actionModalState.type === "door" && actionModalState.previewImageUrl ? (
                <div className="space-y-3">
                  <div className="rounded-2xl overflow-hidden border border-[#C9A86A]/50 bg-black max-h-[60vh] flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolvePublicAssetSrc(actionModalState.previewImageUrl)!}
                      alt="صورة الباب"
                      className="max-w-full max-h-[55vh] object-contain"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2 py-2">
                  {actionModalState.options.map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        if (opt.actionUrl) {
                          if (opt.actionUrl.startsWith("tel:")) {
                            window.location.href = opt.actionUrl;
                          } else {
                            window.open(opt.actionUrl, "_blank");
                          }
                        } else if (opt.imageUrl) {
                          setActionModalState((prev) => ({
                            ...prev,
                            previewImageUrl: opt.imageUrl,
                          }));
                        }
                      }}
                      className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white border border-[#C9A86A]/40 shadow-sm hover:border-[#0A3D2E] hover:bg-[#FAF6EE] transition-all font-black text-sm"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{opt.icon}</span>
                        <span>{opt.title}</span>
                      </div>
                      <span className="text-xs text-slate-400">➜</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* نافذة إسناد المندوب */}
      {assignOrder &&
        createPortal(
          <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto sm:p-6" dir="rtl">
            <div className="my-auto w-full max-w-md animate-in fade-in zoom-in-95 rounded-[28px] border-[2px] border-[#C9A86A] bg-gradient-to-b from-[#FAF6EE] via-[#F4EDE0] to-[#FAF6EE] p-5 text-[#0A3D2E] shadow-2xl">
              <div className="mb-4 flex items-center justify-between border-b border-[#C9A86A]/40 pb-3">
                <h3 className="text-lg font-black text-[#0A3D2E]">إسناد طلب #{assignOrder.shortId}</h3>
                <button
                  onClick={() => setAssignOrder(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-700 hover:bg-rose-100 hover:text-rose-700 font-bold"
                >
                  ✕
                </button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto pt-1 px-1">
                <form
                  action={bulkAction}
                  onSubmit={() => {
                    setTimeout(() => setAssignOrder(null), 100);
                  }}
                  className="space-y-3"
                >
                  <input type="hidden" name="p" value={auth.p} />
                  <input type="hidden" name="exp" value={auth.exp} />
                  <input type="hidden" name="s" value={auth.s} />
                  <input type="hidden" name="orderIds" value={assignOrder.id} />

                  <div className="grid grid-cols-2 gap-2.5">
                    {couriers.map((c) => (
                      <button
                        key={c.id}
                        type="submit"
                        name="courierId"
                        value={c.id}
                        disabled={bulkPending}
                        className="w-full rounded-2xl border-2 border-[#C9A86A]/40 bg-white px-4 py-3.5 text-right text-base font-black text-[#0A3D2E] shadow-sm transition hover:border-[#0A3D2E] hover:bg-[#0A3D2E] hover:text-[#F5D77F] active:scale-[0.98] disabled:opacity-60"
                      >
                        👤 {c.name}
                      </button>
                    ))}
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* نافذة تسجيل الدفع للعميل */}
      {payOrder &&
        createPortal(
          <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto sm:p-6" dir="rtl">
            <div className="my-auto w-full max-w-md animate-in fade-in zoom-in-95 rounded-[28px] border-[2px] border-[#C9A86A] bg-gradient-to-b from-[#FAF6EE] via-[#F4EDE0] to-[#FAF6EE] p-5 text-[#0A3D2E] shadow-2xl">
              <div className="mb-4 flex items-center justify-between border-b border-[#C9A86A]/40 pb-3">
                <h3 className="text-lg font-black text-[#0A3D2E]">دفع للعميل (المحل) - طلب #{payOrder.shortId}</h3>
                <button
                  type="button"
                  onClick={() => setPayOrder(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-700 hover:bg-rose-100 hover:text-rose-700 font-bold"
                >
                  ✕
                </button>
              </div>
              {(() => {
                const effectivePickupDinar = payOrder.purchasePriceDinar ?? payOrder.orderSubtotalDinar;
                return (
                  <PickupMoneyForm
                    orderId={payOrder.id}
                    auth={auth}
                    nextUrl={`/preparer?p=${preparerAuth.p}&exp=${preparerAuth.exp}&s=${preparerAuth.s}&tab=${tab}&q=${qSearch}`}
                    forDarkModalSurface
                    expectedAlfHint={effectivePickupDinar != null ? dinarDecimalToAlfInputString(effectivePickupDinar) : ""}
                    remainingAlfHint={
                      effectivePickupDinar != null
                        ? dinarDecimalToAlfInputString(effectivePickupDinar - (payOrder.pickupSumDinar || 0))
                        : ""
                    }
                    advanceToDelivering={false}
                    pickupRemainingDinar={
                      effectivePickupDinar != null ? effectivePickupDinar - (payOrder.pickupSumDinar || 0) : null
                    }
                    pickupSumDinar={payOrder.pickupSumDinar || 0}
                    orderSubtotalDinar={effectivePickupDinar ?? null}
                    formAction={payAction}
                    pending={payPending}
                    error={payState.error}
                    onClose={() => setPayOrder(null)}
                    couriers={couriers}
                    currentCourierId={payOrder.assignedCourierId}
                    orderStatus={payOrder.orderStatus}
                    hideContainer={true}
                  />
                );
              })()}
            </div>
          </div>,
          document.body
        )}

      {/* شريط الإسناد الجماعي العلوي عند التحديد */}
      {showQuickSelect && selectedIds.size > 0 && (
        <form
          action={bulkAction}
          className="fixed top-0 left-0 right-0 z-[160] border-b-2 border-[#C9A86A] bg-[#0A3D2E] text-white px-3 py-3 shadow-xl backdrop-blur-md sm:px-4"
          dir="rtl"
        >
          <input type="hidden" name="p" value={auth.p} /><input type="hidden" name="exp" value={auth.exp} /><input type="hidden" name="s" value={auth.s} />
          <input type="hidden" name="orderIds" value={Array.from(selectedIds).join(",")} />
          <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-black text-[#F5D77F]">إسناد ({selectedIds.size}) طلب لمندوب:</p>
            </div>
            <div className="flex gap-2">
              <select name="courierId" required className="rounded-xl border-2 border-[#C9A86A] bg-white text-slate-900 px-3 py-2 text-sm font-black">
                <option value="" disabled>— اختر مندوب —</option>
                {couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="submit" disabled={bulkPending} className="rounded-xl bg-[#C9A86A] px-5 py-2 text-sm font-black text-[#0A3D2E] shadow-sm hover:bg-[#F5D77F] transition">إسناد</button>
            </div>
          </div>
        </form>
      )}

      {/* نافذة تفاصيل الطلب السريعة عند النقر على الكارت */}
      {activeOrderData &&
        createPortal(
          <div className="fixed inset-0 z-[140] flex flex-col bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 flex items-center justify-center">
              <div className="w-full max-w-[480px] bg-[#FDF6E3] p-3 sm:p-4 rounded-[28px] border-2 border-[#C9A86A] shadow-2xl animate-in zoom-in-95 duration-200">
                <PreparerOrderDetailSection
                  order={{
                    ...activeOrderData as any,
                    imageUrl: (activeOrderData as any).imageUrl || null,
                    orderImageUploadedByName: (activeOrderData as any).orderImageUploadedByName || null,
                    shopDoorPhotoUrl: (activeOrderData as any).shopDoorPhotoUrl || null,
                    shopDoorPhotoUploadedByName: (activeOrderData as any).shopDoorPhotoUploadedByName || null,
                    orderNoteTime: activeOrderData.orderNoteTime || activeOrderData.timeLine,
                    orderSubtotal: activeOrderData.orderSubtotalDinar,
                    deliveryPrice: activeOrderData.deliveryPriceDinar,
                    totalAmount: activeOrderData.totalAmountDinar,
                    status: activeOrderData.orderStatus,
                    orderNumber: Number(activeOrderData.shortId),
                    customerLandmark: activeOrderData.landmarkLine,
                    secondCustomerLandmark: activeOrderData.secondCustomerLandmark,
                    moneyEvents: activeOrderData.moneyEvents || [],
                    shop: {
                       name: activeOrderData.shopName,
                       phone: activeOrderData.shopPhone,
                       photoUrl: activeOrderData.shopDoorPhotoUrl,
                       locationUrl: activeOrderData.shopLocationUrl,
                       region: { name: activeOrderData.shopRegionName || "—" },
                       ownerName: activeOrderData.submitterName,
                    } as any,
                    customerRegion: { name: activeOrderData.regionLine } as any,
                    secondCustomerRegion: { name: activeOrderData.secondCustomerRegionName || "—" } as any,
                    customer: {
                       name: activeOrderData.customerName,
                    } as any,
                    submittedBy: { name: activeOrderData.submitterName } as any,
                    routeMode: activeOrderData.routeMode,
                  } as any}
                  closeHref="#"
                  onCloseModal={() => {
                    setActiveOrderId(null);
                    const p = new URLSearchParams(window.location.search);
                    p.delete("activeOrderId");
                    const newUrl = window.location.pathname + (p.toString() ? "?" + p.toString() : "");
                    window.history.pushState({}, "", newUrl);
                  }}
                  auth={auth}
                  nextUrl="#"
                  preparerId={auth.p}
                  icons={icons}
                  couriers={couriers}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

