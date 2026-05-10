import { cookies } from "next/headers";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { preparerCourierAssignWhere } from "@/lib/courier-assignable";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { prisma } from "@/lib/prisma";
import { PreparerAssignCourierFab } from "../../preparer-assign-courier-fab";
import { PreparerOrderDetailSection } from "../../preparer-order-detail-section";
import type { MandoubOrderDetailPayload } from "@/lib/mandoub-order-queries";
import { mandoubOrderDetailInclude } from "@/lib/mandoub-order-queries";
import { getGlobalIcons } from "@/lib/icon-settings";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ p?: string; exp?: string; s?: string; tab?: string; q?: string }>;
};

function invalidMsg(reason: string) {
  switch (reason) {
    case "expired": return "انتهت صلاحية الرابط. اطلب رابطاً جديداً من الإدارة.";
    case "bad_signature":
    case "missing": return "الرابط غير صالح. تأكد من نسخه كاملاً.";
    case "no_secret": return "إعداد الخادم غير مكتمل.";
    default: return "تعذّر التحقق.";
  }
}

export default async function PreparerOrderDetailPage({ params, searchParams }: Props) {
  const { orderId } = await params;
  const sp = await searchParams;
  const cookieStore = await cookies();

  // جلب بيانات التوثيق من الرابط أو الكوكيز
  const p = sp.p || (await cookieStore).get("preparer_p")?.value;
  const exp = sp.exp || (await cookieStore).get("preparer_exp")?.value;
  const s = sp.s || (await cookieStore).get("preparer_s")?.value;

  const v = verifyCompanyPreparerPortalQuery(p, exp, s);

  if (!v.ok) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-16">
        <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
          <p className="text-lg font-bold text-rose-700">لا يمكن فتح الطلب</p>
          <p className="mt-2 text-sm text-slate-600">{invalidMsg(v.reason)}</p>
        </div>
      </div>
    );
  }

  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    include: { shopLinks: { select: { shopId: true } } },
  });

  if (!preparer) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-16">
        <div className="kse-glass-dark rounded-2xl p-8 text-center">
          <p className="text-lg font-bold text-slate-800">الحساب غير متاح</p>
        </div>
      </div>
    );
  }

  const orderRaw = await prisma.order.findUnique({
    where: { id: orderId },
    include: mandoubOrderDetailInclude,
  });

  if (!orderRaw) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-16">
        <div className="kse-glass-dark rounded-2xl p-8 text-center">
          <p className="text-lg font-bold text-slate-800">الطلب غير موجود</p>
        </div>
      </div>
    );
  }

  // تحويل جميع القيم العشرية (Decimal) إلى أرقام (number) لتجنب خطأ serialization
  const order: MandoubOrderDetailPayload = {
    ...orderRaw,
    orderSubtotal: orderRaw.orderSubtotal ? Number(orderRaw.orderSubtotal) : null,
    deliveryPrice: orderRaw.deliveryPrice ? Number(orderRaw.deliveryPrice) : null,
    totalAmount: orderRaw.totalAmount ? Number(orderRaw.totalAmount) : null,
    courierEarningDinar: orderRaw.courierEarningDinar ? Number(orderRaw.courierEarningDinar) : null,
    moneyEvents: orderRaw.moneyEvents.map((ev) => ({
      ...ev,
      amountDinar: Number(ev.amountDinar),
      expectedDinar: ev.expectedDinar ? Number(ev.expectedDinar) : null,
    })),
  };

  const { normalizeIraqMobileLocal11 } = await import("@/lib/whatsapp");
  const phoneNorm = normalizeIraqMobileLocal11(order.customerPhone);
  const phoneProfile = phoneNorm && order.customerRegionId ? await prisma.customerPhoneProfile.findUnique({
    where: { phone_regionId: { phone: phoneNorm, regionId: order.customerRegionId } },
  }) : null;

  const secondPhoneNorm = order.secondCustomerPhone ? normalizeIraqMobileLocal11(order.secondCustomerPhone) : null;
  const secondPhoneProfile = secondPhoneNorm && order.secondCustomerRegionId ? await prisma.customerPhoneProfile.findUnique({
    where: { phone_regionId: { phone: secondPhoneNorm, regionId: order.secondCustomerRegionId } },
  }) : null;

  const auth = { p: p!, exp: exp!, s: s! };
  const homeHref = preparerPath("/preparer", auth);

  const icons = await getGlobalIcons();

  const prepJson = orderRaw.preparerShoppingJson as any;
  const hasPreparerShoppingJson = prepJson != null;

  // جلب صور المنتجات للطلبات المنظمة مع تحسين الموازنة (Mapping)
  const productLines = (prepJson?.products || []).map((p: any) => p.line.trim());

  // نستخدم استعلاماً أكثر مرونة للبحث عن المنتجات:
  // 1. الاسم الكامل (Full match)
  // 2. الكلمة الأولى (Prefix match)
  // 3. البحث في الكلمات (Keyword match)
  const productSearchTerms = productLines.flatMap((line: string) => {
    const parts = line.split(/\s+/).filter((p: string) => p.length > 1);
    return [line, ...parts];
  });

  const matchingProducts = productLines.length > 0 ? await prisma.storeProduct.findMany({
    where: {
      active: true,
      OR: [
        { name: { in: productSearchTerms, mode: 'insensitive' } },
        ...productLines.map((line: string) => ({
           name: { contains: line.split(' ')[0], mode: 'insensitive' }
        }))
      ].slice(0, 100)
    },
    select: {
      name: true,
      photoUrls: true,
      branch: { select: { name: true } }
    }
  }) : [];

  const productImagesMap: Record<string, string> = {};
  const productBranchMap: Record<string, string> = {};

  productLines.forEach(line => {
    const lineKey = line.toLowerCase();

    // محاولة المطابقة بالترتيب: الاسم الكامل أولاً، ثم الجزئي
    let match = matchingProducts.find(p => p.name.trim().toLowerCase() === lineKey);

    if (!match) {
      const firstWord = lineKey.split(' ')[0];
      match = matchingProducts.find(p => p.name.trim().toLowerCase().includes(firstWord));
    }

    if (match) {
      if (match.photoUrls && Array.isArray(match.photoUrls) && match.photoUrls.length > 0) {
        productImagesMap[lineKey] = match.photoUrls[0];
      } else if (typeof match.photoUrls === 'string' && match.photoUrls) {
        productImagesMap[lineKey] = match.photoUrls;
      }
      if (match.branch?.name) {
        productBranchMap[lineKey] = match.branch.name;
      }
    }
  });

  // دالة التطهير العميقة المطورة: تعالج BigInt و Decimal و Date يدوياً
  function deepSanitize(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "bigint") return obj.toString();
    if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) return obj.map(deepSanitize);
    if (typeof obj === "object") {
      if (obj.constructor && (obj.constructor.name === "Decimal" || obj.constructor.name === "n")) return Number(obj.toString());
      if (Object.hasOwn(obj, 'd') && Object.hasOwn(obj, 's') && Object.hasOwn(obj, 'e')) return Number(obj.toString());
      const newObj: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = deepSanitize(obj[key]);
      }
      return newObj;
    }
    return obj;
  }

  // إخفاء الأرقام الحساسة في Client Component وتطهير كافة البيانات لمنع خطأ الـ Serialization
  const safeOrder: MandoubOrderDetailPayload = deepSanitize({
    ...order,
    customerPhone: "",
    alternatePhone: "",
    secondCustomerPhone: "",
    shop: { ...order.shop, phone: "" },
    submittedBy: order.submittedBy ? { ...order.submittedBy, phone: "" } : null,
    submittedByCompanyPreparer: order.submittedByCompanyPreparer
      ? { ...order.submittedByCompanyPreparer, phone: "" }
      : null,
  });
  const safePhoneProfile = phoneProfile ? deepSanitize({ ...phoneProfile, phone: "", alternatePhone: null }) : null;
  const safeSecondPhoneProfile = secondPhoneProfile ? deepSanitize({ ...secondPhoneProfile, phone: "", alternatePhone: null }) : null;

  const preparerInvoiceIds: string[] = Array.isArray(prepJson?.preparerInvoices)
    ? prepJson.preparerInvoices
        .map((inv: any) => String(inv?.preparerId ?? ""))
        .filter((id: string) => id !== "")
    : [];

  // السماح للمجهز بالوصول للوحة التسعير إذا:
  // 1. هو من أنشأ الطلب
  // 2. هو أحد المجهزين المسندين للفواتير
  // 3. الطلب قادم من المتجر وهو المجهز الحالي الذي يشاهد الطلب (أو سيقوم الإدمن بإسناده له)
  const canEditPricing = hasPreparerShoppingJson && orderRaw.status !== "delivered" && (
    orderRaw.submittedByCompanyPreparerId === preparer.id ||
    preparerInvoiceIds.includes(preparer.id)
  );
  const pricingEditHref = canEditPricing ? preparerPath(`/preparer/preparation/edit/${orderId}`, auth) : undefined;

  const couriers = await prisma.courier.findMany({
    where: preparerCourierAssignWhere,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const canAssign = (order.status === "pending" || order.status === "assigned") && couriers.length > 0;

  return (
    <div className="kse-app-inner mx-auto max-w-lg px-3 py-4 pb-24 sm:px-4">
      <PreparerOrderDetailSection
        order={safeOrder}
        closeHref={homeHref}
        auth={auth}
        nextUrl={preparerPath(`/preparer/order/${orderId}`, auth)}
        preparerId={preparer.id}
        phoneProfile={safePhoneProfile}
        secondPhoneProfile={safeSecondPhoneProfile}
        canEditPricing={canEditPricing}
        pricingEditHref={pricingEditHref}
        icons={icons}
        productImagesMap={productImagesMap}
        productBranchMap={productBranchMap}
      />

      {canAssign && (
        <PreparerAssignCourierFab
          auth={auth}
          orderId={order.id}
          couriers={couriers.map((c) => ({ id: c.id, name: c.name }))}
          defaultCourierId={order.assignedCourierId}
        />
      )}
    </div>
  );
}