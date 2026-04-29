import Link from "next/link";
import { notFound } from "next/navigation";
import { dinarDecimalToAlfInputString, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import type { Prisma } from "@prisma/client";
import { courierAssignableWhere } from "@/lib/courier-assignable";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { orderStatusBadgeClass } from "@/lib/order-status-style";
import { digitsOnly, normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { AdminOrderFloatingBar } from "./admin-order-floating-bar";
import { AdminOrderMoneyEvents } from "../admin-order-money-events";
import { OrderEditForm } from "./order-edit-form";

function phoneMatchKey(raw: string): string {
  return normalizeIraqMobileLocal11(raw) ?? digitsOnly(raw);
}

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ orderId: string }> };

export async function generateMetadata({ params }: Props) {
  const { orderId } = await params;
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true },
  });
  return {
    title: o ? `تعديل الطلب #${o.orderNumber} — أبو الأكبر للتوصيل` : "تعديل طلب — أبو الأكبر للتوصيل",
  };
}

const STATUS_AR: Record<string, string> = {
  pending: "قيد الانتظار",
  assigned: "مسند للمندوب",
  delivering: "قيد التوصيل",
  delivered: "تم التسليم",
  cancelled: "ملغي",
  archived: "مؤرشف",
};

export default async function EditOrderPage({ params }: Props) {
  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      shop: true,
      customerRegion: true,
      courier: true,
      submittedBy: { select: { id: true, name: true, phone: true } },
      submittedByCompanyPreparer: true,
      customer: true,
      moneyEvents: {
        orderBy: { createdAt: "asc" },
        include: {
          courier: { select: { name: true } },
          recordedByCompanyPreparer: { select: { name: true } },
        },
      },
    },
  });

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
          select: { id: true, photoUrl: true },
        })
      : null;

  const getCustomerDoorUrl = () => {
    if (order.customerDoorPhotoUrl?.trim()?.startsWith("data:")) return `/api/image/order/${order.id}/customerDoor`;
    if (order.customerDoorPhotoUrl?.trim()) return order.customerDoorPhotoUrl;
    if (customerPhoneProfile?.photoUrl?.trim()?.startsWith("data:")) return `/api/image/customerPhoneProfile/${customerPhoneProfile.id}/photo`;
    return customerPhoneProfile?.photoUrl?.trim() || null;
  };
  const defaultCustomerDoorPhotoUrlEffective: string | null = getCustomerDoorUrl();

  const courierWhere: Prisma.CourierWhereInput = {
    OR: [
      courierAssignableWhere,
      ...(order.assignedCourierId ? [{ id: order.assignedCourierId }] : []),
    ],
  };

  const [shops, regions, couriers, customersAll, employeesAll] = await Promise.all([
    prisma.shop.findMany({
      orderBy: { name: "asc" },
      include: { region: true },
    }),
    prisma.region.findMany({ orderBy: { name: "asc" } }),
    prisma.courier.findMany({ where: courierWhere, orderBy: { name: "asc" } }),
    prisma.customer.findMany({
      select: {
        id: true,
        shopId: true,
        name: true,
        phone: true,
        customerRegionId: true,
        customerLocationUrl: true,
        customerLandmark: true,
      },
      orderBy: [{ shopId: "asc" }, { name: "asc" }],
    }),
    prisma.employee.findMany({
      select: { id: true, shopId: true, name: true },
      orderBy: [{ shopId: "asc" }, { name: "asc" }],
    }),
  ]);

  const defaultSubmittedByEmployeeId =
    order.submittedByEmployeeId &&
    employeesAll.some(
      (e) => e.id === order.submittedByEmployeeId && e.shopId === order.shopId,
    )
      ? order.submittedByEmployeeId
      : "";

  const courierPhoneKeys = new Set(
    couriers.map((c) => phoneMatchKey(c.phone)).filter((k) => k.length > 0),
  );
  const customers = customersAll.filter(
    (c) => !courierPhoneKeys.has(phoneMatchKey(c.phone)),
  );

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

  return (
    <div className="space-y-6">
      <p className={ad.muted}>
        <Link href={`/admin/orders/${order.id}`} className={ad.link}>
          ← عرض الطلب
        </Link>
        <span className="text-slate-400"> | </span>
        <Link href="/admin/orders/tracking" className={ad.link}>
          تتبع الطلبات
        </Link>
      </p>
      <div>
        <div className="flex flex-wrap items-center justify-start gap-2">
          <h1 className={ad.h1}>تعديل الطلب #{order.orderNumber}</h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${orderStatusBadgeClass(order.status)}`}
          >
            {STATUS_AR[order.status] ?? order.status}
          </span>
        </div>
        <p className={`mt-1 ${ad.lead}`}>
          للاطلاع على التفاصيل دون حقول التعديل استخدم{" "}
          <Link href={`/admin/orders/${order.id}`} className={ad.link}>
            عرض الطلب
          </Link>
          .
        </p>
      </div>
      <section className="space-y-4">
        <OrderEditForm
          orderId={order.id}
          orderNumber={order.orderNumber}
          defaultShopId={order.shopId}
          defaultSubmittedByEmployeeId={defaultSubmittedByEmployeeId}
          employees={employeesAll}
          defaultStatus={order.status}
          defaultOrderType={order.orderType}
          defaultSummary={order.summary}
          defaultCustomerPhone={order.customerPhone}
          defaultAlternatePhone={order.alternatePhone ?? ""}
          defaultCustomerLocationUrl={order.customerLocationUrl}
          defaultCustomerLandmark={order.customerLandmark}
          defaultCustomerId={order.customerId ?? ""}
          customers={customers}
          defaultCustomerRegionId={order.customerRegionId ?? ""}
          defaultImageUrl={order.imageUrl?.startsWith("data:") ? `/api/image/order/${order.id}/image` : order.imageUrl}
          defaultOrderImageUploadedByName={order.orderImageUploadedByName}
          defaultCustomerDoorPhotoUrl={defaultCustomerDoorPhotoUrlEffective}
          defaultCustomerDoorPhotoUploadedByName={order.customerDoorPhotoUploadedByName}
          defaultCustomerLocationUploadedByName={order.customerLocationUploadedByName}
          defaultVoiceNoteUrl={order.voiceNoteUrl}
          defaultAdminVoiceNoteUrl={order.adminVoiceNoteUrl}
          defaultOrderSubtotal={
            order.orderSubtotal != null ? dinarDecimalToAlfInputString(order.orderSubtotal) : ""
          }
          defaultDeliveryPrice={
            order.deliveryPrice != null ? dinarDecimalToAlfInputString(order.deliveryPrice) : ""
          }
          defaultTotalAmount={
            order.totalAmount != null ? dinarDecimalToAlfInputString(order.totalAmount) : ""
          }
          defaultOrderNoteTime={order.orderNoteTime ?? ""}
          defaultAssignedCourierId={
            order.status === "pending" ||
            order.status === "cancelled" ||
            order.status === "archived"
              ? ""
              : (order.assignedCourierId ?? "")
          }
          shops={shops.map((s) => ({
            id: s.id,
            name: s.name,
            regionDeliveryPrice: dinarDecimalToAlfInputString(s.region.deliveryPrice),
          }))}
          regions={regions.map((r) => ({
            id: r.id,
            name: r.name,
            deliveryPrice: dinarDecimalToAlfInputString(r.deliveryPrice),
          }))}
          couriers={couriers.map((c) => ({ id: c.id, name: c.name }))}
          defaultPrepaidAll={order.prepaidAll}
        />
      </section>
      <AdminOrderMoneyEvents
        orderNumber={order.orderNumber}
        nextPath={`/admin/orders/${order.id}/edit`}
        events={adminMoneyEvents}
      />
      <AdminOrderFloatingBar
        pending={false}
        hasCustomerImportChoice={false}
      />
    </div>
  );
}
