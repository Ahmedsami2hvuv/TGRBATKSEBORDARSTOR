import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { AdminOrderMoneyEvents } from "./admin-order-money-events";
import { OrderViewContent } from "./order-view-content";
import { AdminOrderErrorUI } from "./error-ui";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import {
  applyMandoubWaTemplate,
  parseStatusesCsv,
  splitMandoubWaTemplateVariants,
} from "@/lib/mandoub-wa-button-template";
import {
  extractLatLngFromLocationInputSmart,
  matchesCustomerLocationRules,
  parseCustomerLocationRules,
} from "@/lib/order-location";
import { isReversePickupOrderType } from "@/lib/order-type-flags";
import { haversineMeters } from "@/lib/geo-distance";
const SYSTEM_ADMIN_PHONE = "07733921568";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ orderId: string }> };

export async function generateMetadata({ params }: Props) {
  const { orderId } = await params;
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true },
  });
  return {
    title: o ? `طلب #${o.orderNumber} — أبو الأكبر للتوصيل` : "طلب — أبو الأكبر للتوصيل",
  };
}

export default async function AdminOrderViewPage({ params }: Props) {
  const { orderId } = await params;

  let order, preparers, waButtonSettings;
  try {
    [order, preparers, waButtonSettings] = await Promise.all([
      prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          routeMode: true,
          adminOrderCode: true,
          orderType: true,
          summary: true,
          customerPhone: true,
          alternatePhone: true,
          secondCustomerPhone: true,
          secondCustomerLocationUrl: true,
          secondCustomerLandmark: true,
          secondCustomerDoorPhotoUrl: true,
          secondCustomerRegionId: true,
          orderNoteTime: true,
          imageUrl: true,
          orderImageUploadedByName: true,
          shopDoorPhotoUploadedByName: true,
          customerDoorPhotoUploadedByName: true,
          secondCustomerDoorPhotoUploadedByName: true,
          voiceNoteUrl: true,
          adminVoiceNoteUrl: true,
          shopDoorPhotoUrl: true,
          customerDoorPhotoUrl: true,
          customerLandmark: true,
          orderSubtotal: true,
          deliveryPrice: true,
          totalAmount: true,
          submissionSource: true,
          createdAt: true,
          prepaidAll: true,
          shopId: true,
          customerRegionId: true,
          customerLocationUrl: true,
          customerLocationSetByCourierAt: true,
          customerLocationUploadedByName: true,
          preparerShoppingJson: true,
          submittedBy: { select: { id: true, name: true, phone: true } },
          submittedByCompanyPreparer: { select: { id: true, name: true, phone: true } },
          shop: { select: { id: true, name: true, phone: true, ownerName: true, photoUrl: true, locationUrl: true } },
          customerRegion: { select: { name: true } },
          secondCustomerRegion: { select: { name: true } },
          courier: { select: { name: true, phone: true } },
          customer: { select: { name: true } },
        },
      }),
      prisma.companyPreparer.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true }
      }),
      prisma.mandoubWaButtonSetting.findMany({
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "";
    console.error(`[AdminOrderViewPage] Failed to fetch order ${orderId}:`, {
      error: errorMessage,
      stack: errorStack,
      orderId,
      timestamp: new Date().toISOString(),
    });
    return <AdminOrderErrorUI orderId={orderId} error={`${errorMessage}\n\nStack: ${errorStack}`} />;
  }

  if (!order) {
    notFound();
  }

  const customerPhoneNorm = normalizeIraqMobileLocal11(order.customerPhone);
  let customerPhoneProfile = null;
  try {
    customerPhoneProfile =
      customerPhoneNorm && order.customerRegionId
        ? await prisma.customerPhoneProfile.findUnique({
            where: {
              phone_regionId: {
                phone: customerPhoneNorm,
                regionId: order.customerRegionId,
              },
            },
            select: {
              id: true,
              photoUrl: true,
              locationUrl: true,
              landmark: true,
              alternatePhone: true,
            },
          })
        : null;
  } catch (error) {
    console.warn(`[AdminOrderViewPage] Failed to fetch customer phone profile for ${orderId}:`, error);
    customerPhoneProfile = null;
  }

  const secondPhoneNorm = order.secondCustomerPhone?.trim()
    ? normalizeIraqMobileLocal11(order.secondCustomerPhone)
    : null;
  let secondCustomerPhoneProfile = null;
  try {
    secondCustomerPhoneProfile =
      secondPhoneNorm && order.secondCustomerRegionId
        ? await prisma.customerPhoneProfile.findUnique({
            where: {
              phone_regionId: {
                phone: secondPhoneNorm,
                regionId: order.secondCustomerRegionId,
              },
            },
            select: {
              id: true,
              photoUrl: true,
              locationUrl: true,
              landmark: true,
              alternatePhone: true,
            },
          })
        : null;
  } catch (error) {
    console.warn(`[AdminOrderViewPage] Failed to fetch second customer phone profile for ${orderId}:`, error);
    secondCustomerPhoneProfile = null;
  }

  const getCustomerDoorUrl = () => {
    if (order.customerDoorPhotoUrl?.trim()?.startsWith("data:")) return `/api/image/order/${order.id}/customerDoor`;
    if (order.customerDoorPhotoUrl?.trim()) return order.customerDoorPhotoUrl;
    if (customerPhoneProfile?.photoUrl?.trim()?.startsWith("data:")) return `/api/image/customerPhoneProfile/${customerPhoneProfile.id}/photo`;
    return customerPhoneProfile?.photoUrl?.trim() || null;
  };
  const customerDoorPhotoUrlEffective: string | null = getCustomerDoorUrl();

  const getSecondCustomerDoorUrl = () => {
    if (order.secondCustomerDoorPhotoUrl?.trim()?.startsWith("data:")) return `/api/image/order/${order.id}/secondCustomerDoor`;
    if (order.secondCustomerDoorPhotoUrl?.trim()) return order.secondCustomerDoorPhotoUrl;
    if (secondCustomerPhoneProfile?.photoUrl?.trim()?.startsWith("data:")) return `/api/image/customerPhoneProfile/${secondCustomerPhoneProfile.id}/photo`;
    return secondCustomerPhoneProfile?.photoUrl?.trim() || null;
  };
  const secondCustomerDoorPhotoUrlEffective: string | null = getSecondCustomerDoorUrl();

  const submitterPhone =
    order.submittedByCompanyPreparer?.phone?.trim() ||
    order.submittedBy?.phone?.trim() ||
    (order.submissionSource === "admin_portal" ? SYSTEM_ADMIN_PHONE : order.shop?.phone?.trim() || "");

  // fallback: لوكيشن الزبون من CustomerPhoneProfile
  const customerLocationUrlEffective =
    order.customerLocationUrl?.trim() ||
    customerPhoneProfile?.locationUrl?.trim() ||
    "";

  // fallback: أقرب نقطة دالة من CustomerPhoneProfile
  const customerLandmarkEffective =
    order.customerLandmark?.trim() ||
    customerPhoneProfile?.landmark?.trim() ||
    "";

  // fallback: الرقم الثاني من CustomerPhoneProfile
  const alternatePhoneEffective =
    order.alternatePhone?.trim() ||
    customerPhoneProfile?.alternatePhone?.trim() ||
    null;

  // fallback: لوكيشن الوجهة الثانية من CustomerPhoneProfile
  const secondCustomerLocationUrlEffective =
    order.secondCustomerLocationUrl?.trim() ||
    secondCustomerPhoneProfile?.locationUrl?.trim() ||
    "";

  // fallback: أقرب نقطة دالة للوجهة الثانية
  const secondCustomerLandmarkEffective =
    order.secondCustomerLandmark?.trim() ||
    secondCustomerPhoneProfile?.landmark?.trim() ||
    "";

  async function computeSmartHint(
    locationUrl: string,
    regionId: string | null | undefined,
  ): Promise<string> {
    if (!regionId) return "— لا توجد منطقة مرتبطة بالطلب";
    const points = await prisma.regionWaypoint.findMany({
      where: { regionId },
      orderBy: { sortOrder: "asc" },
      select: { name: true, latitude: true, longitude: true },
    });
    if (points.length === 0) return "— لا توجد مداخل محفوظة لهذه المنطقة";
    if (!String(locationUrl || "").trim()) return "— لا يوجد لوكيشن للزبون";
    const loc = await extractLatLngFromLocationInputSmart(locationUrl);
    if (!loc) return "— تعذر قراءة إحداثيات الرابط";
    let nearest: { name: string; dist: number } | null = null;
    for (const p of points) {
      const dist = haversineMeters(loc.latitude, loc.longitude, p.latitude, p.longitude);
      if (!nearest || dist < nearest.dist) nearest = { name: p.name?.trim() || "مدخل", dist };
    }
    if (!nearest) return "— تعذر احتساب أقرب مدخل";
    if (nearest.dist > 2500) return "— اللوكيشن بعيد عن مداخل المنطقة";
    return `قريب من (${nearest.name})`;
  }

  const [smartHintLine, secondSmartHintLine] = await Promise.all([
    computeSmartHint(customerLocationUrlEffective, order.customerRegionId),
    computeSmartHint(secondCustomerLocationUrlEffective, order.secondCustomerRegionId),
  ]);

  const normalizeCustomerName = (name: string | null | undefined) => {
    const trimmed = name?.trim();
    if (!trimmed) return null;
    const banned = ["العميل", "اسم العميل", "اسم الزبون"];
    if (banned.includes(trimmed)) return null;
    return trimmed;
  };

  const customerName = normalizeCustomerName(order.customer?.name);

  const moneyEventsRaw = await prisma.orderMoneyEvent.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
    take: 120,
    include: {
      courier: { select: { name: true } },
      recordedByCompanyPreparer: { select: { name: true } },
    },
  });
  const adminMoneyEvents = moneyEventsRaw.reverse().map((e) => ({
    id: e.id,
    kind: e.kind,
    amountDinar: Number(e.amountDinar ?? 0),
    expectedDinar: e.expectedDinar != null ? Number(e.expectedDinar) : null,
    matchesExpected: e.matchesExpected,
    mismatchReason: e.mismatchReason,
    mismatchNote: e.mismatchNote,
    recordedAt: e.createdAt.toISOString(),
    deletedAt: e.deletedAt?.toISOString() ?? null,
    deletedReason: e.deletedReason,
    deletedByDisplayName: e.deletedByDisplayName,
    performedByDisplayName:
      e.recordedByCompanyPreparer?.name?.trim() || e.courier?.name?.trim() || "—",
    recordedByCompanyPreparerId: e.recordedByCompanyPreparerId ?? null,
  }));

  const adminCustomWaButtons = waButtonSettings.flatMap((r) => {
    try {
      const scopes = (r.visibilityScope ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const canSeeAdmin =
        scopes.length === 0 ||
        scopes.includes("all") ||
        scopes.includes("admin") ||
        scopes.includes("mandoub");
      if (!canSeeAdmin) return [];

      const statuses = parseStatusesCsv(r.statusesCsv ?? "");
      if (statuses.length > 0 && !statuses.includes(order.status)) return [];

      const locRules = parseCustomerLocationRules(r.customerLocationRule ?? "any");
      const hasCustomerLocation = Boolean(customerLocationUrlEffective);
      const hasCourierUploadedLocation = Boolean(order.customerLocationSetByCourierAt);
      if (!matchesCustomerLocationRules(locRules, hasCustomerLocation, hasCourierUploadedLocation)) return [];

      const vars = {
        clientshop: order.shop?.name ?? "",
        city: order.customerRegion?.name ?? "",
        total_price: order.totalAmount != null ? formatDinarAsAlfWithUnit(order.totalAmount) : "",
        delivery: order.courier?.name ?? "",
        location_url: customerLocationUrlEffective,
        landmark: customerLandmarkEffective,
        order_number: String(order.orderNumber),
        customer_phone: order.customerPhone ?? "",
        customer_phone2: alternatePhoneEffective ?? "",
        shop_phone: submitterPhone,
      };

      const messages = splitMandoubWaTemplateVariants(r.templateText ?? "").map((t) =>
        applyMandoubWaTemplate(t, vars),
      );
      if (messages.length === 0) return [];

      return [
        {
          id: r.id,
          label: r.label ?? "",
          iconKey: r.iconKey ?? "💬",
          messages,
        },
      ];
    } catch (error) {
      console.error("Failed to build adminCustomWaButtons", {
        buttonId: r.id,
        error,
      });
      return [];
    }
  });

  const view = {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    routeMode: (order.routeMode === "double" ? "double" : "single") as
      | "single"
      | "double",
    adminOrderCode: order.adminOrderCode,
    orderType: order.orderType,
    summary: order.summary,
    customerPhone: order.customerPhone,
    alternatePhone: alternatePhoneEffective,
    secondCustomerPhone: order.secondCustomerPhone,
    secondCustomerLocationUrl: secondCustomerLocationUrlEffective,
    secondCustomerLandmark: secondCustomerLandmarkEffective,
    secondSmartHintLine: secondSmartHintLine || "—",
    secondCustomerDoorPhotoUrl: secondCustomerDoorPhotoUrlEffective,
    secondCustomerRegion: order.secondCustomerRegion ? { name: order.secondCustomerRegion.name } : null,
    orderNoteTime: order.orderNoteTime || null,
    imageUrl: order.imageUrl?.startsWith("data:") ? `/api/image/order/${order.id}/image` : (order.imageUrl || null),
    orderImageUploadedByName: order.orderImageUploadedByName || null,
    shopDoorPhotoUploadedByName: order.shopDoorPhotoUploadedByName || null,
    customerDoorPhotoUploadedByName: order.customerDoorPhotoUploadedByName || null,
    secondCustomerDoorPhotoUploadedByName: order.secondCustomerDoorPhotoUploadedByName || null,
    voiceNoteUrl: order.voiceNoteUrl?.startsWith("data:") ? `/api/image/order/${order.id}/voice` : (order.voiceNoteUrl || null),
    adminVoiceNoteUrl: order.adminVoiceNoteUrl?.startsWith("data:") ? `/api/image/order/${order.id}/admin-voice` : (order.adminVoiceNoteUrl || null),
    shopDoorPhotoUrl: order.shopDoorPhotoUrl?.startsWith("data:") ? `/api/image/order/${order.id}/shopDoor` : (order.shopDoorPhotoUrl || null),
    customerDoorPhotoUrl: customerDoorPhotoUrlEffective,
    customerLandmark: customerLandmarkEffective || "",
    smartHintLine: smartHintLine || "—",
    orderSubtotal:
      order.orderSubtotal != null ? formatDinarAsAlfWithUnit(order.orderSubtotal) : null,
    deliveryPrice:
      order.deliveryPrice != null ? formatDinarAsAlfWithUnit(order.deliveryPrice) : null,
    totalAmount:
      order.totalAmount != null ? formatDinarAsAlfWithUnit(order.totalAmount) : null,
    submissionSource: order.submissionSource || "unknown",
    createdAt: order.createdAt.toISOString(),
    prepaidAll: order.prepaidAll || false,
    reversePickup: isReversePickupOrderType(order.orderType),
    shop: {
      name: order.shop?.name ?? "",
      phone: order.shop?.phone ?? "",
      ownerName: order.shop?.ownerName ?? "",
    },
    shopPhotoUrl: (order.shop?.photoUrl?.startsWith("data:") ? `/api/image/shop/${order.shop?.id ?? order.shopId}/photo` : order.shop?.photoUrl) || "",
    shopLocationUrl: order.shop?.locationUrl ?? "",
    customerLocationUrl: customerLocationUrlEffective || "",
    customerLocationUploadedByName: order.customerLocationUploadedByName || null,
    customerRegion: order.customerRegion
      ? { name: order.customerRegion.name }
      : null,
    customerRegionId: order.customerRegionId || null,
    customerProfileId: customerPhoneProfile?.id ?? null,
    courier: order.courier
      ? { name: order.courier.name, phone: order.courier.phone }
      : null,
    customer: customerName ? { name: customerName } : null,
    submittedBy: order.submittedBy
      ? { name: order.submittedBy.name, phone: order.submittedBy.phone }
      : null,
    submittedByCompanyPreparer: order.submittedByCompanyPreparer
      ? { name: order.submittedByCompanyPreparer.name, phone: order.submittedByCompanyPreparer.phone }
      : null,
                      
      preparerShoppingJson: (() => {
      if (order.preparerShoppingJson == null) return null;
      try {
        return JSON.stringify(order.preparerShoppingJson);
      } catch (error) {
        console.warn(`[AdminOrderViewPage] Failed to stringify preparerShoppingJson for ${orderId}:`, error);
        return null;
      }
    })(),
  };

  // Safe JSON serialization with error handling
  let safeView, safeMoneyEvents, safePreparers, safeWaButtons;
  try {
    safeView = JSON.parse(JSON.stringify(view));
    safeMoneyEvents = JSON.parse(JSON.stringify(adminMoneyEvents));
    safePreparers = JSON.parse(JSON.stringify(preparers));
    safeWaButtons = JSON.parse(JSON.stringify(adminCustomWaButtons));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[AdminOrderViewPage] Serialization failed for order ${orderId}:`, {
      error: errorMessage,
      viewKeys: Object.keys(view),
      timestamp: new Date().toISOString(),
    });
    return <AdminOrderErrorUI orderId={orderId} error={`فشل في تحويل البيانات: ${errorMessage}`} />;
  }

  return (
    <div className="space-y-4">
      <p className={ad.muted}>
        <Link href="/admin/orders/tracking" className={ad.link}>
          ← تتبع الطلبات
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>عرض الطلب #{order.orderNumber}</h1>
        <p className={`mt-1 ${ad.lead}`}>
          تفاصيل للقراءة فقط — للتعديل استخدم زر «تعديل الطلب».
        </p>
      </div>
      <OrderViewContent order={safeView} preparers={safePreparers} customWaButtons={safeWaButtons} />
      <AdminOrderMoneyEvents
        orderNumber={order.orderNumber}
        nextPath={`/admin/orders/${order.id}`}
        events={safeMoneyEvents}
      />
    </div>
  );
}
