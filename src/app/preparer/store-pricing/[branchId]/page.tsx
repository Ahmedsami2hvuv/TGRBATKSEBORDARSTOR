import { prisma } from "@/lib/prisma";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { preparerPath } from "@/lib/preparer-portal-nav";
import Link from "next/link";
import { PricingListClient } from "./pricing-list-client";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function deepSanitize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return obj.toString();
  if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(o => deepSanitize(o));
  if (typeof obj === "object") {
    if (obj.constructor && (obj.constructor.name === "Decimal" || obj.constructor.name === "n" || typeof obj.toNumber === 'function')) {
      return Number(obj.toString());
    }
    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = deepSanitize(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

type Props = {
  params: Promise<{ branchId: string }>;
  searchParams: Promise<{ p?: string; exp?: string; s?: string }>;
};

export default async function BranchPricingPage({ params, searchParams }: Props) {
  try {
    const { branchId } = await params;
    const sp = await searchParams;
    const cookieStore = await cookies();

    let p = sp.p || cookieStore.get("preparer_p")?.value;
    let s = sp.s || cookieStore.get("preparer_s")?.value;
    let exp = sp.exp || cookieStore.get("preparer_exp")?.value;

    const v = verifyCompanyPreparerPortalQuery(p, exp, s);
    if (!v.ok) return <div className="p-10 text-center font-bold">رابط غير صالح</div>;

    const preparer = await prisma.companyPreparer.findFirst({
      where: { id: v.preparerId, active: true },
      select: {
        portalToken: true,
        authorizedBranches: {
          where: { id: branchId, active: true },
          take: 1,
          select: { id: true, name: true }
        }
      }
    });

    if (!preparer || preparer.portalToken !== v.token) {
      return <div className="p-10 text-center font-bold">رابط غير صالح أو انتهت الصلاحية</div>;
    }

    const branchRaw = preparer.authorizedBranches[0];
    if (!branchRaw) {
      return <div className="p-10 text-center font-bold text-rose-600">الفرع غير موجود أو ليس لديك صلاحية</div>;
    }

    const productsRaw = await prisma.storeProduct.findMany({
      where: { branchId: branchRaw.id, active: true },
      include: {
        variants: {
          where: { active: true },
          orderBy: { sequence: "asc" }
        }
      },
      orderBy: { sequence: "asc" }
    });

    const products = productsRaw.map(p => ({
      id: p.id,
      name: p.name,
      purchasePrice: Number(p.purchasePrice || 0),
      image: (Array.isArray(p.photoUrls) && p.photoUrls[0]) || "",
      hasVariants: p.hasVariants,
      variants: p.variants.map(v => ({
        id: v.id,
        name: v.name,
        purchasePrice: Number(v.purchasePrice || 0)
      }))
    }));

    const baseAuth = { p, exp, s };

    return (
      <div className="mx-auto max-w-4xl px-4 py-6" dir="rtl">
        <header className="mb-6">
          <Link href={preparerPath("/preparer/store-pricing", baseAuth)} className="text-emerald-600 font-bold text-sm">
            ← العودة للأقسام
          </Link>
          <h1 className="text-2xl font-black text-slate-900 mt-2">تسعير {branchRaw.name}</h1>
        </header>

        <PricingListClient
          branch={deepSanitize(branchRaw)}
          products={deepSanitize(products)}
          auth={baseAuth}
        />
      </div>
    );
  } catch (err: any) {
    return <div className="p-20 text-center text-rose-600 font-bold">حدث خطأ: {err.message}</div>;
  }
}
