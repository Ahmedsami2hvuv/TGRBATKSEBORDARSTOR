import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { AddShopPanel } from "./add-shop-panel";
import { ShopsList } from "./shops-list";
import { ImportShopsButton } from "./import-shops-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "المحلات — KSEBORDARSTOR",
};

export default async function ShopsPage() {
  const [regions, shops] = await Promise.all([
    prisma.region.findMany({ orderBy: { name: "asc" } }),
    prisma.shop.findMany({
      include: { region: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const regionOptions = regions.map((r) => ({ id: r.id, name: r.name }));
  const rows = shops.map((s) => ({
    id: s.id,
    name: s.name,
    locationUrl: s.locationUrl,
    regionName: s.region?.name || "بدون منطقة",
  }));

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className={ad.h1}>المحلات</h1>
          <p className={`mt-1 ${ad.lead}`}>
            إدارة المحلات وربطها بالمناطق.
          </p>
        </div>
        <ImportShopsButton />
      </div>

      <AddShopPanel regions={regionOptions} />

      <section className={ad.section}>
        <h2 className={`mb-1 ${ad.h2}`}>القائمة</h2>
        <ShopsList shops={rows} />
      </section>
    </div>
  );
}
