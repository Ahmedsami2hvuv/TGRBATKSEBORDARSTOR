import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PreparerSiteOrderDraftClient } from "./preparer-site-order-draft-client";
import { PreparerSiteOrderPrepClient } from "./preparer-site-order-prep-client";
import { PreparerOrdersSection } from "../../preparer-orders-client";
import { PreparerPrepNoticeBanner } from "../../preparer-prep-notice-banner";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { prisma } from "@/lib/prisma";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { MandoubRow } from "@/app/mandoub/mandoub-order-table";
import { hasCustomerLocationUrl } from "@/lib/order-location";
import { sumDeliveryInFromOrderMoneyEvents, sumPickupOutFromOrderMoneyEvents } from "@/lib/mandoub-money";
import { isWardMismatch, isSaderMismatch } from "@/lib/mandoub-money";
import { preparerAssignableWhere } from "@/lib/preparer-assignable";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ p?: string; exp?: string; s?: string; tab?: string; q?: string }>;
};

export default async function PreparerPreparationPage({ searchParams }: Props) {
  const sp = await searchParams;
  const cookieStore = await cookies();

  let p = sp.p;
  let s = sp.s;
  let exp = sp.exp;
  let tab = sp.tab === "orders" ? "orders" : "draft";

  if (!p || !s || !exp) {
    p = p || cookieStore.get("preparer_p")?.value;
    s = s || cookieStore.get("preparer_s")?.value;
    exp = exp || cookieStore.get("preparer_exp")?.value;
  }

  const v = verifyCompanyPreparerPortalQuery(p, exp, s);

  if (!v.ok) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-16">
        <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
          <p className="text-lg font-bold text-rose-700">تعذّر فتح الصفحة</p>
          <p className="mt-2 text-sm text-slate-600">الرابط غير صالح. تأكد من نسخه كاملاً.</p>
        </div>
      </div>
    );
  }

  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    include: {
      shopLinks: { include: { shop: { select: { id: true, name: true, region: { select: { name: true, deliveryPrice: true } } } } } },
      prepNotices: { where: { dismissedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!preparer || preparer.portalToken !== v.token) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-16">
        <div className="kse-glass-dark rounded-2xl border border-amber-300 p-8 text-center">
          <p className="text-lg font-bold text-amber-900">الحساب غير متاح</p>
          <p className="mt-2 text-sm text-slate-600">حساب المجهز غير مفعّل أو تم تحديث الرابط.</p>
        </div>
      </div>
    );
  }

  const auth = { p: p!, exp: exp!, s: s! };
  const homeHref = preparerPath("/preparer", auth);
  const prepHref = preparerPath("/preparer/preparation", auth);

  const notices = preparer.prepNotices.map((n) => ({ id: n.id, title: n.title, body: n.body }));

  const shops = preparer.shopLinks
    .filter((l) => l.canSubmitOrders)
    .map((l) => ({
      id: l.shop.id,
      name: l.shop.name,
      shopRegionName: l.shop.region.name,
      shopDeliveryAlf: Number(l.shop.region.deliveryPrice) / 1000,
    }));

  // --- جلب الطلبات المسندة لهذا المجهز (من جدول Orders) ---
  // يجب أن نعرض الطلبات التي تم إنشاؤها بواسطة الإدارة وربطها بهذا المجهز.
  // نفترض أننا سنبحث في جدول Order باستخدام submittedByCompanyPreparerId
  const assignedOrders = await prisma.order.findMany({
    where: {
      submittedByCompanyPreparerId: preparer.id,
      status: { not: "archived" },
    },
    include: {
      shop: { select: { id: true, name: true, photoUrl: true, locationUrl: true, phone: true, region: { select: { name: true } } } },
      customerRegion: { select: { name: true } },
      customer: { select: { customerDoorPhotoUrl: true, customerLocationUrl: true } },
      courier: { select: { name: true, phone: true } },
      submittedByCompanyPreparer: { select: { name: true } },
      moneyEvents: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const couriers = await prisma.courier.findMany({
    where: preparerAssignableWhere,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // تحويل الطلبات إلى نفس تنسيق MandoubRow لتتوافق مع PreparerOrdersSection
  const orderRows: MandoubRow[] = assignedOrders.map((order) => {
    const moneyEvents = order.moneyEvents;
    const deliverySum = sumDeliveryInFromOrderMoneyEvents(moneyEvents);
    const pickupSum = sumPickupOutFromOrderMoneyEvents(moneyEvents);
    const totalAmountNumber = order.totalAmount ? Number(order.totalAmount) : null;
    const orderSubtotalNumber = order.orderSubtotal ? Number(order.orderSubtotal) : null;
    const deliveryPriceNumber = order.deliveryPrice ? Number(order.deliveryPrice) : null;

    const hasCustomerLocation = hasCustomerLocationUrl(order.customerLocationUrl, order.customer?.customerLocationUrl);
    // تجاهل hasCourierUploadedLocation لعدم وجوده في نموذج الطلب مباشرة، يمكن تركه false أو حسابه من جدول آخر.
    const hasCourierUploadedLocation = false;

    const wardMismatch = isWardMismatch(order.status, totalAmountNumber ? totalAmountNumber : null, deliverySum);
    const saderMismatch = isSaderMismatch(order.status, orderSubtotalNumber ? orderSubtotalNumber : null, pickupSum);

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      assignedCourierId: order.assignedCourierId,
      shopName: order.shop.name,
      shopRegionName: order.shop.region?.name || "",
      shopPhotoUrl: order.shop.photoUrl,
      shopLocationUrl: order.shop.locationUrl,
      shopPhone: order.shop.phone,
      customerPhone: order.customerPhone,
      customerAlternatePhone: order.alternatePhone || "",
      customerName: order.customer?.name || "",
      customerLandmark: order.customerLandmark,
      customerLocationUrl: order.customerLocationUrl || order.customer?.customerLocationUrl || "",
      customerDoorPhotoUrl: order.customer?.customerDoorPhotoUrl || "",
      hasCustomerLocation,
      hasCourierUploadedLocation,
      orderType: order.orderType,
      orderNoteTime: order.orderNoteTime,
      summary: order.summary,
      totalAmount: totalAmountNumber,
      deliveryPrice: deliveryPriceNumber,
      orderSubtotal: orderSubtotalNumber,
      customerRegionName: order.customerRegion?.name || "",
      courierName: order.courier?.name || "",
      assignedPreparerIds: [preparer.id],
      prepNoticeCount: 0,
      wardMismatchType: wardMismatch.type,
      saderMismatchType: saderMismatch.type,
      orderImageUploadedByName: order.orderImageUploadedByName,
      shopDoorPhotoUploadedByName: order.shopDoorPhotoUploadedByName,
      customerDoorPhotoUploadedByName: order.customerDoorPhotoUploadedByName,
      secondCustomerDoorPhotoUploadedByName: order.secondCustomerDoorPhotoUploadedByName,
      adminVoiceNoteUrl: order.adminVoiceNoteUrl,
      lastUpdatedAtIso: order.updatedAt.toISOString(),
    } as MandoubRow;
  });

  // جلب قيم البحث لـ PreparerOrdersSection لمطابقة النص
  const searchFields = orderRows.map((row) => ({
    id: row.id,
    orderNumber: row.orderNumber,
    orderType: row.orderType || "",
    customerPhone: row.customerPhone,
    alternatePhone: row.customerAlternatePhone,
    secondCustomerPhone: "",
    summary: row.summary || "",
    customerLandmark: row.customerLandmark || "",
    secondCustomerLandmark: "",
    orderNoteTime: row.orderNoteTime || "",
    shopName: row.shopName,
    regionName: row.customerRegionName,
    secondRegionName: "",
    routeMode: "single",
    courierName: row.courierName,
    adminOrderCode: "",
    submissionSource: "",
    customerLocationUrl: row.customerLocationUrl,
    customerLocationUploadedByName: "",
    secondCustomerLocationUrl: "",
    secondCustomerDoorPhotoUploadedByName: "",
    customerDoorPhotoUploadedByName: row.customerDoorPhotoUploadedByName || "",
    orderImageUploadedByName: row.orderImageUploadedByName || "",
    shopDoorPhotoUploadedByName: row.shopDoorPhotoUploadedByName || "",
    preparerShoppingText: "",
    submittedByEmployeeName: "",
    submittedByPreparerName: "",
    createdAtIso: row.lastUpdatedAtIso,
  }));


  return (
    <div className="kse-app-inner mx-auto max-w-2xl px-4 py-6">
      <PreparerPrepNoticeBanner notices={notices} auth={auth} preparationHref={prepHref} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => redirect(preparerPath("/preparer/preparation?tab=draft", auth))}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${tab === "draft" ? "bg-sky-900 text-white shadow-md" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            ➕ طلبات تجهيز جديدة
          </button>
          <button
            onClick={() => redirect(preparerPath("/preparer/preparation?tab=orders", auth))}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${tab === "orders" ? "bg-sky-900 text-white shadow-md" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            📦 طلباتي المسندة
          </button>
        </div>
      </div>

      {tab === "draft" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h1 className="mb-2 text-base font-black text-slate-900">تحويل قائمة واتساب إلى طلب تجهيز</h1>
            <p className="mb-4 text-xs text-slate-500">
              الصق رسالة الزبون (واتساب، الموقع)، سيتم تحليلها تلقائياً.
            </p>
            {shops.length === 0 ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                لا توجد محلات مفعلة لك. اطلب من الإدارة إضافة محلات في قسم المجهزين.
              </p>
            ) : (
              <PreparerSiteOrderPrepClient auth={auth} preparerName={preparer.name} shops={shops} homeHref={homeHref} />
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h1 className="mb-2 text-base font-black text-slate-900">الطلبات المسندة إليك</h1>
            <p className="mb-4 text-xs text-slate-500">
              قائمة الطلبات التي قامت الإدارة بتحويلها إليك للتجهيز.
            </p>
            {orderRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-slate-500 font-bold">لا توجد طلبات مسندة إليك حالياً.</p>
                <p className="mt-2 text-xs text-slate-400">سيظهر هنا أي طلب تقوم الإدارة بتحويله لحسابك لتجهيزه.</p>
              </div>
            ) : (
              <PreparerOrdersSection
                allRows={orderRows}
                searchFields={searchFields}
                auth={auth}
                tab="active"
                couriersForBulkAssign={couriers}
                icons={null}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}