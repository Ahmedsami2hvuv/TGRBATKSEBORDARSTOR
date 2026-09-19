"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
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
import { resolvePublicAssetSrc } from "@/lib/image-url";

function getHeaderBannerWebp(orderStatus?: string) {
  switch (orderStatus) {
    case "delivering":
      return "/images/order-luxury/header-received.webp";
    case "delivered":
      return "/images/order-luxury/header-delivered.webp";
    case "cancelled":
      return "/images/order-luxury/header-rejected.webp";
    case "assigned":
    case "pending":
    default:
      return "/images/order-luxury/header-assigned.webp";
  }
}

function PreparerSaderSideBadge({ o }: { o: any }) {
  const pickup = o.pickupSumDinar ?? null; // صادر المندوب
  const preparerPickup = o.preparerPickupSumDinar ?? null; // صادر المجهز
  const adminPickup = o.adminPickupSumDinar ?? null; // صادر الإدارة

  const showPickup = pickup != null && Number.isFinite(pickup) && pickup > 0;
  const showPreparerPickup = preparerPickup != null && Number.isFinite(preparerPickup) && preparerPickup > 0;
  const showAdminPickup = adminPickup != null && Number.isFinite(adminPickup) && adminPickup > 0;

  let text = "";
  let tooltip = "";
  let isPreparer = false;

  if (showPreparerPickup) {
    text = formatDinarAsAlf(preparerPickup);
    tooltip = `صادر المجهز: ${text}`;
    isPreparer = true;
  } else if (showPickup) {
    text = formatDinarAsAlf(pickup);
    tooltip = `صادر المندوب: ${text}`;
  } else if (showAdminPickup) {
    text = formatDinarAsAlf(adminPickup);
    tooltip = `صادر الإدارة: ${text}`;
  } else if (o.saderMismatchType === "deficit") {
    text = "نقص";
    tooltip = "نقص بالصادر";
  } else if (o.saderMismatchType === "excess") {
    text = "زيادة";
    tooltip = "زيادة بالصادر";
  } else if (o.noSaderRecorded && (o.orderStatus === "delivering" || o.orderStatus === "delivered")) {
    text = "بدون";
    tooltip = "بدون صادر مسجل";
  }

  if (!text) return null;

  return (
    <div
      className="w-13 h-8 sm:w-14.5 sm:h-9 bg-contain bg-no-repeat bg-center flex items-center justify-center select-none shrink-0"
      style={{
        backgroundImage: `url('${isPreparer ? "/images/order-luxury/badge-preparer-sader.webp" : "/images/order-luxury/badge-sader.webp"}')`,
      }}
      title={tooltip}
    >
      <span className="text-[10px] sm:text-[11.5px] font-black font-mono leading-none tracking-tighter text-[#F5D77F] drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] pt-0.5 px-0.5 truncate max-w-full text-center">
        {text}
      </span>
    </div>
  );
}

function PreparerWardSideBadge({ o }: { o: any }) {
  const delivery = o.deliverySumDinar ?? null; // وارد المندوب
  const preparerDelivery = o.preparerDeliverySumDinar ?? null; // وارد المجهز

  const showDelivery = delivery != null && Number.isFinite(delivery) && delivery > 0;
  const showPreparerDelivery = preparerDelivery != null && Number.isFinite(preparerDelivery) && preparerDelivery > 0;

  let text = "";
  let tooltip = "";
  let isPreparer = false;

  if (showPreparerDelivery) {
    text = formatDinarAsAlf(preparerDelivery);
    tooltip = `وارد المجهز: ${text}`;
    isPreparer = true;
  } else if (showDelivery) {
    text = formatDinarAsAlf(delivery);
    tooltip = `وارد المندوب: ${text}`;
  } else if (o.wardMismatchType === "deficit") {
    text = "نقص";
    tooltip = "نقص بالوارد";
  } else if (o.wardMismatchType === "excess") {
    text = "زيادة";
    tooltip = "زيادة بالوارد";
  } else if (o.noWardRecorded && o.orderStatus === "delivered") {
    text = "بدون";
    tooltip = "بدون وارد مسجل";
  }

  if (!text) return null;

  return (
    <div
      className="w-13 h-8 sm:w-14.5 sm:h-9 bg-contain bg-no-repeat bg-center flex items-center justify-center select-none shrink-0"
      style={{
        backgroundImage: `url('${isPreparer ? "/images/order-luxury/badge-preparer-ward.webp" : "/images/order-luxury/badge-ward.webp"}')`,
      }}
      title={tooltip}
    >
      <span className="text-[10px] sm:text-[11.5px] font-black font-mono leading-none tracking-tighter text-[#F5D77F] drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] pt-0.5 px-0.5 truncate max-w-full text-center">
        {text}
      </span>
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
    type: "call" | "chat" | "location" | "door";
    options: any[];
    previewImageUrl?: string | null;
  }>({
    isOpen: false,
    title: "",
    type: "chat",
    options: [],
    previewImageUrl: null,
  });

  const handleOpenActionModal = (o: any, type: "call" | "chat" | "location" | "door") => {
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

      {/* عرض الطلبات بتصميم الكروت الملكية الفاخرة المطابقة للإدارة والمندوب */}
      {!rows.length ? (
        <div className="py-12 text-center text-[#0A3D2E] font-bold bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-[#C9A86A]/40 shadow-sm text-sm sm:text-base">
          لا توجد طلبات للعرض في هذه القائمة
        </div>
      ) : (
        <div className="space-y-6 pb-12">
          {groupedByDate.map((group) => {
            const dateDayNumber = group.items[0]?.createdAt
              ? new Date(group.items[0].createdAt).getDate()
              : 17;

            return (
              <div key={group.dateKey} className="space-y-3.5">
                {/* شريط الفاصل الزمني البارز بين الأيام بالزخرفة الدمشقية الأرابيسك */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#06281D] via-[#0A3D2E] to-[#06281D] border-y border-[#C9A86A] px-4 py-2.5 text-[#FFF8F0] shadow-md flex items-center justify-between">
                  {/* زخرفة دمشقية يمنى */}
                  <div className="flex items-center gap-2 opacity-90">
                    <span className="text-[#F5D77F] text-base">❧</span>
                    <span className="text-[#C9A86A] text-sm">⚜️</span>
                  </div>

                  {/* تاريخ اليوم بالمنتصف */}
                  <div className="text-center font-black text-sm sm:text-base tracking-wide text-white drop-shadow-sm">
                    {group.dateLabel} <span className="text-[#F5D77F] font-semibold text-xs sm:text-sm">({group.items.length} طلب)</span>
                  </div>

                  {/* أيقونة التقويم المذهبة في اليسار */}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-b from-[#E67E22] to-[#D35400] text-white flex flex-col items-center justify-center border border-[#FFF0D0] shadow-xs leading-none">
                      <span className="text-[8px] font-bold opacity-90">📅</span>
                      <span className="text-xs sm:text-sm font-black">{dateDayNumber}</span>
                    </div>
                    <span className="text-[#F5D77F] text-base">☙</span>
                  </div>
                </div>

                {/* شبكة الكروت الملكية للمجهز */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto w-full">
                  {group.items.map((o) => {
                    const isPending = o.orderStatus === "pending";
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

                    const displayGoodsType = o.orderType && o.orderType !== "عام" && o.orderType !== "—"
                      ? o.orderType
                      : o.summary && o.summary.trim()
                      ? o.summary
                      : o.orderType || "—";

                    const isDoubleRouteOrder = o.routeMode === "double" || !!o.secondCustomerPhone || !!o.secondCustomerRegionName;

                    const headerTextStr = isDoubleRouteOrder
                      ? `${o.regionLine || "المرسل"} إلى ${o.secondCustomerRegionName || "المستلم"}`
                      : `${o.shopName || "المحل"} إلى ${o.regionLine || "المنطقة"}`;

                    const hasAssignedCourier = Boolean(
                      (o.assignedCourierName && o.assignedCourierName !== "—" && o.assignedCourierName.trim() !== "") ||
                      o.assignedCourierId
                    );

                    const isAllPaid = Boolean(
                      o.prepaidAll ||
                      displayTotal === "كل شي واصل" ||
                      displayTotal === "واصل" ||
                      displayTotal?.includes("واصل") ||
                      o.priceStr === "كل شي واصل" ||
                      o.priceStr === "واصل" ||
                      o.priceStr?.includes("واصل")
                    );
                    const isReverse = Boolean(isReversePickupOrderType(o.orderType) || o.orderType?.includes("عكسي") || o.orderType?.includes("راجع"));
                    const hasGps = Boolean(o.hasCourierUploadedLocation || o.customerLocationUrl || o.hasCustomerLocation);
                    const isPrepOrder = Boolean(o.isPreparationOrder || (o as any).preparerShoppingJson || (o.orderType && o.orderType.includes("تجهيز")));

                    const showPay = o.orderSubtotalDinar != null && !o.pickupComplete && !isPrepOrder;

                    const headerWebpBg = getHeaderBannerWebp(o.orderStatus);

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
                        className={`group relative rounded-[20px] px-4 sm:px-6 pt-3.5 pb-3 transition-all active:scale-[0.99] cursor-pointer flex flex-col justify-between gap-1.5 sm:gap-2 bg-transparent bg-no-repeat bg-[length:100%_100%] w-full ${
                          selected ? "ring-2 ring-[#0A3D2E]" : ""
                        }`}
                        style={{
                          backgroundImage: "url('/images/order-luxury/order-card-frame.webp')",
                          minHeight: "220px",
                        }}
                      >
                        {/* 1. السطر العلوي: كبسولة رقم الطلب وبلوك اسم المحل */}
                        <div className="relative z-10 flex items-center justify-between gap-1.5 sm:gap-2 min-w-0 w-full">
                          {/* اليمين: بلوك اسم المحل */}
                          <div className="relative flex-1 min-w-0 max-w-[68%] sm:max-w-[74%]">
                            <div
                              className="w-full h-11 sm:h-12.5 rounded-full flex items-center justify-center px-3 sm:px-6 mr-0.5 sm:mr-1 mt-0.5 bg-no-repeat bg-[length:100%_100%] select-none overflow-hidden"
                              style={{
                                backgroundImage: `url('${headerWebpBg}')`,
                              }}
                            >
                              <span
                                className="font-black text-xs sm:text-sm leading-tight tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] truncate text-center block w-full px-1"
                                style={{
                                  color: "#FFFFFF",
                                  textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                                }}
                                title={headerTextStr}
                              >
                                {headerTextStr}
                              </span>
                            </div>

                            {/* أيقونة زر الطلب العكسي */}
                            {isReverse && (
                              <div
                                className="absolute -bottom-2 left-3 sm:left-5 z-20 select-none transition-transform hover:scale-110 cursor-pointer pointer-events-auto"
                                title="طلب عكسي 📦⤺"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src="/images/order-luxury/icon-reverse.webp"
                                  alt="طلب عكسي"
                                  className="w-7 h-7 sm:w-8.5 sm:h-8.5 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
                                />
                              </div>
                            )}
                          </div>

                          {/* اليسار: كبسولة رقم الطلب + مربع الاختيار */}
                          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-0.5 sm:ml-1">
                            {showQuickSelect && (
                              <input
                                type="checkbox"
                                checked={selected}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggleOne(o.id)}
                                className="size-5 rounded border-2 border-[#C9A86A] text-[#0A3D2E] focus:ring-[#C9A86A] cursor-pointer"
                              />
                            )}

                            <div className="relative shrink-0">
                              <div
                                className="min-w-[76px] sm:min-w-[92px] h-10.5 sm:h-12 px-2 rounded-lg flex items-center justify-center text-center font-black font-mono text-base sm:text-xl tracking-wider select-none bg-no-repeat bg-[length:100%_100%] leading-none"
                                style={{
                                  backgroundImage: "url('/images/order-luxury/order-number-bg.webp')",
                                  color: "#F5D77F",
                                  textShadow: "0 1px 3px rgba(0,0,0,0.85)",
                                }}
                              >
                                <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] pt-0.5">
                                  {o.shortId}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 2. القسم الأوسط: دائرة السعر مثبتة في المنتصف تماماً 50% مع الصادر والوارد */}
                        <div className="relative z-10 flex items-center justify-between gap-1 sm:gap-2 -mt-2 sm:-mt-3 py-0 px-0.5 sm:px-1 w-full min-h-[70px] sm:min-h-[80px]">
                          {/* النص الأيمن: نوع البضاعة */}
                          <div className="flex items-center justify-start flex-1 min-w-0 max-w-[28%] sm:max-w-[30%]">
                            <div className="inline-flex items-center justify-center px-2 sm:px-2.5 py-0.5 rounded-full bg-[#FFF8F0]/90 dark:bg-slate-900/90 border border-[#C9A86A]/40 shadow-xs max-w-full">
                              <span className="text-[11px] sm:text-xs md:text-sm font-black text-slate-900 dark:text-[#F5D77F] leading-tight truncate">
                                {displayGoodsType}
                              </span>
                            </div>
                          </div>

                          {/* حاوية السعر المركزية 50% */}
                          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                            {/* بلوك الصادر */}
                            <div className="absolute right-full mr-1 sm:mr-1.5 pointer-events-auto shrink-0">
                              <PreparerSaderSideBadge o={o} />
                            </div>

                            {/* دائرة السعر المركزية */}
                            <div
                              className="w-18 h-18 sm:w-20 sm:h-20 rounded-full flex items-center justify-center relative select-none bg-no-repeat bg-contain shrink-0 pointer-events-auto"
                              style={{
                                backgroundImage: "url('/images/order-luxury/price-circle.webp')",
                              }}
                            >
                              {isAllPaid ? (
                                <div className="flex flex-col items-center justify-center leading-[1.05] select-none text-center px-1">
                                  <span
                                    className="text-[13px] sm:text-[15px] font-black tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                                    style={{ color: "#F5D77F" }}
                                  >
                                    كلشي
                                  </span>
                                  <span
                                    className="text-[12px] sm:text-[14px] font-black tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                                    style={{ color: "#F5D77F" }}
                                  >
                                    واصل
                                  </span>
                                </div>
                              ) : (
                                <span
                                  className={`${
                                    numericPrice.length >= 5
                                      ? "text-[18px] sm:text-[21px]"
                                      : numericPrice.length >= 4
                                      ? "text-[22px] sm:text-[26px]"
                                      : numericPrice.length === 3
                                      ? "text-[27px] sm:text-[32px]"
                                      : "text-[34px] sm:text-[40px]"
                                  } font-black leading-none font-mono drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] tracking-tight pt-0.5`}
                                  style={{
                                    color: "#F5D77F",
                                  }}
                                >
                                  {numericPrice || "—"}
                                </span>
                              )}
                            </div>

                            {/* بلوك الوارد */}
                            <div className="absolute left-full ml-1 sm:ml-1.5 pointer-events-auto shrink-0">
                              <PreparerWardSideBadge o={o} />
                            </div>
                          </div>

                          {/* النص الأيسر: وقت الطلب */}
                          <div className="flex items-center justify-end flex-1 min-w-0 max-w-[28%] sm:max-w-[30%]">
                            <div className="inline-flex items-center justify-center px-2 sm:px-2.5 py-0.5 rounded-full bg-[#FFF0F0]/95 dark:bg-rose-950/50 border border-[#8B0000]/30 shadow-xs max-w-full">
                              <span className="text-[10.5px] sm:text-xs font-black text-[#8B0000] dark:text-rose-300 leading-tight truncate">
                                {o.orderNoteTime || o.timeLine || "فوري"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 3. القسم السفلي: زر التعديل باليمين + أزرار المجهز (دفع للعميل والإسناد) باليسار */}
                        <div className="relative z-10 flex flex-nowrap items-center justify-between gap-1 sm:gap-2 -mt-2 sm:-mt-3 pt-0 w-full">
                          {/* الجهة اليمنى: زر تعديل الطلب للمجهز الملكي */}
                          <div className="flex items-center -translate-y-1 mr-0.5 shrink-0">
                            <Link
                              href={`/preparer/order/${o.id}/edit?p=${auth.p}&exp=${auth.exp}&s=${auth.s}&tab=${tab}&q=${qSearch}`}
                              onClick={(e) => e.stopPropagation()}
                              className="h-10 sm:h-11 px-3.5 sm:px-5 rounded-full bg-gradient-to-r from-[#0F4D3A] via-[#164E3D] to-[#0F4D3A] border-2 border-[#C9A86A] text-[#F5D77F] font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-[0_3px_10px_rgba(10,61,46,0.35),inset_0_1px_0_rgba(245,215,127,0.3)] hover:scale-105 active:scale-95 transition-all select-none cursor-pointer"
                              title="تعديل الطلب ✏️"
                            >
                              <span className="text-sm">✏️</span>
                              <span>تعديل</span>
                            </Link>
                          </div>

                          {/* الجهة اليسرى: أزرار المجهز (دفع للعميل وإسناد لمندوب مع اسم المندوب المسند) */}
                          <div className="flex items-center gap-1 sm:gap-1.5 -translate-y-1 ml-0.5 shrink-0">
                            {/* زر تسجيل دفع للعميل ⚡ */}
                            {showPay && !isCancelled && !isDelivered && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPayOrder(o);
                                }}
                                className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full flex flex-col items-center justify-center hover:scale-105 active:scale-95 transition bg-gradient-to-b from-[#104D3B] via-[#0A3D2E] to-[#06281D] border-2 border-[#C9A86A] text-[#F5D77F] shadow-[0_3px_12px_rgba(10,61,46,0.4),inset_0_1px_0_rgba(245,215,127,0.4)] cursor-pointer shrink-0 p-1 select-none text-center"
                                title="تسجيل دفع للعميل (المحل) ⚡"
                              >
                                <span className="text-[10px] sm:text-[11px] font-black leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] text-[#F5D77F]">
                                  دفع للعميل
                                </span>
                              </button>
                            )}

                            {/* زر إسناد لمندوب 👤 (يظهر اسم المندوب المسند في المنتصف إذا كان مسنداً) */}
                            {!isCancelled && isAssignableBeforeCourierReceipt(o.orderStatus) && couriers.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAssignOrder(o);
                                }}
                                className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full text-xs sm:text-sm font-black flex flex-col items-center justify-center text-white hover:scale-105 active:scale-95 transition shrink-0 bg-no-repeat bg-contain cursor-pointer drop-shadow-md overflow-hidden p-1 text-center"
                                style={{
                                  backgroundImage: hasAssignedCourier
                                    ? "url('/images/order-luxury/btn-assign-empty.webp')"
                                    : "url('/images/order-luxury/btn-assign.webp')",
                                }}
                                title={hasAssignedCourier ? `المسند: ${o.assignedCourierName} (انقر لتعديل الإسناد)` : "إسناد الطلب لمندوب 👤"}
                              >
                                {hasAssignedCourier ? (
                                  <span className="text-[10px] sm:text-[11px] font-black text-[#F5D77F] drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] truncate max-w-full px-0.5 block leading-tight">
                                    {o.assignedCourierName}
                                  </span>
                                ) : null}
                              </button>
                            )}
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
      )}

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
                    orderSubtotalDinar={effectivePickupDinar}
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

