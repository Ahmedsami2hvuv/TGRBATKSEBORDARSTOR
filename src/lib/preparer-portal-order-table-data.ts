import { formatDinarAsAlf } from "@/lib/money-alf";
import {
  deliveredSaderMismatch,
  deliveredWardMismatch,
  sumDeliveryInFromOrderMoneyEvents,
} from "@/lib/mandoub-money";
import { isManualDeletionReason, MONEY_KIND_PICKUP } from "@/lib/mandoub-money-events";
import { mandoubOrderListInclude } from "@/lib/mandoub-order-queries";
import type { MandoubOrderSearchFields } from "@/lib/mandoub-order-smart-filter";
import { hasCustomerLocationUrl } from "@/lib/order-location";
import { isReversePickupOrderType } from "@/lib/order-type-flags";
import { mandoubShopNameVividClass, orderStatusBadgeClassPrepaid } from "@/lib/order-status-style";
import { prisma } from "@/lib/prisma";
import type { MandoubRow } from "@/app/mandoub/mandoub-order-table";

export type PreparerPortalTabKey =
  | "pending"
  | "assigned"
  | "delivering"
  | "delivered"
  | "checkSader"
  | "checkWard"
  | "all";

const STATUS_AR: Record<string, string> = {
  pending: "جديد",
  assigned: "بانتظار المندوب",
  delivering: "عند المندوب (تم الاستلام)",
  delivered: "تم التسليم",
  archived: "مؤرشف",
};

function normalizeDbStatus(status: string | null | undefined): string {
  return String(status ?? "")
    .trim()
    .toLowerCase();
}

function isPreparerMainListStatus(status: string | null | undefined): boolean {
  const s = normalizeDbStatus(status);
  return s === "pending" || s === "assigned" || s === "delivering";
}

const STATUS_SORT_RANK: Record<string, number> = {
  pending: 0,
  assigned: 1,
  delivering: 2,
  delivered: 3,
  archived: 4,
};

export type PreparerPrepQuickFilter = "new" | "complete" | "open";

export async function loadPreparerPortalOrderTableData(args: {
  preparerId: string;
  shopIds: string[];
  orderListResetAt: Date;
  tab: PreparerPortalTabKey;
  wardFilter: "lower" | "higher";
  saderFilter: "lower" | "higher";
  prepFilter: PreparerPrepQuickFilter | null;
  /** إن كان true: طلبات رُفعت من بوابة هذا المجهز فقط (تجهيز تسوق) */
  onlySubmittedByThisPreparer: boolean;
}): Promise<{
  rows: MandoubRow[];
  searchFields: MandoubOrderSearchFields[];
  /** قبل تبويب الجدول — لعرض اسم المحل الأكثر في الرأس */
  ordersForPrimaryShopLabel: { shop: { name: string } }[];
}> {
  const {
    preparerId,
    shopIds,
    orderListResetAt,
    tab,
    wardFilter,
    saderFilter,
    prepFilter,
    onlySubmittedByThisPreparer,
  } = args;

  function passesDailyOrderListReset(o: { createdAt: Date; status: string }): boolean {
    if (tab === "all") return true;
    if (tab === "checkSader" || tab === "checkWard") return true;
    const st = o.status;
    if (st === "assigned" || st === "delivering") return true;
    return o.createdAt >= orderListResetAt;
  }

  const activeOrdersRaw =
    shopIds.length === 0
      ? []
      : await prisma.order.findMany({
          where: {
            shopId: { in: shopIds },
            status: { in: ["pending", "assigned", "delivering"] },
            ...(onlySubmittedByThisPreparer
              ? { submittedByCompanyPreparerId: preparerId }
              : {}),
            // تحسين: جلب الطلبات الحديثة فقط لتقليل الضغط
            createdAt: { gte: orderListResetAt },
          },
          include: mandoubOrderListInclude,
          orderBy: { createdAt: "desc" },
          take: 100, // حد أقصى للسرعة
        });

  const activeOrders = activeOrdersRaw.filter((o) => isPreparerMainListStatus(o.status));

  activeOrders.sort((a, b) => {
    const ra = STATUS_SORT_RANK[a.status] ?? 99;
    const rb = STATUS_SORT_RANK[b.status] ?? 99;
    if (ra !== rb) return ra - rb;
    return b.orderNumber - a.orderNumber;
  });

  const filteredByTab = activeOrders.filter((o) => {
    const deliveryInSum = sumDeliveryInFromOrderMoneyEvents(o.moneyEvents);
    if (!isPreparerMainListStatus(o.status)) return false;
    if (tab === "all") return true;
    if (tab === "checkSader") {
      return deliveredSaderMismatch(
        o.status,
        o.totalAmount,
        o.orderSubtotal,
        o.deliveryPrice,
        deliveryInSum,
      );
    }
    if (tab === "checkWard") {
      if (wardFilter === "higher") {
        return deliveredSaderMismatch(
          o.status,
          o.totalAmount,
          o.orderSubtotal,
          o.deliveryPrice,
          deliveryInSum,
        );
      }
      return deliveredWardMismatch(
        o.status,
        o.totalAmount,
        o.orderSubtotal,
        o.deliveryPrice,
        deliveryInSum,
      );
    }
    return o.status === tab;
  });

  const filteredByPrepf = prepFilter
    ? filteredByTab.filter((o) => {
        if (prepFilter === "new") return o.status === "pending";
        if (prepFilter === "complete") return o.status === "delivered";
        return o.status === "assigned" || o.status === "delivering";
      })
    : filteredByTab;

  const rows: MandoubRow[] = filteredByPrepf.map((o) => {
    const regionLine = o.customerRegion?.name?.trim() || "—";
    const price = o.totalAmount;
    const del = o.deliveryPrice;
    const statusClass = orderStatusBadgeClassPrepaid(o.status, o.prepaidAll);

    const pickupSumDinar = o.moneyEvents
      .filter((e) => e.kind === MONEY_KIND_PICKUP && e.deletedAt == null)
      .reduce((acc, e) => acc + Number(e.amountDinar), 0);
    const orderSubtotalDinar = o.orderSubtotal ? Number(o.orderSubtotal) : null;
    const totalAmountDinar = o.totalAmount ? Number(o.totalAmount) : null;
    const pickupComplete = orderSubtotalDinar != null && Math.abs(pickupSumDinar - orderSubtotalDinar) < 1e-3;

    return {
      id: o.id,
      shortId: String(o.orderNumber || ""),
      /** لعمود «تاريخ الرفع» في الجدول الموحّد */
      createdAt: o.createdAt ? o.createdAt.toISOString() : new Date().toISOString(),
      orderStatus: o.status || "pending",
      assignedCourierId: o.assignedCourierId,
      assignedCourierName: o.courier?.name?.trim() || "",
      shopName: o.shop?.name || "—",
      shopNameHighlightClass: mandoubShopNameVividClass(o.status, o.prepaidAll),
      regionLine,
      orderType: o.orderType || "—",
      priceStr: price != null ? formatDinarAsAlf(price) : "—",
      delStr: del != null ? formatDinarAsAlf(del) : "—",
      customerPhone: "—",
      timeLine: o.orderNoteTime?.trim()
        ? o.orderNoteTime
        : o.createdAt?.toLocaleString("ar-IQ-u-nu-latn", {
            dateStyle: "short",
            timeStyle: "short",
          }) || "—",
      statusAr: STATUS_AR[o.status] ?? o.status,
      statusClass,
      prepaidAll: o.prepaidAll,
      reversePickup: isReversePickupOrderType(o.orderType),
      hasCustomerLocation: hasCustomerLocationUrl(
        o.customerLocationUrl,
        o.customer?.customerLocationUrl,
      ),
      hasCourierUploadedLocation: Boolean(o.customerLocationSetByCourierAt),
      hasMoneyDeletedBadge: o.moneyEvents?.some(
        (e) => e.deletedAt && isManualDeletionReason(e.deletedReason),
      ) || false,
      pickupComplete,
      orderSubtotalDinar,
      totalAmountDinar,
      pickupSumDinar,

      // Unified fast-access fields - Safe access
      audioUrl: (o as any).voiceNoteUrl || null,
      preparerAudioUrl: (o.preparerShoppingJson as any)?.preparerAudioUrl || null,
      adminAudioUrl: (o as any).adminVoiceNoteUrl || null,
      shopLocationUrl: (o as any).shopLocationUrl || null,
      customerLocationUrl: o.customerLocationUrl || o.customer?.customerLocationUrl || null,
      secondCustomerLocationUrl: (o as any).secondCustomerLocationUrl || null,
      shopDoorPhotoUrl: (o as any).shopDoorPhotoUrl || null,
      customerDoorPhotoUrl: o.customer?.customerDoorPhotoUrl || (o as any).customerDoorPhotoUrl || null,
      secondCustomerDoorPhotoUrl: (o as any).secondCustomerDoorPhotoUrl || null,
      routeMode: (o.routeMode || "single") as "single" | "double",
    };
  });

  const searchFields: MandoubOrderSearchFields[] = filteredByPrepf.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber || 0,
    orderType: o.orderType || "",
    customerPhone: "",
    alternatePhone: "",
    secondCustomerPhone: "",
    summary: o.summary || "",
    customerLandmark: o.customerLandmark || "",
    secondCustomerLandmark: o.secondCustomerLandmark || "",
    orderNoteTime: o.orderNoteTime?.trim() ?? "",
    shopName: o.shop?.name || "—",
    regionName: o.customerRegion?.name ?? "",
    secondRegionName: o.secondCustomerRegion?.name ?? "",
    routeMode: (o.routeMode as any) || "single",
    courierName: o.courier?.name ?? "",
    adminOrderCode: o.adminOrderCode ?? "",
    submissionSource: o.submissionSource ?? "",
    customerLocationUrl: o.customerLocationUrl ?? "",
    customerLocationUploadedByName: o.customerLocationUploadedByName ?? "",
    secondCustomerLocationUrl: o.secondCustomerLocationUrl ?? "",
    secondCustomerDoorPhotoUploadedByName:
      o.secondCustomerDoorPhotoUploadedByName ?? "",
    customerDoorPhotoUploadedByName: o.customerDoorPhotoUploadedByName ?? "",
    orderImageUploadedByName: o.orderImageUploadedByName ?? "",
    shopDoorPhotoUploadedByName: o.shopDoorPhotoUploadedByName ?? "",
    preparerShoppingText:
      o.preparerShoppingJson != null ? JSON.stringify(o.preparerShoppingJson) : "",
    submittedByEmployeeName: o.submittedBy?.name ?? "",
    submittedByPreparerName: o.submittedByCompanyPreparer?.name ?? "",
    createdAtIso: o.createdAt ? o.createdAt.toISOString() : new Date().toISOString(),
  }));

  const ordersForPrimaryShopLabel = activeOrders.map((o) => ({ shop: { name: o.shop?.name || "—" } }));

  return { rows, searchFields, ordersForPrimaryShopLabel };
}
