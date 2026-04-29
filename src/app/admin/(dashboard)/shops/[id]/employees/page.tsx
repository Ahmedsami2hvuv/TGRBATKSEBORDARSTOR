import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { getPublicAppUrl } from "@/lib/app-url";
import { buildEmployeeOrderPortalUrl } from "@/lib/employee-order-portal-link";
import { EmployeesList } from "./employees-list";
import { AddEmployeePanel } from "./add-employee-panel";

export const dynamic = "force-dynamic";

export default async function ShopEmployeesPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const shopId = params?.id;

  if (!shopId) return notFound();

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: { region: true },
  });

  if (!shop) return notFound();

  const employees = await prisma.employee.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
  });

  const baseUrl = getPublicAppUrl();

  const rows = employees.map((e) => {
    let orderPortalUrl = "";
    try {
      // حماية: إذا فشل توليد الرابط بسبب "مفتاح السر" لا تنهار الصفحة
      orderPortalUrl = buildEmployeeOrderPortalUrl(e.id, e.orderPortalToken, baseUrl);
    } catch (err) {
      console.error("Portal URL Error:", err);
    }

    return {
      id: e.id,
      name: e.name,
      phone: e.phone,
      orderPortalUrl,
    };
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <p className={ad.muted}>
          <Link href="/admin/shops" className={ad.link}>
            ← العودة للمحلات
          </Link>
        </p>
        {!rows.some(r => r.orderPortalUrl) && (
          <div className="bg-amber-100 text-amber-800 text-[10px] px-2 py-1 rounded border border-amber-200 animate-pulse">
            ⚠️ تنبيه: روابط الواتساب قد لا تعمل (تواصل مع المطور لضبط مفتاح السر)
          </div>
        )}
      </div>

      <div>
        <h1 className={ad.h1}>موظفو المحل (أصحاب الروابط)</h1>
        <p className={`mt-1 ${ad.lead}`}>
          المحل: <span className="font-semibold text-slate-900">{shop.name}</span>
          <span className="text-emerald-600 mx-2"> · </span>
          المنطقة: {shop.region?.name || "غير محددة"}
        </p>
      </div>

      <AddEmployeePanel shopId={shopId} />

      <section className={ad.section}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={ad.h2}>القائمة الحالية</h2>
          <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded-full text-slate-600">
            {rows.length} موظف
          </span>
        </div>

        <div className="mt-3">
          <EmployeesList
            shopId={shopId}
            shopName={shop.name}
            locationUrl={shop.locationUrl || ""}
            employees={rows}
          />
        </div>
      </section>
    </div>
  );
}
