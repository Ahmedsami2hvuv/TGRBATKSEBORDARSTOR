import Link from "next/link";
import { cookies } from "next/headers";
import { ALF_PER_DINAR } from "@/lib/money-alf";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { prisma } from "@/lib/prisma";
import { PreparerSiteOrderPrepEditClient } from "../../preparer-site-order-prep-edit-client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ p?: string; exp?: string; s?: string }>;
};

function invalidMsg(reason: string) {
  switch (reason) {
    case "expired":
      return "انتهت صلاحية الرابط. اطلب رابطاً جديداً من الإدارة.";
    case "bad_signature":
    case "missing":
      return "الرابط غير صالح. تأكد من نسخه كاملاً.";
    case "no_secret":
      return "إعداد الخادم غير مكتمل.";
    default:
      return "تعذّر التحقق.";
  }
}

export default async function PreparerPreparationEditPage({ params, searchParams }: Props) {
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
        <p className="text-center font-bold text-rose-700">الرابط غير صالح</p>
        <p className="mt-2 text-center text-xs text-slate-500">يرجى العودة للرابط الأصلي.</p>
      </div>
    );
  }

  const auth = { p: p!, exp: exp!, s: s! };
  const home = preparerPath("/preparer", auth);
  const prep = preparerPath("/preparer/preparation", auth);

  // دالة التطهير العميقة لضمان التوافق مع Next.js 15 ومنع أخطاء الـ Serialization
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

  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    include: {
      shopLinks: {
        where: { canSubmitOrders: true },
        orderBy: { assignedAt: "asc" },
        include: { shop: { include: { region: true } } },
      },
    },
  });

  if (!preparer) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-10">
        <p className="text-center text-slate-800">الحساب غير متاح.</p>
        <Link href={home} className="mt-4 block text-center font-bold text-sky-700 underline">
          العودة للطلبات
        </Link>
      </div>
    );
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      shopId: true,
      customerPhone: true,
      orderNoteTime: true,
      customerLandmark: true,
      customerRegionId: true,
      customerRegion: { select: { id: true, name: true, deliveryPrice: true } },
      customer: { select: { name: true } },
      preparerShoppingJson: true,
      submittedByCompanyPreparerId: true,
      submissionSource: true,
      deliveryPrice: true,
      vehiclePreference: true,
    },
  });

  const orderPrepJson = order?.preparerShoppingJson as any;
  const preparerInvoiceIds = Array.isArray(orderPrepJson?.preparerInvoices)
    ? orderPrepJson.preparerInvoices
        .map((inv: any) => String(inv?.preparerId ?? ""))
        .filter((id: string) => id !== "")
    : [];

  const isWebStoreOrder = (order as any)?.submissionSource === "web_store";

  const hasAccessToEdit = order != null && order.preparerShoppingJson != null && (
    order.submittedByCompanyPreparerId === v.preparerId ||
    preparerInvoiceIds.includes(v.preparerId) ||
    (isWebStoreOrder && order.status === "pending")
  );

  if (!order || !hasAccessToEdit) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-10">
        <p className="text-center text-slate-800">الطلب غير موجود أو ليس طلب تجهيز تسوق.</p>
        <Link href={home} className="mt-4 block text-center font-bold text-sky-700 underline">
          العودة للطلبات
        </Link>
      </div>
    );
  }

  if (order.status === "delivered") {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-10">
        <p className="text-center font-bold text-amber-900">لا يمكن تعديل الطلب بعد تم التسليم.</p>
        <Link href={home} className="mt-4 block text-center font-bold text-sky-700 underline">
          العودة للطلبات
        </Link>
      </div>
    );
  }

  if (!order.customerRegion || !order.customerRegionId) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-10">
        <p className="text-center font-bold text-amber-900">لا يمكن تعديل الطلب بدون منطقة زبون.</p>
        <Link href={prep} className="mt-4 block text-center font-bold text-sky-700 underline">
          فتح تجهيز الطلبات
        </Link>
      </div>
    );
  }

  const payload = order.preparerShoppingJson as
    | {
      version?: number;
      titleLine?: unknown;
      products?: unknown;
      placesCount?: unknown;
      rawListText?: unknown;
    }
    | null;
  const productsRaw = Array.isArray(payload?.products) ? payload.products : [];
  const products = productsRaw
    .map((p) => {
      if (!p || typeof p !== "object") return null;
      const row = p as Record<string, unknown>;
      const line = String(row.line ?? "").trim();
      const buyAlf = Number(row.buyAlf);
      const sellAlf = Number(row.sellAlf);
      if (!line || !Number.isFinite(buyAlf) || !Number.isFinite(sellAlf) || buyAlf < 0 || sellAlf < 0) {
        return null;
      }
      return { line, buyAlf, sellAlf };
    })
    .filter((x): x is { line: string; buyAlf: number; sellAlf: number } => x !== null);

  const placesCountNum = Number(payload?.placesCount);
  if (payload?.version !== 1 || products.length === 0) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-10">
        <p className="text-center font-bold text-amber-900">صيغة بيانات الطلب غير صالحة للتعديل من هذه الصفحة.</p>
        <Link href={prep} className="mt-4 block text-center font-bold text-sky-700 underline">
          فتح تجهيز الطلبات
        </Link>
      </div>
    );
  }

  const canUseShop = preparer.shopLinks.some((l) => l.shop.id === order.shopId);
  if (!canUseShop) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-10">
        <p className="text-center font-bold text-amber-900">هذا الطلب ليس ضمن محلاتك المفعّلة للتجهيز.</p>
        <Link href={home} className="mt-4 block text-center font-bold text-sky-700 underline">
          العودة للطلبات
        </Link>
      </div>
    );
  }

  const shops = deepSanitize(preparer.shopLinks.map((l) => ({
    id: l.shop.id,
    name: l.shop.name,
    shopRegionName: l.shop.region.name,
    shopDeliveryAlf: Number(l.shop.region.deliveryPrice.toString()) / ALF_PER_DINAR,
  })));

  return (
    <div className="kse-app-inner mx-auto max-w-6xl px-4 py-8 pb-24">
      <div className="mx-auto mb-4 max-w-lg text-sm">
        <Link href={prep} className="font-bold text-sky-800 hover:underline">
          ← تجهيز الطلبات
        </Link>
      </div>
      <div className="mx-auto max-w-lg">
        <PreparerSiteOrderPrepEditClient
          auth={auth}
          orderId={order.id}
          orderNumber={Number(order.orderNumber)}
          preparerName={preparer.name}
          shops={shops}
          homeHref={home}
          prepHref={prep}
          initialData={deepSanitize({
            titleLine: String(payload?.titleLine ?? order.customerRegion?.name ?? "").trim(),
            products,
            placesCount: Number.isFinite(placesCountNum) && placesCountNum > 0 ? Math.floor(placesCountNum) : 1,
            rawListText: typeof payload?.rawListText === "string" ? payload.rawListText : undefined,
            shopId: order.shopId,
            customerRegionId: order.customerRegionId,
            customerRegionName: order.customerRegion.name,
            customerRegionDeliveryDinar: Number(order.customerRegion.deliveryPrice),
            customerPhone: order.customerPhone?.trim() || "",
            customerName: order.customer?.name?.trim() || "",
            orderTime: order.orderNoteTime?.trim() || "فوري",
            customerLandmark: order.customerLandmark?.trim() || "",
            vehiclePreference: (order as any).vehiclePreference || null,
            deliveryPriceOverride: order.deliveryPrice ? Number(order.deliveryPrice) : null,
          })}
        />
      </div>
    </div>
  );
}
