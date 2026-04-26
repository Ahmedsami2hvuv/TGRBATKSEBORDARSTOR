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

  // تحسين الأداء: جلب فقط المنتجات التي تظهر أسماؤها داخل الطلب الحالي بدلاً من جلب كامل المتجر
  const draftData = draft.data as any;
  const productLines = (draftData?.products || []).map((p: any) => p.line.trim().toLowerCase());

  const matchingProducts = productLines.length > 0 ? await prisma.storeProduct.findMany({
    where: {
      active: true,
      OR: productLines.map((line: string) => ({
        name: { equals: line.split(' ')[0], mode: 'insensitive' } // مطابقة أول كلمة من اسم المنتج كحد أدنى
      })).slice(0, 50) // حد أقصى للبحث لضمان السرعة
    },
    select: {
      name: true,
      photoUrls: true,
      branch: { select: { name: true } }
    }
  }) : [];

  const productImagesMap: Record<string, string> = {};
  const productBranchMap: Record<string, string> = {};

  matchingProducts.forEach(p => {
    const nameKey = p.name.trim().toLowerCase();
    if (p.photoUrls && Array.isArray(p.photoUrls) && p.photoUrls.length > 0) {
      productImagesMap[nameKey] = p.photoUrls[0];
    } else if (typeof p.photoUrls === 'string' && p.photoUrls) {
      productImagesMap[nameKey] = p.photoUrls;
    }

    if (p.branch?.name) {
      productBranchMap[nameKey] = p.branch.name;
    }
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
        draft={draft}
        draftOwnerId={draft.preparerId}
        preparerId={preparer.id}
        preparerName={preparer.name}
        productImagesMap={productImagesMap}
        productBranchMap={productBranchMap}
      />
    </div>
  );
}
