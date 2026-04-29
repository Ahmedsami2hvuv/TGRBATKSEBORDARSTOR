import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
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

  const [order, preparers, waButtonSettings] = await Promise.all([
    prisma.order.findUnique({
      where: { id: orderId },
      include: {
        shop: true,
        customerRegion: true,
        secondCustomerRegion: true,
        courier: true,
        customer: true,
        submittedBy: true,
        submittedByCompanyPreparer: true,
        moneyEvents: {
          orderBy: { createdAt: "asc" },
          include: {
            courier: { select: { name: true } },
            recordedByCompanyPreparer: { select: { name: true } },
          },
        },
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

  if (!order) {
    notFound();
  }

  const customerPhoneNorm = normalizeIraqMobileLocal11(order.customerPhone);
  const customerPhoneProfile =
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

  const secondPhoneNorm = order.secondCustomerPhone?.trim()
    ? normalizeIraqMobileLocal11(order.secondCustomerPhone)
    : null;
  const secondCustomerPhoneProfile =
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

  const normalizeCustomerName = (name: string | null | undefined) => {
    const trimmed = name?.trim();
    if (!trimmed) return null;
    const banned = ["العميل", "اسم العميل", "اسم الزبون"];
    if (banned.includes(trimmed)) return null;
    return trimmed;
  };

  const customerName = normalizeCustomerName(order.customer?.name);

  const adminMoneyEvents = order.moneyEvents.map((e) => ({
    id: e.id,
    kind: e.kind,
    amountDinar: Number(e.amountDinar),
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
    secondCustomerDoorPhotoUrl: secondCustomerDoorPhotoUrlEffective,
    secondCustomerRegion: order.secondCustomerRegion ? { name: order.secondCustomerRegion.name } : null,
    orderNoteTime: order.orderNoteTime,
    imageUrl: order.imageUrl?.startsWith("data:") ? `/api/image/order/${order.id}/image` : order.imageUrl,
    orderImageUploadedByName: order.orderImageUploadedByName,
    shopDoorPhotoUploadedByName: order.shopDoorPhotoUploadedByName,
    customerDoorPhotoUploadedByName: order.customerDoorPhotoUploadedByName,
    secondCustomerDoorPhotoUploadedByName: order.secondCustomerDoorPhotoUploadedByName,
    voiceNoteUrl: order.voiceNoteUrl,
    adminVoiceNoteUrl: order.adminVoiceNoteUrl,
    shopDoorPhotoUrl: order.shopDoorPhotoUrl?.startsWith("data:") ? `/api/image/order/${order.id}/shopDoor` : order.shopDoorPhotoUrl,
    customerDoorPhotoUrl: customerDoorPhotoUrlEffective,
    customerLandmark: customerLandmarkEffective,
    orderSubtotal:
      order.orderSubtotal != null ? formatDinarAsAlfWithUnit(order.orderSubtotal) : null,
    deliveryPrice:
      order.deliveryPrice != null ? formatDinarAsAlfWithUnit(order.deliveryPrice) : null,
    totalAmount:
      order.totalAmount != null ? formatDinarAsAlfWithUnit(order.totalAmount) : null,
    submissionSource: order.submissionSource,
    createdAt: order.createdAt,
    prepaidAll: order.prepaidAll,
    reversePickup: isReversePickupOrderType(order.orderType),
    shop: {
      name: order.shop?.name ?? "",
      phone: order.shop?.phone ?? "",
      ownerName: order.shop?.ownerName ?? "",
    },
    shopPhotoUrl: order.shop?.photoUrl?.startsWith("data:") ? `/api/image/shop/${order.shop?.id ?? order.shopId}/photo` : order.shop?.photoUrl,
    shopLocationUrl: order.shop?.locationUrl ?? "",
    customerLocationUrl: customerLocationUrlEffective,
    customerLocationUploadedByName: order.customerLocationUploadedByName,
    customerRegion: order.customerRegion
      ? { name: order.customerRegion.name }
      : null,
    customerRegionId: order.customerRegionId,
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
    preparerShoppingJson: order.preparerShoppingJson,
  };

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
      <OrderViewContent order={view} preparers={preparers} customWaButtons={adminCustomWaButtons} />
      <AdminOrderMoneyEvents
        orderNumber={order.orderNumber}
        nextPath={`/admin/orders/${order.id}`}
        events={adminMoneyEvents}
      />
    </div>
  );
}
