import Link from "next/link";
import { ad } from "@/lib/admin-ui";
import { getPublicAppUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { SuppliersManager, type SupplierManagerRow } from "./suppliers-manager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "الموردين — أبو الأكبر للتوصيل",
};

export default async function SuppliersPage() {
  let suppliers: any[] = [];
  let products: any[] = [];

  try {
    [suppliers, products] = await Promise.all([
      prisma.storeSupplier.findMany({
        include: { products: { select: { id: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.storeProduct.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, description: true }
      })
    ]);
  } catch (e) {
    console.error("Database query failed:", e);
  }

  const baseUrl = getPublicAppUrl();
  const rows: SupplierManagerRow[] = suppliers.map((s) => {
    return {
      id: s.id,
      name: s.name,
      phone: s.phone,
      profitMargin: Number(s.profitMargin),
      active: s.active,
      portalUrl: `${baseUrl}/supplier?p=${s.id}&t=${s.portalToken}`,
      productIds: s.products.map((p: any) => p.id),
    };
  });

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap gap-2 mb-4">
        <Link href="/admin" className={ad.navButton}>
          ← الرئيسية
        </Link>
        <Link href="/admin/store/products" className={ad.navButton}>
           المنتجات
        </Link>
      </div>

      <div>
        <h1 className={ad.h1}>الموردين</h1>
        <p className={`mt-2 max-w-3xl ${ad.lead}`}>
          إدارة الموردين (أصحاب الخضروات، الأسماك، إلخ) وتخصيص هوامش ربح وروابط تسعير خاصة بهم.
        </p>
      </div>

      <SuppliersManager rows={rows} allProducts={products} />
    </div>
  );
}
