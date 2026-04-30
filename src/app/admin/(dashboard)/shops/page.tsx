import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { AddShopPanel } from "./add-shop-panel";
import { ShopsList } from "./shops-list";
import { ImportShopsButton } from "./import-shops-button";
import { getGlobalIcons } from "@/lib/icon-settings";

export const dynamic = "force-dynamic";

export default async function ShopsPage() {
  // جلب البيانات مع تأمين ضد الأخطاء
  const [regions, shops, icons] = await Promise.all([
    prisma.region.findMany({ orderBy: { name: "asc" } }).catch(() => []),
    prisma.shop.findMany({
      include: { region: true },
      orderBy: { createdAt: "desc" },
    }).catch(() => []),
    getGlobalIcons(),
  ]);

  const regionOptions = regions.map((r) => ({ id: r.id, name: r.name }));

  const rows = shops.map((s) => ({
    id: s.id,
    name: s.name || "محل بدون اسم",
    locationUrl: s.locationUrl || "",
    regionName: s.region?.name || "غير محدد",
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

      <AddShopPanel regions={regionOptions} icons={icons} />

      <section className={ad.section}>
        <h2 className={`mb-1 ${ad.h2}`}>القائمة ({rows.length})</h2>
        <ShopsList shops={rows} icons={icons} />
      </section>
    </div>
  );
}
