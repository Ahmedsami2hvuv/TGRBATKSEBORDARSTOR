import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { RegionForm } from "./region-form";
import { RegionsList } from "./regions-list";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "المناطق — KSEBORDARSTOR",
};

export default async function RegionsPage() {
  const regions = await prisma.region.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { ordersCustomer: true } } },
  });

  const rows = regions.map((r) => ({
    id: r.id,
    name: r.name,
    deliveryPrice: formatDinarAsAlfWithUnit(r.deliveryPrice),
    orderCount: r._count.ordersCustomer,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className={ad.h1}>المناطق</h1>
        <p className={`mt-1 ${ad.lead}`}>
          أضف اسم كل منطقة وسعر التوصيل. استخدم البحث لتصفية القائمة.
        </p>
      </div>

      <RegionForm />

      <section className={ad.section}>
        <h2 className={`mb-1 ${ad.h2}`}>القائمة</h2>
        <RegionsList regions={rows} />
      </section>
    </div>
  );
}
