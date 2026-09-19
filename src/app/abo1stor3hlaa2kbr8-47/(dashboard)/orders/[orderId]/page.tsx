import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { AdminOrderMoneyEvents } from "./admin-order-money-events";
import { OrderViewContent } from "./order-view-content";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import {
  applyMandoubWaTemplate,
  parseStatusesCsv,
  splitMandoubWaTemplateVariants,
} from "@/lib/mandoub-wa-button-template";
import {
  matchesCustomerLocationRules,
  parseCustomerLocationRules,
} from "@/lib/order-location";
import { isReversePickupOrderType } from "@/lib/order-type-flags";
import { computeSmartHint } from "@/lib/smart-hint-logic";
import { getTwoWayTemplates } from "@/lib/two-way-whatsapp-settings";
import { getOrderCardsDesignerConfig } from "@/lib/order-card-customizer";
import {
  getCachedCompanyPreparers,
  getCachedMandoubWaButtonSettings,
  getCachedActiveCouriers,
  getCachedStoreProducts,
} from "@/lib/server-reference-cache";
import { getCustomerDebtByPhone } from "@/app/abo1stor3hlaa2kbr8-47/(dashboard)/credit-book/actions";

const SYSTEM_ADMIN_PHONE = "07733921568";
const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ view?: string }>;
};

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 350): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise((r) => setTimeout(r, delayMs));
    return withRetry(fn, retries - 1, delayMs * 1.5);
  }
}

export default async function AdminOrderViewPage({ params, searchParams }: Props) {
  const { orderId } = await params;
  const sp = await searchParams;

  try {
    const order = await withRetry(() =>
      prisma.order.findUnique({
        where: { id: orderId },
        include: {
          submittedBy: { select: { name: true, phone: true } },
          submittedByCompanyPreparer: { select: { name: true, phone: true } },
          shop: {
            select: {
              id: true,
              name: true,
              phone: true,
              ownerName: true,
              photoUrl: true,
              locationUrl: true,
              region: { select: { name: true } },
              employees: { select: { id: true, name: true, phone: true }, take: 5 },
            },
          },
          customerRegion: { select: { name: true } },
          secondCustomerRegion: { select: { name: true } },
          courier: { select: { name: true, phone: true } },
          customer: { select: { name: true, customerDoorPhotoUrl: true } },
        },
      })
    );

    if (!order) notFound();

    // جلب البيانات الملحقة بكفاءة عالية مع حماية كاملة ضد الأخطاء
    const customerPhoneNorm = order.customerPhone ? normalizeIraqMobileLocal11(order.customerPhone) : null;
    const secondPhoneNorm = order.secondCustomerPhone ? normalizeIraqMobileLocal11(order.secondCustomerPhone) : null;

    const [
      preparers,
      waButtonSettings,
      customerProfile,
      secondProfile,
      moneyEventsRaw,
      storeProducts,
      twoWayTemplates,
      couriersRaw,
      designerConfig,
      customerDebtVal,
      smartHintLine,
      secondSmartHintLine,
    ] = await Promise.all([
      getCachedCompanyPreparers().catch(() => []),
      getCachedMandoubWaButtonSettings().catch(() => []),
      customerPhoneNorm && order.customerRegionId
        ? prisma.customerPhoneProfile
            .findUnique({
              where: { phone_regionId: { phone: customerPhoneNorm, regionId: order.customerRegionId } },
            })
            .catch(() => null)
        : Promise.resolve(null),
      secondPhoneNorm && order.secondCustomerRegionId
        ? prisma.customerPhoneProfile
            .findUnique({
              where: { phone_regionId: { phone: secondPhoneNorm, regionId: order.secondCustomerRegionId } },
            })
            .catch(() => null)
        : Promise.resolve(null),
      prisma.orderCourierMoneyEvent
        .findMany({
          where: { orderId, deletedAt: null },
          orderBy: { createdAt: "desc" },
          include: { courier: { select: { name: true } }, recordedByCompanyPreparer: { select: { name: true } } },
        })
        .catch(() => []),
      getCachedStoreProducts().catch(() => []),
      getTwoWayTemplates().catch(() => null),
      getCachedActiveCouriers().catch(() => []),
      getOrderCardsDesignerConfig().catch(() => null),
      order.customerPhone
        ? getCustomerDebtByPhone(order.customerPhone).catch(() => 0)
        : Promise.resolve(0),
      computeSmartHint(order.id, "primary").catch(() => null),
      computeSmartHint(order.id, "secondary").catch(() => null),
    ]);

    const customerLocationUrlEffective = (order.customerLocationUrl || customerProfile?.locationUrl || "").trim();
    const secondCustomerLocationUrlEffective = (order.secondCustomerLocationUrl || secondProfile?.locationUrl || "").trim();

    const isSystemAdminOrder = Boolean(
      (!order.shop || order.shop.name === "الإدارة" || order.shop.name === "طلبات الإدارة العامة") &&
      (order.submissionSource === "admin_portal" || order.submissionSource === "company_preparer" || order.submittedByCompanyPreparerId)
    );

    const submitterPhone =
      order.shop?.phone ||
      order.submittedByCompanyPreparer?.phone ||
      order.submittedBy?.phone ||
      (isSystemAdminOrder ? SYSTEM_ADMIN_PHONE : SYSTEM_ADMIN_PHONE);

    const getCustomerDoorUrl = () => {
      if (order.customerDoorPhotoUrl) {
        return order.customerDoorPhotoUrl.startsWith("data:")
          ? `/api/image/order/${order.id}/customerDoor`
          : order.customerDoorPhotoUrl;
      }
      if (customerProfile?.photoUrl) {
        return customerProfile.photoUrl.startsWith("data:")
          ? `/api/image/customerPhoneProfile/${customerProfile.id}/photo`
          : customerProfile.photoUrl;
      }
      return order.customer?.customerDoorPhotoUrl || null;
    };

    const createdAtStr =
      order.createdAt instanceof Date
        ? order.createdAt.toISOString()
        : order.createdAt
        ? new Date(order.createdAt).toISOString()
        : new Date().toISOString();

    const shopPhotoUrlFinal = order.shop?.photoUrl?.startsWith("data:") && order.shopId
      ? `/api/image/shop/${order.shopId}/photo`
      : order.shop?.photoUrl || null;

    const shopDoorPhotoUrlFinal = order.shopDoorPhotoUrl?.startsWith("data:")
      ? `/api/image/order/${order.id}/shopDoor`
      : order.shopDoorPhotoUrl || order.shop?.photoUrl || null;

    const safePreparerShoppingJson = order.preparerShoppingJson
      ? (typeof order.preparerShoppingJson === "string" ? order.preparerShoppingJson : JSON.stringify(order.preparerShoppingJson))
      : null;

    const view = {
      ...order,
      imageUrl: resolvePublicAssetSrc(order.imageUrl?.startsWith("data:") ? `/api/image/order/${order.id}/image` : order.imageUrl),
      voiceNoteUrl: resolvePublicAssetSrc(order.voiceNoteUrl?.startsWith("data:") ? `/api/image/order/${order.id}/voice` : order.voiceNoteUrl),
      adminVoiceNoteUrl: resolvePublicAssetSrc(order.adminVoiceNoteUrl?.startsWith("data:") ? `/api/image/order/${order.id}/admin-voice` : order.adminVoiceNoteUrl),
      shopDoorPhotoUrl: resolvePublicAssetSrc(shopDoorPhotoUrlFinal),
      customerDoorPhotoUrl: resolvePublicAssetSrc(getCustomerDoorUrl()),
      secondCustomerDoorPhotoUrl: resolvePublicAssetSrc(
        order.secondCustomerDoorPhotoUrl?.startsWith("data:")
          ? `/api/image/order/${order.id}/secondCustomerDoor`
          : order.secondCustomerDoorPhotoUrl
      ),
      shopPhotoUrl: resolvePublicAssetSrc(shopPhotoUrlFinal),
      orderSubtotalRaw: order.orderSubtotal ? Number(order.orderSubtotal) : 0,
      deliveryPriceRaw: order.deliveryPrice ? Number(order.deliveryPrice) : 0,
      totalAmountRaw: order.totalAmount ? Number(order.totalAmount) : 0,
      orderSubtotal: order.orderSubtotal != null ? formatDinarAsAlfWithUnit(order.orderSubtotal) : null,
      deliveryPrice: order.deliveryPrice != null ? formatDinarAsAlfWithUnit(order.deliveryPrice) : null,
      totalAmount: order.totalAmount != null ? formatDinarAsAlfWithUnit(order.totalAmount) : null,
      createdAt: createdAtStr,
      reversePickup: isReversePickupOrderType(order.orderType),
      smartHintLine,
      secondSmartHintLine,
      customerLandmark: order.customerLandmark || customerProfile?.landmark || "",
      alternatePhone: order.alternatePhone || customerProfile?.alternatePhone || null,
      customerLocationUrl: customerLocationUrlEffective,
      shopLocationUrl: (order.shop?.locationUrl || "").trim(),
      customerProfileId: customerProfile?.id || null,
      isBlocked: customerProfile?.isBlocked || false,
      preparerShoppingJson: safePreparerShoppingJson,
    };

    const adminMoneyEvents = (moneyEventsRaw || []).reverse().map((e: any) => {
      const recDate =
        e.createdAt instanceof Date
          ? e.createdAt.toISOString()
          : e.createdAt
          ? new Date(e.createdAt).toISOString()
          : new Date().toISOString();
      return {
        ...e,
        amountDinar: Number(e.amountDinar || 0),
        expectedDinar: e.expectedDinar != null ? Number(e.expectedDinar) : null,
        recordedAt: recDate,
        performedByDisplayName:
          e.recordedByCompanyPreparer?.name ||
          e.courier?.name ||
          (!e.courierId && !e.recordedByCompanyPreparerId ? "الإدارة" : "—"),
      };
    });

    const adminCustomWaButtons = (waButtonSettings || []).flatMap((r: any) => {
      // 1. فحص الصلاحية (هل يظهر للإدارة؟)
      const scopes = (r.visibilityScope || "all")
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      const canSeeAdmin = scopes.includes("all") || scopes.includes("admin");
      if (!canSeeAdmin) return [];

      // 2. فحص حالة الطلب
      const statuses = parseStatusesCsv(r.statusesCsv || "");
      if (statuses.length > 0 && !statuses.includes(order.status)) return [];

      // 3. فحص شروط لوكيشن الزبون
      const hasCustLoc = Boolean(customerLocationUrlEffective);
      const hasCourierLoc = Boolean(order.customerLocationSetByCourierAt);
      const locRules = parseCustomerLocationRules(r.customerLocationRule || "any");
      if (!matchesCustomerLocationRules(locRules, hasCustLoc, hasCourierLoc)) return [];

      const vars = {
        clientshop: order.shop?.name || (isSystemAdminOrder ? "الإدارة" : "المحل"),
        city: order.customerRegion?.name || "",
        total_price: view.totalAmount || "",
        location_url: customerLocationUrlEffective,
        order_number: String(order.orderNumber || ""),
        customer_phone: order.customerPhone || "",
        shop_phone: submitterPhone || "",
      };
      const messages = splitMandoubWaTemplateVariants(r.templateText || "").map((t) => applyMandoubWaTemplate(t, vars));
      return messages.length > 0 ? [{ id: r.id, label: r.label, iconKey: r.iconKey, messages }] : [];
    });

    const safeView = JSON.parse(JSON.stringify(view));
    const safeMoneyEvents = JSON.parse(JSON.stringify(adminMoneyEvents));
    const safePreparers = JSON.parse(JSON.stringify(preparers || []));
    const safeWaButtons = JSON.parse(JSON.stringify(adminCustomWaButtons));
    const safeWaButtonSettings = JSON.parse(JSON.stringify(waButtonSettings || []));
    const safeStoreProducts = JSON.parse(JSON.stringify(storeProducts || []));
    const safeTwoWayTemplates = twoWayTemplates ? JSON.parse(JSON.stringify(twoWayTemplates)) : null;
    const safeCouriers = JSON.parse(JSON.stringify(couriersRaw || []));
    const safeCustomerProfile = customerProfile ? JSON.parse(JSON.stringify(customerProfile)) : null;
    const safeSecondProfile = secondProfile ? JSON.parse(JSON.stringify(secondProfile)) : null;

    return (
      <div className="space-y-4">
        <OrderViewContent
          order={safeView}
          preparers={safePreparers}
          customWaButtons={safeWaButtons}
          waButtonSettings={safeWaButtonSettings}
          storeProducts={safeStoreProducts}
          twoWayTemplates={safeTwoWayTemplates}
          couriers={safeCouriers}
          phoneProfile={safeCustomerProfile}
          secondPhoneProfile={safeSecondProfile}
          designerConfig={designerConfig || undefined}
          initialCustomerDebt={typeof customerDebtVal === "number" ? customerDebtVal : null}
        />
        <AdminOrderMoneyEvents
          orderId={order.id}
          orderNumber={order.orderNumber}
          orderStatus={order.status}
          assignedCourierId={order.assignedCourierId}
          courierName={order.courier?.name ?? null}
          orderSubtotalDinar={order.orderSubtotal ? Number(order.orderSubtotal) : null}
          totalAmountDinar={order.totalAmount ? Number(order.totalAmount) : null}
          prepaidAll={order.prepaidAll}
          nextPath={`${SECRET_ADMIN_PATH}/orders/${order.id}`}
          events={safeMoneyEvents}
        />
      </div>
    );
  } catch (err: any) {
    if (err?.digest === "NEXT_NOT_FOUND") {
      notFound();
    }
    console.error("[AdminOrderViewPage] Error loading order:", err);
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mb-3">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-lg font-black text-slate-800 mb-1">تعذر تحميل تفاصيل الطلب مؤقتاً</h2>
        <p className="text-xs text-slate-500 max-w-sm mb-4">
          حدث ضغط مؤقت على سيرفر قاعدة البيانات، يمكنك إعادة التحديث بنقرة زر.
        </p>
        <Link
          href={`${SECRET_ADMIN_PATH}/orders/${orderId}`}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95"
        >
          🔄 تحديث الصفحة
        </Link>
      </div>
    );
  }
}
