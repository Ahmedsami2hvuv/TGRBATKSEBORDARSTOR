import Link from "next/link";
import { ad } from "@/lib/admin-ui";
import { getPublicAppUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { SuppliersManager, type SupplierManagerRow } from "./suppliers-manager";
import { getGlobalIcons } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "الموردين — أبو الأكبر للتوصيل",
};

export default async function SuppliersPage() {
  const [suppliersRes, productsRes, icons] = await Promise.all([
    prisma.storeSupplier.findMany({
      include: { products: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.storeProduct.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true }
    }),
    getGlobalIcons()
  ]);

  const suppliers = suppliersRes || [];
  const products = productsRes || [];

  const baseUrl = getPublicAppUrl();
  const rows: SupplierManagerRow[] = suppliers.map((s) => {
    return {
      id: s.id,
      name: s.name,
      phone: s.phone,
      profitMargin: Number(s.profitMargin),
      active: s.active,
      chatDisabled: s.chatDisabled,
      portalUrl: `${baseUrl}/supplier?p=${s.id}&t=${s.portalToken}`,
      productIds: s.products.map((p: any) => p.id),
    };
  });

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap gap-2 mb-4">
        <Link href="/abo1stor3hlaa2kbr8-47" className={`${ad.navButton} flex items-center gap-1`}>
          <DynamicIcon iconKey="ui_arrow_right" config={icons} fallback="←" className="w-3 h-3" />
          الرئيسية
        </Link>
        <Link href="/abo1stor3hlaa2kbr8-47/store/products" className={`${ad.navButton} flex items-center gap-1`}>
           المنتجات
        </Link>
      </div>

      <div>
        <h1 className={ad.h1}>الموردين</h1>
        <p className={`mt-2 max-w-3xl ${ad.lead}`}>
          إدارة الموردين (أصحاب الخضروات، الأسماك، إلخ) وتخصيص هوامش ربح وروابط تسعير خاصة بهم.
        </p>
      </div>

      <SuppliersManager rows={rows} allProducts={products} icons={icons} />
    </div>
  );
}
