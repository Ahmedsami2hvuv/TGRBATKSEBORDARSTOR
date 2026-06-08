import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { AddShopPanel } from "./add-shop-panel";
import { ShopsList } from "./shops-list";
import { ImportShopsButton } from "./import-shops-button";
import { getGlobalIcons } from "@/lib/icon-settings";
import { serializePrisma } from "@/lib/serialize-prisma";

import { GlobalPauseButton } from "./global-pause-button";

export const dynamic = "force-dynamic";

export default async function ShopsPage() {
  // جلب البيانات مع تأمين ضد الأخطاء
  const [regionsRaw, shopsRaw, iconsRaw, globalSettingsRaw] = await Promise.all([
    prisma.region.findMany({ orderBy: { name: "asc" } }).catch(() => []),
    prisma.shop.findMany({
      include: {
        region: true,
        _count: {
          select: {
            employees: true,
            orders: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }).catch(() => []),
    getGlobalIcons(),
    prisma.globalSettings.findUnique({ where: { id: "system" } }).catch(() => null),
  ]);

  const regions = serializePrisma(regionsRaw);
  const shops = serializePrisma(shopsRaw);
  const icons = serializePrisma(iconsRaw);
  const globalSettings = serializePrisma(globalSettingsRaw);

  const regionOptions = regions.map((r: any) => ({ id: r.id, name: r.name }));

  const rows = shops.map((s: any) => ({
    id: s.id,
    name: s.name || "محل بدون اسم",
    locationUrl: s.locationUrl || "",
    regionName: s.region?.name || "غير محدد",
    ordersPaused: !!s.ordersPaused,
    pauseMessage: s.pauseMessage || "",
    employeesCount: s._count?.employees ?? 0,
    ordersCount: s._count?.orders ?? 0,
    hideDebts: !!s.hideDebts,
    createdAt: s.createdAt,
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className={ad.h1}>المحلات</h1>
          <p className={`mt-1 ${ad.lead}`}>
            إدارة المحلات وربطها بالمناطق.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <GlobalPauseButton
            isPaused={!!globalSettings?.allOrdersPaused}
            pauseMessage={globalSettings?.pauseMessage || ""}
            icons={icons}
          />
          <ImportShopsButton />
        </div>
      </div>

      <AddShopPanel regions={regionOptions} icons={icons} />

      <section className={ad.section}>
        <h2 className={`mb-1 ${ad.h2}`}>القائمة ({rows.length})</h2>
        <ShopsList shops={rows} icons={icons} />
      </section>
    </div>
  );
}
