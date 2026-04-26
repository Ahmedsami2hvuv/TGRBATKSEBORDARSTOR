import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SupplierPricingClient } from "./supplier-pricing-client";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ p?: string; t?: string }>;
};

export default async function SupplierPortalPage({ searchParams }: Props) {
  try {
    const sp = await searchParams;
    const p = sp.p;
    const t = sp.t;

    if (!p || !t) return notFound();

    const supplier = await prisma.storeSupplier.findFirst({
      where: { id: p, portalToken: t, active: true },
      select: {
        id: true,
        name: true,
        profitMargin: true,
        portalToken: true,
      }
    });

    if (!supplier) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" dir="rtl">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl text-center max-w-sm w-full border-2 border-rose-50">
            <div className="text-5xl mb-4">🚫</div>
            <h1 className="text-xl font-black text-slate-900">رابط غير صالح</h1>
            <p className="text-sm text-slate-500 font-bold mt-2">عذراً، هذا الرابط منتهي الصلاحية أو غير موجود.</p>
          </div>
        </div>
      );
    }

    const profitMargin = Number(supplier.profitMargin) || 0.25;

    const productsRaw = await prisma.storeProduct.findMany({
      where: {
        active: true,
        supplierId: supplier.id
      },
      select: {
        id: true,
        name: true,
        purchasePrice: true,
        salePrice: true,
        photoUrls: true,
      },
      orderBy: { sequence: "asc" }
    });

    const initialProducts = productsRaw.map(pr => {
      let img = "";
      if (Array.isArray(pr.photoUrls) && pr.photoUrls.length > 0) {
        img = pr.photoUrls[0];
      } else if (typeof pr.photoUrls === "string") {
        img = pr.photoUrls;
      }

      return {
        id: String(pr.id),
        name: String(pr.name),
        purchasePrice: pr.purchasePrice ? Number(pr.purchasePrice) : 0,
        salePrice: pr.salePrice ? Number(pr.salePrice) : 0,
        image: img,
        unit: "وحدة", // قيمة افتراضية
      };
    });

    return (
      <div className="min-h-screen bg-slate-50 pb-20" dir="rtl">
        <header className="bg-white border-b border-slate-100 px-6 py-8 sticky top-0 z-10 shadow-sm">
          <div className="max-w-4xl mx-auto">
             <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center text-white text-3xl font-black">
                  {supplier.name[0] || "S"}
                </div>
                <div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">بوابة المورد الخاصة</p>
                  <h1 className="text-2xl font-black text-slate-900">{supplier.name}</h1>
                </div>
             </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto p-4 mt-6">
          <SupplierPricingClient
            supplierId={supplier.id}
            token={supplier.portalToken}
            initialProducts={initialProducts}
            profitMargin={profitMargin}
          />
        </main>
      </div>
    );
  } catch (err: any) {
    console.error("Supplier Portal Error:", err);
    return (
      <div className="p-20 text-center" dir="rtl">
        <h1 className="text-xl font-bold text-rose-600">حدث خطأ في تحميل البيانات</h1>
        <pre className="mt-4 p-4 bg-slate-100 rounded-xl text-left text-xs overflow-auto max-w-full inline-block" dir="ltr">
          {err?.message || String(err)}
        </pre>
        <p className="mt-4 text-slate-500 font-bold">انسخ هذا الخطأ وأرسله للمبرمج للإصلاح فوراً.</p>
      </div>
    );
  }
}
