import { prisma } from "@/lib/prisma";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { preparerPath } from "@/lib/preparer-portal-nav";
import Link from "next/link";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ p?: string; exp?: string; s?: string }>;
};

export default async function PreparerStorePricingPage({ searchParams }: Props) {
  try {
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

    if (!v.ok || !v.preparerId) {
      return (
        <div className="p-20 text-center" dir="rtl">
           <h1 className="text-xl font-bold text-slate-900">رابط غير صالح</h1>
           <p className="text-slate-500 mt-2">عذراً، الرابط المستخدم غير صحيح أو منتهي الصلاحية.</p>
        </div>
      );
    }

    const preparer = await prisma.companyPreparer.findFirst({
      where: { id: v.preparerId, active: true },
      select: {
        id: true,
        portalToken: true,
        authorizedBranches: {
          where: { active: true },
          select: { id: true },
        },
      },
    });

    if (!preparer || preparer.portalToken !== v.token) {
      return <div className="p-20 text-center font-bold" dir="rtl">رابط غير صالح أو تم تجديده من قبل الإدارة.</div>;
    }

    const baseAuth = { p: String(p ?? ""), exp: String(exp ?? ""), s: String(s ?? "") };

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

    const allowedIds = preparer.authorizedBranches.map((b) => b.id);
    if (allowedIds.length === 0) {
      return (
        <div className="kse-app-inner mx-auto max-w-4xl px-4 py-6" dir="rtl">
          <header className="mb-8">
            <h1 className="text-2xl font-black text-slate-900">تسعير المتجر</h1>
            <p className="mt-2 text-slate-600 font-bold">
              لم يتم ربط حسابك بأي فرع للتسعير. اطلب من الإدارة تعيين الفروع المسموحة لك.
            </p>
            <Link
              href={preparerPath("/preparer", baseAuth)}
              className="mt-4 inline-block px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold"
            >
              رجوع للرئيسية
            </Link>
          </header>
        </div>
      );
    }

    const branchesRaw = await prisma.storeBranch.findMany({
      where: {
        active: true,
        id: { in: allowedIds },
      },
      include: { category: true },
      orderBy: { sequence: "asc" },
    });

    const branches = deepSanitize(branchesRaw.map((br) => ({
      id: String(br.id),
      name: String(br.name),
      photoUrl: br.photoUrl || "",
      categoryName: br.category?.name || "عام"
    })));

    return (
      <div className="kse-app-inner mx-auto max-w-4xl px-4 py-6" dir="rtl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">تسعير المتجر</h1>
            <p className="text-sm text-slate-500 font-bold mt-1">اختر القسم لتعديل أسعار المنتجات اليومية</p>
          </div>
          <Link
            href={preparerPath("/preparer", baseAuth)}
            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold"
          >
            رجوع للرئيسية
          </Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {branches.map((br) => (
            <Link
              key={br.id}
              href={preparerPath(`/preparer/store-pricing/${br.id}`, baseAuth)}
              className="group relative overflow-hidden bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-50 transition-all flex items-center gap-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                {br.photoUrl ? <img src={br.photoUrl} className="w-full h-full object-cover rounded-2xl" /> : "🌿"}
              </div>
              <div>
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">{br.categoryName}</p>
                <h2 className="text-xl font-black text-slate-800">{br.name}</h2>
                <p className="text-xs text-slate-400 font-bold">تعديل أسعار {br.name}</p>
              </div>
              <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-emerald-500 transition-colors">
                 <span className="text-2xl">←</span>
              </div>
            </Link>
          ))}

          {branches.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
              <p className="text-slate-400 font-bold">لا توجد أفرع مفوضة لك لتسعيرها حالياً.</p>
            </div>
          )}
        </div>
      </div>
    );
  } catch (err: any) {
    console.error("Preparer Pricing Page Error:", err);
    return (
      <div className="p-20 text-center" dir="rtl">
        <h1 className="text-xl font-bold text-rose-600">عذراً، حدث خطأ تقني</h1>
        <pre className="mt-4 p-4 bg-slate-100 rounded-xl text-left text-xs overflow-auto max-w-full inline-block" dir="ltr">
          {err?.message || String(err)}
        </pre>
        <p className="mt-4 text-slate-500 font-bold">انسخ هذا الخطأ وأرسله للمبرمج للإصلاح فوراً.</p>
      </div>
    );
  }
}
