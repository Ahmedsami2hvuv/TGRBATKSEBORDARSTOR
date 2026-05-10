import Link from "next/link";
import { cookies } from "next/headers";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { prisma } from "@/lib/prisma";
import { PreparerShoppingDraftEditClient } from "./preparer-shopping-draft-edit-client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ draftId: string }>;
  searchParams: Promise<{ p?: string; exp?: string; s?: string }>;
};

export default async function PreparerShoppingDraftPage({ params, searchParams }: Props) {
  const { draftId } = await params;
  const sp = await searchParams;
  const cookieStore = await cookies();

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
  const prepHref = preparerPath("/preparer/preparation", auth);

  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    include: { shopLinks: { where: { canSubmitOrders: true }, include: { shop: true } } },
  });

  if (!preparer) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-16">
        <p className="text-center text-slate-800">الحساب غير متاح.</p>
        <Link href={prepHref} className="mt-4 block text-center font-bold text-sky-700 underline">
          العودة إلى تجهيز الطلبات
        </Link>
      </div>
    );
  }

  // السماح بفتح المسودة بدون التأكد الصارم من الهوية لمنع الانهيار
  const draft = await prisma.companyPreparerShoppingDraft.findFirst({
    where: { id: draftId },
    select: {
      id: true,
      preparerId: true,
      status: true,
      titleLine: true,
      rawListText: true,
      customerRegionId: true,
      customerRegion: { select: { id: true, name: true, deliveryPrice: true } },
      customerPhone: true,
      customerName: true,
      customerLandmark: true,
      orderTime: true,
      placesCount: true,
      data: true,
      sentOrderId: true,
      createdAt: true,
    },
  });

  if (!draft) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-16">
        <p className="text-center font-bold text-rose-700">المسودة غير موجودة.</p>
        <Link href={prepHref} className="mt-4 block text-center font-bold text-sky-700 underline">
          العودة إلى تجهيز الطلبات
        </Link>
      </div>
    );
  }

  // تحسين الأداء: جلب فقط المنتجات التي تظهر أسماؤها أو معرفاتها داخل الطلب الحالي
  const draftData = draft.data as any;
  const productsList = (draftData?.products || []) as any[];
  const productLines = productsList.map((p: any) => p.line.trim().toLowerCase());
  const productIds = productsList.map((p: any) => p.productId).filter(Boolean);

  const matchingProducts = await prisma.storeProduct.findMany({
    where: {
      OR: [
        { id: { in: productIds } },
        { name: { in: productLines } },
        // Fallback for partial matches if needed
        ...productLines.map((line: string) => ({
          name: { equals: line.split(' ')[0], mode: 'insensitive' }
        })).slice(0, 20)
      ]
    },
    select: {
      id: true,
      name: true,
      photoUrls: true,
      branch: { select: { name: true } }
    }
  });

  const productImagesMap: Record<string, string> = {};
  const productBranchMap: Record<string, string> = {};

  productsList.forEach((p: any) => {
    const lineKey = p.line.trim().toLowerCase();

    // البحث عن المنتج بالمعرف أولاً ثم بالاسم
    const match = matchingProducts.find(mp => mp.id === p.productId)
               || matchingProducts.find(mp => mp.name.trim().toLowerCase() === lineKey)
               || matchingProducts.find(mp => mp.name.trim().toLowerCase() === lineKey.split(' ')[0]);

    if (match) {
      let url = "";
      if (match.photoUrls && Array.isArray(match.photoUrls) && match.photoUrls.length > 0) {
        url = match.photoUrls[0];
      } else if (typeof match.photoUrls === 'string' && match.photoUrls) {
        url = match.photoUrls;
      }

      if (url) {
        productImagesMap[lineKey] = url;
        if (match.id) productImagesMap[match.id] = url;
      }
      if (match.branch?.name) {
        productBranchMap[lineKey] = match.branch.name;
        if (match.id) productBranchMap[match.id] = match.branch.name;
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

  // إخفاء الأرقام والبيانات الحساسة لضمان الخصوصية عند المجهز وتطهير البيانات لمنع خطأ الـ Serialization
  const isLikelyPhone = (text: string) => /^[0-9+ \-()]{7,15}$/.test(text.trim());
  const safeDraft = deepSanitize({
    ...draft,
    customerPhone: "",
    customerName: draft.customerName && isLikelyPhone(draft.customerName) ? "" : draft.customerName,
    titleLine: draft.titleLine && isLikelyPhone(draft.titleLine) ? "" : draft.titleLine,
  });

  return (
    <div className="kse-app-inner mx-auto max-w-2xl px-4 py-6 pb-24">
      <div className="mb-4 text-sm">
        <Link href={prepHref} className="font-bold text-sky-800 hover:underline">
          ← العودة إلى خانة التجهيز
        </Link>
      </div>
      <PreparerShoppingDraftEditClient
        auth={auth}
        draft={safeDraft}
        draftOwnerId={draft.preparerId}
        preparerId={preparer.id}
        preparerName={preparer.name}
        productImagesMap={productImagesMap}
        productBranchMap={productBranchMap}
      />
    </div>
  );
}
