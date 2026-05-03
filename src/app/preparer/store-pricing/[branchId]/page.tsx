import { prisma } from "@/lib/prisma";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { preparerPath } from "@/lib/preparer-portal-nav";
import Link from "next/link";
import { PricingListClient } from "./pricing-list-client";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ branchId: string }>;
  searchParams: Promise<{ p?: string; exp?: string; s?: string }>;
};

export default async function BranchPricingPage({ params, searchParams }: Props) {
  try {
    const { branchId } = await params;
    const sp = await searchParams;
    const cookieStore = await cookies();

    let p = sp.p;
    let s = sp.s;
    let exp = sp.exp;

    if (!p || !s || !exp) {
      p = p || cookieStore.get("preparer_p")?.value;
      s = s || cookieStore.get("preparer_s")?.value;
      exp = exp || cookieStore.get("preparer_exp")?.value;
    }

    const v = verifyCompanyPreparerPortalQuery(p, exp, s);

    if (!v.ok) return <div className="p-10 text-center font-bold">رابط غير صالح</div>;

    const preparer = await prisma.companyPreparer.findFirst({
      where: { id: v.preparerId, active: true },
      select: { portalToken: true }
    });

    if (!preparer || preparer.portalToken !== v.token) {
      return <div className="p-10 text-center font-bold">رابط غير صالح أو انتهت الصلاحية</div>;
    }

    const branchRaw = await prisma.storeBranch.findFirst({
      where: {
        id: branchId,
        active: true,
        authorizedPreparerId: v.preparerId,
      },
    });

    if (!branchRaw) {
      return (
        <div className="p-10 text-center font-bold text-rose-600" dir="rtl">
          الفرع غير موجود أو ليس لديك صلاحية تسعير عليه. إن رأيته في القائمة سابقاً، تأكد أن الإدارة ربطت الفرع بحسابك.
        </div>
      );
    }

    const productsRaw = await prisma.storeProduct.findMany({
      where: { branchId: branchRaw.id, active: true },
      select: {
        id: true,
        name: true,
        purchasePrice: true,
        photoUrls: true,
      },
      orderBy: { sequence: "asc" }
    });

    const products = productsRaw.map(p => ({
      id: String(p.id),
      name: String(p.name),
      purchasePrice: p.purchasePrice ? Number(p.purchasePrice) : 0,
      image: (Array.isArray(p.photoUrls) && p.photoUrls[0]) || (typeof p.photoUrls === "string" ? p.photoUrls : ""),
    }));

    const branch = {
      id: String(branchRaw.id),
      name: String(branchRaw.name),
    };

    const baseAuth = { p, exp, s };

    return (
      <div className="kse-app-inner mx-auto max-w-4xl px-4 py-6" dir="rtl">
        <header className="mb-6">
          <div className="flex items-center justify-between mb-2">
             <Link href={preparerPath("/preparer/store-pricing", baseAuth)} className="text-emerald-600 font-black text-sm">
               ← العودة للأقسام
             </Link>
          </div>
          <h1 className="text-2xl font-black text-slate-900">تسعير {branch.name}</h1>
          <p className="text-[10px] text-slate-400 font-bold mt-1">تعديل أسعار الشراء لتحديث كلف النظام.</p>
        </header>

        <PricingListClient
          branch={branch as any}
          products={products as any}
          auth={baseAuth}
        />
      </div>
    );
  } catch (err: any) {
    return (
      <div className="p-20 text-center" dir="rtl">
        <h1 className="text-xl font-bold text-rose-600">خطأ في جلب بيانات الفرع</h1>
        <p className="text-xs mt-2 text-slate-400">{err.message}</p>
      </div>
    );
  }
}
