import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { resolvePublicAssetSrc } from "@/lib/image-url";
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
import { computeSmartHint } from "@/lib/smart-hint-logic";
import { haversineMeters } from "@/lib/geo-distance";
import { getTwoWayTemplates } from "@/lib/two-way-whatsapp-settings";

const SYSTEM_ADMIN_PHONE = "07733921568";
const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";
export const dynamic = "force-dynamic";

type Props = {
 params: Promise<{ orderId: string }>;
 searchParams: Promise<{ view?: string }>;
};

export default async function AdminOrderViewPage({ params, searchParams }: Props) {
 const { orderId } = await params;
 const sp = await searchParams;
 const modalOnly = sp.view === "modal";

 const order = await prisma.order.findUnique({
 where: { id: orderId },
 include: {
 submittedBy: { select: { name: true, phone: true } },
 submittedByCompanyPreparer: { select: { name: true, phone: true } },
 shop: { select: { id: true, name: true, phone: true, ownerName: true, photoUrl: true, locationUrl: true, region: { select: { name: true } } } },
 customerRegion: { select: { name: true } },
 secondCustomerRegion: { select: { name: true } },
 courier: { select: { name: true, phone: true } },
 customer: { select: { name: true, customerDoorPhotoUrl: true } },
 },
 });

 if (!order) notFound();

 // جلب البيانات الملحقة
 const customerPhoneNorm = normalizeIraqMobileLocal11(order.customerPhone);
 const secondPhoneNorm = order.secondCustomerPhone ? normalizeIraqMobileLocal11(order.secondCustomerPhone) : null;

 const [preparers, waButtonSettings, customerProfile, secondProfile, moneyEventsRaw, storeProducts, twoWayTemplates, couriersRaw] = await Promise.all([
 prisma.companyPreparer.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
 prisma.mandoubWaButtonSetting.findMany({ where: { isActive: true }, orderBy: { updatedAt: "desc" } }),
 customerPhoneNorm && order.customerRegionId ? prisma.customerPhoneProfile.findUnique({
 where: { phone_regionId: { phone: customerPhoneNorm, regionId: order.customerRegionId } }
 }) : Promise.resolve(null),
 secondPhoneNorm && order.secondCustomerRegionId ? prisma.customerPhoneProfile.findUnique({
 where: { phone_regionId: { phone: secondPhoneNorm, regionId: order.secondCustomerRegionId } }
 }) : Promise.resolve(null),
 prisma.orderCourierMoneyEvent.findMany({
 where: { orderId, deletedAt: null },
 orderBy: { createdAt: "desc" },
 include: { courier: { select: { name: true } }, recordedByCompanyPreparer: { select: { name: true } } }
 }),
 prisma.storeProduct.findMany({
   where: { active: true },
   select: {
     id: true,
     name: true,
     salePrice: true,
     hasVariants: true,
     variants: {
       where: { active: true },
       select: {
         id: true,
         name: true,
         salePrice: true,
       }
     }
   }
 }),
 getTwoWayTemplates().catch(() => null),
 prisma.courier.findMany({
  where: { blocked: false, hiddenFromReports: false },
  select: { id: true, name: true, phone: true },
  orderBy: { name: "asc" }
 }),
 ]);

 const customerLocationUrlEffective = order.customerLocationUrl || customerProfile?.locationUrl || "";
 const secondCustomerLocationUrlEffective = order.secondCustomerLocationUrl || secondProfile?.locationUrl || "";

 const [smartHintLine, secondSmartHintLine] = await Promise.all([
 computeSmartHint(order.id, "primary"),
 computeSmartHint(order.id, "secondary"),
 ]);

 const submitterPhone = order.submittedByCompanyPreparer?.phone || order.submittedBy?.phone ||
 (order.submissionSource === "admin_portal" ? SYSTEM_ADMIN_PHONE : order.shop?.phone || "");

 const getCustomerDoorUrl = () => {
 if (order.customerDoorPhotoUrl) return order.customerDoorPhotoUrl.startsWith("data:") ? `/api/image/order/${order.id}/customerDoor` : order.customerDoorPhotoUrl;
 if (customerProfile?.photoUrl) return customerProfile.photoUrl.startsWith("data:") ? `/api/image/customerPhoneProfile/${customerProfile.id}/photo` : customerProfile.photoUrl;
 return order.customer?.customerDoorPhotoUrl || null;
 };

 const view = {
 ...order,
 imageUrl: resolvePublicAssetSrc(order.imageUrl?.startsWith("data:") ? `/api/image/order/${order.id}/image` : order.imageUrl),
 voiceNoteUrl: resolvePublicAssetSrc(order.voiceNoteUrl?.startsWith("data:") ? `/api/image/order/${order.id}/voice` : order.voiceNoteUrl),
 adminVoiceNoteUrl: resolvePublicAssetSrc(order.adminVoiceNoteUrl?.startsWith("data:") ? `/api/image/order/${order.id}/admin-voice` : order.adminVoiceNoteUrl),
 shopDoorPhotoUrl: resolvePublicAssetSrc(order.shopDoorPhotoUrl?.startsWith("data:") ? `/api/image/order/${order.id}/shopDoor` : (order.shopDoorPhotoUrl || order.shop?.photoUrl)),
 customerDoorPhotoUrl: resolvePublicAssetSrc(getCustomerDoorUrl()),
 secondCustomerDoorPhotoUrl: resolvePublicAssetSrc(order.secondCustomerDoorPhotoUrl?.startsWith("data:") ? `/api/image/order/${order.id}/secondCustomerDoor` : order.secondCustomerDoorPhotoUrl),
 shopPhotoUrl: resolvePublicAssetSrc(order.shop?.photoUrl?.startsWith("data:") ? `/api/image/shop/${order.shopId}/photo` : order.shop?.photoUrl),
 orderSubtotalRaw: order.orderSubtotal ? Number(order.orderSubtotal) : 0,
 deliveryPriceRaw: order.deliveryPrice ? Number(order.deliveryPrice) : 0,
 totalAmountRaw: order.totalAmount ? Number(order.totalAmount) : 0,
 orderSubtotal: order.orderSubtotal != null ? formatDinarAsAlfWithUnit(order.orderSubtotal) : null,
 deliveryPrice: order.deliveryPrice != null ? formatDinarAsAlfWithUnit(order.deliveryPrice) : null,
 totalAmount: order.totalAmount != null ? formatDinarAsAlfWithUnit(order.totalAmount) : null,
 createdAt: order.createdAt.toISOString(),
 reversePickup: isReversePickupOrderType(order.orderType),
 smartHintLine,
 secondSmartHintLine,
 customerLandmark: order.customerLandmark || customerProfile?.landmark || "",
 alternatePhone: order.alternatePhone || customerProfile?.alternatePhone || null,
 customerLocationUrl: customerLocationUrlEffective,
 shopLocationUrl: order.shop?.locationUrl || "",
 customerProfileId: customerProfile?.id || null,
 isBlocked: customerProfile?.isBlocked || false,
 preparerShoppingJson: order.preparerShoppingJson ? JSON.stringify(order.preparerShoppingJson) : null,
 };

 const adminMoneyEvents = moneyEventsRaw.reverse().map(e => ({
 ...e,
 amountDinar: Number(e.amountDinar),
 expectedDinar: e.expectedDinar != null ? Number(e.expectedDinar) : null,
 recordedAt: e.createdAt.toISOString(),
 performedByDisplayName: e.recordedByCompanyPreparer?.name || e.courier?.name || (!e.courierId && !e.recordedByCompanyPreparerId ? "الإدارة" : "—"),
 }));

  const adminCustomWaButtons = waButtonSettings.flatMap(r => {
    // 1. فحص الصلاحية (هل يظهر للإدارة؟)
    const scopes = (r.visibilityScope || "all")
      .split(",")
      .map((s) => s.trim())
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
      clientshop: order.shop?.name || "",
      city: order.customerRegion?.name || "",
      total_price: view.totalAmount || "",
      location_url: customerLocationUrlEffective,
      order_number: String(order.orderNumber),
      customer_phone: order.customerPhone,
      shop_phone: submitterPhone,
    };
    const messages = splitMandoubWaTemplateVariants(r.templateText || "").map(t => applyMandoubWaTemplate(t, vars));
    return messages.length > 0 ? [{ id: r.id, label: r.label, iconKey: r.iconKey, messages }] : [];
  });

 const safeView = JSON.parse(JSON.stringify(view));
 const safeMoneyEvents = JSON.parse(JSON.stringify(adminMoneyEvents));
 const safePreparers = JSON.parse(JSON.stringify(preparers));
 const safeWaButtons = JSON.parse(JSON.stringify(adminCustomWaButtons));
 const safeStoreProducts = JSON.parse(JSON.stringify(storeProducts));
 const safeTwoWayTemplates = twoWayTemplates ? JSON.parse(JSON.stringify(twoWayTemplates)) : null;
 const safeCouriers = JSON.parse(JSON.stringify(couriersRaw));

 return (
  <div className="space-y-4">
    <OrderViewContent order={safeView} preparers={safePreparers} customWaButtons={safeWaButtons} storeProducts={safeStoreProducts} twoWayTemplates={safeTwoWayTemplates} couriers={safeCouriers} />
    <AdminOrderMoneyEvents orderNumber={order.orderNumber} nextPath={`${SECRET_ADMIN_PATH}/orders/${order.id}`} events={safeMoneyEvents} />
  </div>
 );
}
