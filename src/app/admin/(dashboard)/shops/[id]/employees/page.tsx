import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { getPublicAppUrl } from "@/lib/app-url";
import { buildEmployeeOrderPortalUrl } from "@/lib/employee-order-portal-link";
import { EmployeesList } from "./employees-list";
import { AddEmployeePanel } from "./add-employee-panel";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ShopEmployeesPage({ params }: Props) {
  const { id: shopId } = await params;
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: { region: true },
  });
  if (!shop) {
    notFound();
  }

  const employees = await prisma.employee.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
  });

  const baseUrl = getPublicAppUrl();
  const rows = employees.map((e) => ({
    id: e.id,
    name: e.name,
    phone: e.phone,
    orderPortalUrl: buildEmployeeOrderPortalUrl(e.id, e.orderPortalToken, baseUrl),
  }));

  return (
    <div className="space-y-8">
      <p className={ad.muted}>
        <Link href="/admin/shops" className={ad.link}>
          ← المحلات
        </Link>
      </p>

      <div>
        <h1 className={ad.h1}>موظفو المحل</h1>
        <p className={`mt-1 ${ad.lead}`}>
          <span className="font-semibold text-slate-900">{shop.name}</span>
          <span className="text-emerald-600"> · </span>
          {shop.region.name}
        </p>
      </div>

      <AddEmployeePanel shopId={shopId} />

      <section className={ad.section}>
        <h2 className={ad.h2}>القائمة</h2>
        <div className="mt-3">
          <EmployeesList
            shopId={shopId}
            shopName={shop.name}
            locationUrl={shop.locationUrl}
            employees={rows}
          />
        </div>
      </section>
    </div>
  );
}
