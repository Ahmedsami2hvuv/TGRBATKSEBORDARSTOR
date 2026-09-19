import Link from "next/link";
import { notFound } from "next/navigation";
import { dinarDecimalToAlfInputString, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import type { Prisma } from "@prisma/client";
import { courierAssignableWhere } from "@/lib/courier-assignable";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { orderStatusBadgeClass } from "@/lib/order-status-style";
import { digitsOnly, normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
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
  cancelled: "مرفوض",
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
  const [customerPhoneProfile, globalBlockedRecord, shopBlockedRecord] = await Promise.all([
    customerPhoneNorm && order.customerRegionId
      ? prisma.customerPhoneProfile.findUnique({
          where: {
            phone_regionId: {
              phone: customerPhoneNorm,
              regionId: order.customerRegionId,
            },
          },
          select: {
            id: true,
            photoUrl: true,
            isBlocked: true,
            locationUrl: true,
            landmark: true,
            alternatePhone: true,
          },
        })
      : null,
    customerPhoneNorm
      ? prisma.globalBlockedPhone.findUnique({
          where: { phone: customerPhoneNorm },
        })
      : null,
    customerPhoneNorm && order.shopId
      ? prisma.shopBlockedPhone.findUnique({
          where: {
            shopId_phone: {
              shopId: order.shopId,
              phone: customerPhoneNorm,
            },
          },
        })
      : null,
  ]);

  const getCustomerDoorUrl = () => {
    const fromCustomer = order.customer?.customerDoorPhotoUrl?.trim();
    if (fromCustomer?.startsWith("data:")) return null;
    if (fromCustomer) return fromCustomer;
    if (order.customerDoorPhotoUrl?.trim()?.startsWith("data:")) return `/api/image/order/${order.id}/customerDoor`;
    if (order.customerDoorPhotoUrl?.trim()) return order.customerDoorPhotoUrl;
    if (customerPhoneProfile?.photoUrl?.trim()?.startsWith("data:")) return `/api/image/customerPhoneProfile/${customerPhoneProfile.id}/photo`;
    return customerPhoneProfile?.photoUrl?.trim() || null;
  };
  const defaultCustomerDoorPhotoUrlEffective: string | null = getCustomerDoorUrl();

  const defaultCustomerLocationUrlEffective =
    order.customerLocationUrl?.trim() ||
    order.customer?.customerLocationUrl?.trim() ||
    customerPhoneProfile?.locationUrl?.trim() ||
    "";

  const defaultCustomerLandmarkEffective =
    order.customerLandmark?.trim() ||
    order.customer?.customerLandmark?.trim() ||
    customerPhoneProfile?.landmark?.trim() ||
    "";

  const defaultAlternatePhoneEffective =
    order.alternatePhone?.trim() ||
    customerPhoneProfile?.alternatePhone?.trim() ||
    "";

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
      e.recordedByCompanyPreparer?.name?.trim() || e.courier?.name?.trim() || (!e.courierId && !e.recordedByCompanyPreparerId ? "الإدارة" : "—"),
    recordedByCompanyPreparerId: e.recordedByCompanyPreparerId ?? null,
  }));

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-start p-2 pt-14 pb-8 sm:p-4 sm:justify-center bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain animate-in fade-in duration-200">
      <div
        className="w-full max-w-3xl rounded-[24px] border-[2px] border-[#C9A86A] bg-[#FFFEF8] shadow-[0_16px_50px_rgba(0,0,0,0.5),inset_0_1px_0_white,0_0_0_1px_#E8D5A3_inset] text-right relative overflow-hidden flex flex-col select-none my-auto sm:my-0 max-h-[86dvh] sm:max-h-[92vh] shrink-0"
        dir="rtl"
      >
        {/* معينات الزوايا المذهبة الملكية */}
        <div className="absolute top-[8px] right-[8px] w-[6px] h-[6px] rotate-45 bg-gradient-to-br from-[#E8C77E] to-[#C9A86A] pointer-events-none z-30" />
        <div className="absolute top-[8px] left-[8px] w-[6px] h-[6px] rotate-45 bg-gradient-to-br from-[#E8C77E] to-[#C9A86A] pointer-events-none z-30" />
        <div className="absolute bottom-[8px] right-[8px] w-[6px] h-[6px] rotate-45 bg-gradient-to-br from-[#E8C77E] to-[#C9A86A] pointer-events-none z-30" />
        <div className="absolute bottom-[8px] left-[8px] w-[6px] h-[6px] rotate-45 bg-gradient-to-br from-[#E8C77E] to-[#C9A86A] pointer-events-none z-30" />

        {/* ترويسة المودال الملكية الفاخرة الثابتة في الأعلى */}
        <div className="flex items-center justify-between border-b-[1.5px] border-[#E8D5A3] p-3.5 sm:p-4.5 bg-[#FFFEF8] shrink-0 z-20 shadow-xs">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-[34px] h-[34px] rounded-[10px] bg-gradient-to-b from-[#F1D99A] via-[#E8C77E] to-[#C9A86A] flex items-center justify-center shadow-sm border border-[#9C7D46]/30 shrink-0">
              <svg className="w-[16px] h-[16px] text-[#0A3D2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-[#0A3D2E] leading-none">
                  تعديل الطلب #{order.orderNumber}
                </h1>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${orderStatusBadgeClass(order.status)}`}
                >
                  {STATUS_AR[order.status] ?? order.status}
                </span>
              </div>
            </div>
          </div>
          <Link
            href={`/abo1stor3hlaa2kbr8-47/orders/${order.id}`}
            className="w-8 h-8 rounded-full bg-white border border-[#C9A86A]/40 text-slate-700 hover:text-[#0A3D2E] hover:bg-[#FDF6E3] font-bold flex items-center justify-center cursor-pointer text-sm shadow-xs transition shrink-0"
            title="إغلاق والعودة لتفاصيل الطلب"
          >
            ✕
          </Link>
        </div>

        {/* محتوى نموذج التعديل القابل للتمرير */}
        <div className="overflow-y-auto p-3.5 sm:p-6 space-y-5 flex-1 overscroll-contain">
          <OrderEditForm
            orderId={order.id}
            orderNumber={order.orderNumber}
            routeMode={order.routeMode as "single" | "double"}
            defaultShopId={order.shopId}
            defaultSubmittedByEmployeeId={defaultSubmittedByEmployeeId}
            employees={employeesAll}
            defaultStatus={order.status}
            defaultOrderType={order.orderType}
            defaultSummary={order.summary}
            defaultCustomerPhone={order.customerPhone}
            defaultAlternatePhone={defaultAlternatePhoneEffective}
            defaultCustomerLocationUrl={defaultCustomerLocationUrlEffective}
            defaultCustomerLandmark={defaultCustomerLandmarkEffective}
            defaultCustomerId={order.customerId ?? ""}
            customers={customers}
            defaultCustomerRegionId={order.customerRegionId ?? ""}
            defaultSecondCustomerPhone={order.secondCustomerPhone ?? ""}
            defaultSecondAlternatePhone={order.secondCustomerAlternatePhone ?? ""}
            defaultSecondCustomerRegionId={order.secondCustomerRegionId ?? ""}
            defaultSecondCustomerLocationUrl={order.secondCustomerLocationUrl ?? ""}
            defaultSecondCustomerLandmark={order.secondCustomerLandmark ?? ""}
            defaultSecondCustomerDoorPhotoUrl={order.secondCustomerDoorPhotoUrl}
            defaultImageUrl={order.imageUrl?.startsWith("data:") ? `/api/image/order/${order.id}/image` : order.imageUrl}
            defaultOrderImageUploadedByName={order.orderImageUploadedByName}
            defaultCustomerDoorPhotoUrl={defaultCustomerDoorPhotoUrlEffective}
            defaultCustomerDoorPhotoUploadedByName={order.customerDoorPhotoUploadedByName}
            defaultCustomerLocationUploadedByName={order.customerLocationUploadedByName}
            defaultVoiceNoteUrl={order.voiceNoteUrl}
            defaultAdminVoiceNoteUrl={order.adminVoiceNoteUrl}
            defaultPurchasePrice={
              order.purchasePrice != null ? dinarDecimalToAlfInputString(order.purchasePrice) : ""
            }
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
            defaultIsBlocked={!!globalBlockedRecord || (customerPhoneProfile?.isBlocked ?? false)}
            defaultIsShopBlocked={!!shopBlockedRecord}
          />
          <AdminOrderMoneyEvents
            orderId={order.id}
            orderNumber={order.orderNumber}
            orderStatus={order.status}
            assignedCourierId={order.assignedCourierId}
            courierName={couriers.find(c => c.id === order.assignedCourierId)?.name ?? null}
            orderSubtotalDinar={order.orderSubtotal ? Number(order.orderSubtotal) : null}
            totalAmountDinar={order.totalAmount ? Number(order.totalAmount) : null}
            prepaidAll={order.prepaidAll}
            nextPath={`/abo1stor3hlaa2kbr8-47/orders/${order.id}/edit`}
            events={adminMoneyEvents}
          />
        </div>
      </div>
    </div>
  );
}
