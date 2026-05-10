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

function safeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function safeStringTrim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function jsonToString(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, (_key, v) => {
      if (typeof v === "bigint") return v.toString();
      if (v && typeof v === "object" && Object.hasOwn(v, "d") && Object.hasOwn(v, "s") && Object.hasOwn(v, "e")) {
        return Number((v as any).toString());
      }
      return v;
    });
  } catch {
    return "";
  }
}

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
    // ترتيب تنازلي لرقم الطلب (الأحدث أولاً) - معالجة آمنة لـ BigInt
    if (a.orderNumber < b.orderNumber) return 1;
    if (a.orderNumber > b.orderNumber) return -1;
    return 0;
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
    const regionLine = safeStringTrim(o.customerRegion?.name) || "—";
    const price = o.totalAmount;
    const del = o.deliveryPrice;
    const status = safeString(o.status) || "pending";
    const statusClass = orderStatusBadgeClassPrepaid(status, Boolean(o.prepaidAll));

    const pickupSumDinar = o.moneyEvents
      .filter((e) => e.kind === MONEY_KIND_PICKUP && e.deletedAt == null)
      .reduce((acc, e) => acc + Number(e.amountDinar), 0);
    const orderSubtotalDinar = o.orderSubtotal ? Number(o.orderSubtotal) : null;
    const totalAmountDinar = o.totalAmount ? Number(o.totalAmount) : null;
    const pickupComplete = orderSubtotalDinar != null && Math.abs(pickupSumDinar - orderSubtotalDinar) < 1e-3;

    const shopLocationUrl = safeStringTrim((o as any).shopLocationUrl);
    const customerLocationUrl = safeStringTrim(o.customerLocationUrl || o.customer?.customerLocationUrl);
    const secondCustomerLocationUrl = safeStringTrim((o as any).secondCustomerLocationUrl);
    const shopDoorPhotoUrl = safeStringTrim((o as any).shopDoorPhotoUrl);
    const customerDoorPhotoUrl = safeStringTrim(o.customer?.customerDoorPhotoUrl || (o as any).customerDoorPhotoUrl);
    const secondCustomerDoorPhotoUrl = safeStringTrim((o as any).secondCustomerDoorPhotoUrl);

    const preparerShoppingJson =
      o.preparerShoppingJson && typeof o.preparerShoppingJson === "object"
        ? o.preparerShoppingJson
        : null;

    return {
      id: o.id,
      shortId: String(o.orderNumber ?? ""),
      /** لعمود «تاريخ الرفع» في الجدول الموحّد */
      createdAt: o.createdAt ? o.createdAt.toISOString() : new Date().toISOString(),
      orderStatus: status,
      assignedCourierId: o.assignedCourierId,
      assignedCourierName: safeStringTrim(o.courier?.name),
      shopName: safeString(o.shop?.name) || "—",
      shopNameHighlightClass: mandoubShopNameVividClass(status, Boolean(o.prepaidAll)),
      regionLine,
      orderType: safeString(o.orderType) || "—",
      priceStr: price != null ? formatDinarAsAlf(price) : "—",
      delStr: del != null ? formatDinarAsAlf(del) : "—",
      customerPhone: "—",
      timeLine: o.orderNoteTime?.trim()
        ? o.orderNoteTime
        : o.createdAt?.toLocaleString("ar-IQ-u-nu-latn", {
            dateStyle: "short",
            timeStyle: "short",
          }) || "—",
      statusAr: STATUS_AR[status] ?? status,
      statusClass,
      prepaidAll: Boolean(o.prepaidAll),
      reversePickup: isReversePickupOrderType(o.orderType),
      hasCustomerLocation: hasCustomerLocationUrl(customerLocationUrl),
      hasCourierUploadedLocation: Boolean(o.customerLocationSetByCourierAt),
      hasMoneyDeletedBadge: o.moneyEvents?.some(
        (e) => e.deletedAt && isManualDeletionReason(e.deletedReason),
      ) || false,
      pickupComplete,
      orderSubtotalDinar,
      totalAmountDinar,
      pickupSumDinar,

      // Unified fast-access fields - Safe access
      audioUrl: safeStringTrim((o as any).voiceNoteUrl) || null,
      preparerAudioUrl: safeStringTrim(preparerShoppingJson?.preparerAudioUrl) || null,
      adminAudioUrl: safeStringTrim((o as any).adminVoiceNoteUrl) || null,
      shopLocationUrl: shopLocationUrl || null,
      customerLocationUrl: customerLocationUrl || null,
      secondCustomerLocationUrl: secondCustomerLocationUrl || null,
      shopDoorPhotoUrl: shopDoorPhotoUrl || null,
      customerDoorPhotoUrl: customerDoorPhotoUrl || null,
      secondCustomerDoorPhotoUrl: secondCustomerDoorPhotoUrl || null,
      routeMode: (safeString(o.routeMode) || "single") as "single" | "double",
    };
  });

  const searchFields: MandoubOrderSearchFields[] = filteredByPrepf.map((o) => ({
    id: o.id,
    orderNumber: Number(o.orderNumber ?? 0), // تحويل BigInt إلى Number لضمان التوافق مع JSON
    orderType: safeString(o.orderType),
    customerPhone: "",
    alternatePhone: "",
    secondCustomerPhone: "",
    summary: safeString(o.summary),
    customerLandmark: safeString(o.customerLandmark),
    secondCustomerLandmark: safeString(o.secondCustomerLandmark),
    orderNoteTime: safeStringTrim(o.orderNoteTime),
    shopName: safeString(o.shop?.name) || "—",
    regionName: safeString(o.customerRegion?.name),
    secondRegionName: safeString(o.secondCustomerRegion?.name),
    routeMode: (safeString(o.routeMode) || "single") as any,
    courierName: safeString(o.courier?.name),
    adminOrderCode: safeString(o.adminOrderCode),
    submissionSource: safeString(o.submissionSource),
    customerLocationUrl: safeString(o.customerLocationUrl),
    customerLocationUploadedByName: safeString(o.customerLocationUploadedByName),
    secondCustomerLocationUrl: safeString(o.secondCustomerLocationUrl),
    secondCustomerDoorPhotoUploadedByName: safeString(o.secondCustomerDoorPhotoUploadedByName),
    customerDoorPhotoUploadedByName: safeString(o.customerDoorPhotoUploadedByName),
    orderImageUploadedByName: safeString(o.orderImageUploadedByName),
    shopDoorPhotoUploadedByName: safeString(o.shopDoorPhotoUploadedByName),
    preparerShoppingText: o.preparerShoppingJson != null ? jsonToString(o.preparerShoppingJson) : "",
    submittedByEmployeeName: safeString(o.submittedBy?.name),
    submittedByPreparerName: safeString(o.submittedByCompanyPreparer?.name),
    createdAtIso: o.createdAt ? o.createdAt.toISOString() : new Date().toISOString(),
  }));

  const ordersForPrimaryShopLabel = activeOrders.map((o) => ({ shop: { name: o.shop?.name || "—" } }));

  // دالة تطهير عميقة وقوية جداً لمنع أي تسريب لبيانات غير قابلة للتسلسل
  function deepSanitize(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "bigint") return obj.toString();
    if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") return obj;
    if (obj instanceof Date) return obj.toISOString();

    if (Array.isArray(obj)) return obj.map(deepSanitize);

    if (typeof obj === "object") {
      // معالجة Decimal الخاصة بـ Prisma (Decimal.js)
      if (obj.constructor && (obj.constructor.name === "Decimal" || obj.constructor.name === "n")) {
        return Number(obj.toString());
      }
      // حماية إضافية للـ Decimal إذا فقد الـ constructor
      if (obj.d && Array.isArray(obj.d) && typeof obj.s === 'number') {
        return Number(obj.toString());
      }

      const newObj: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          try {
            newObj[key] = deepSanitize(obj[key]);
          } catch (e) {
            newObj[key] = null; // تجنب الانهيار في حالة الدوران اللانهائي
          }
        }
      }
      return newObj;
    }
    return obj;
  }

  return deepSanitize({ rows, searchFields, ordersForPrimaryShopLabel });
}
