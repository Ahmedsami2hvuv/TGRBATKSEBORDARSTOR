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
import { haversineMeters } from "@/lib/geo-distance";

const SYSTEM_ADMIN_PHONE = "07733921568";
export const dynamic = "force-dynamic";

type Props = {
 params: Promise<{ orderId: string }>;
 searchParams: Promise<{ view?: string }>;
};

async function computeSmartHint(locationUrl: string, regionId: string | null): Promise<string> {
 if (!regionId || !locationUrl.trim()) return "—";
 try {
 const points = await prisma.regionWaypoint.findMany({
 where: { regionId },
 orderBy: { sortOrder: "asc" },
 select: { name: true, latitude: true, longitude: true },
 });
 if (points.length === 0) return "—";
 const loc = await extractLatLngFromLocationInputSmart(locationUrl);
 if (!loc) return "—";
 let nearest = null;
 for (const p of points) {
 const dist = haversineMeters(loc.latitude, loc.longitude, p.latitude, p.longitude);
 if (!nearest || dist < nearest.dist) nearest = { name: p.name, dist };
 }
 return nearest && nearest.dist < 2500 ? `قريب من (${nearest.name})` : "—";
 } catch { return "—"; }
}

export default async function AdminOrderViewPage({ params, searchParams }: Props) {
 const { orderId } = await params;
 const sp = await searchParams;
 const modalOnly = sp.view === "modal";

 const order = await prisma.order.findUnique({
 where: { id: orderId },
 include: {
 submittedBy: { select: { name: true, phone: true } },
 submittedByCompanyPreparer: { select: { name: true, phone: true } },
 shop: { select: { id: true, name: true, phone: true, ownerName: true, photoUrl: true, locationUrl: true } },
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

 const [preparers, waButtonSettings, customerProfile, secondProfile, moneyEventsRaw] = await Promise.all([
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
 })
 ]);

 const customerLocationUrlEffective = order.customerLocationUrl || customerProfile?.locationUrl || "";
 const secondCustomerLocationUrlEffective = order.secondCustomerLocationUrl || secondProfile?.locationUrl || "";

 const [smartHintLine, secondSmartHintLine] = await Promise.all([
 computeSmartHint(customerLocationUrlEffective, order.customerRegionId),
 computeSmartHint(secondCustomerLocationUrlEffective, order.secondCustomerRegionId),
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
 customerProfileId: customerProfile?.id || null,
 preparerShoppingJson: order.preparerShoppingJson ? JSON.stringify(order.preparerShoppingJson) : null,
 };

 const adminMoneyEvents = moneyEventsRaw.reverse().map(e => ({
 ...e,
 amountDinar: Number(e.amountDinar),
 expectedDinar: e.expectedDinar != null ? Number(e.expectedDinar) : null,
 recordedAt: e.createdAt.toISOString(),
 performedByDisplayName: e.recordedByCompanyPreparer?.name || e.courier?.name || "—",
 }));

 const adminCustomWaButtons = waButtonSettings.flatMap(r => {
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

 return (
 <div className="space-y-4">
 <p className={ad.muted}>
 <Link href="/admin/orders/tracking" className={ad.link}>← تتبع الطلبات</Link>
 </p>
 <h1 className={ad.h1}>عرض الطلب #{order.orderNumber}</h1>
 <OrderViewContent order={safeView} preparers={safePreparers} customWaButtons={safeWaButtons} />
 <AdminOrderMoneyEvents orderNumber={order.orderNumber} nextPath={`/admin/orders/${order.id}`} events={safeMoneyEvents} />
 </div>
 );
}
