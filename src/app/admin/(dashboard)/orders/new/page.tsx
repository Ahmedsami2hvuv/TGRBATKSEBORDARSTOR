import Link from "next/link";
import { ad } from "@/lib/admin-ui";
import { prisma } from "@/lib/prisma";
import { AdminCreateOrderForm } from "./admin-create-order-form";
import { buildEmployeeOrderPortalUrl } from "@/lib/employee-order-portal-link";
import { headers } from "next/headers";
import { getGlobalIcons } from "@/lib/icon-settings";
import { courierAssignableWhere } from "@/lib/courier-assignable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "إضافة طلب من الإدارة — أبو الأكبر للتوصيل",
};

export default async function AdminCreateOrderPage() {
  const headerList = await headers();
  const host = headerList.get("host") || "";
  const protocol = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  // جلب المحلات، المناطق، الزبائن (للملء التلقائي)، والموظفين (كأزرار سريعة)، والمجهزين (لطلبات التجهيز)
  const [shops, regions, employeesRaw, preparers, couriers, icons] = await Promise.all([
    prisma.shop.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, regionId: true, locationUrl: true },
    }),
    prisma.region.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.employee.findMany({
      select: {
        id: true,
        shopId: true,
        name: true,
        phone: true,
        orderPortalToken: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.companyPreparer.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, availableForAssignment: true },
    }),
    prisma.courier.findMany({
      where: courierAssignableWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getGlobalIcons(),
  ]);

  const employees = employeesRaw.map((e) => ({
    id: e.id,
    shopId: e.shopId,
    name: e.name,
    phone: e.phone,
    portalUrl: buildEmployeeOrderPortalUrl(e.id, e.orderPortalToken, baseUrl),
  }));

  return (
    <div className="space-y-4">
      <p className={ad.muted}>
        <Link href="/admin/orders/pending" className={ad.link}>
          ← الرجوع إلى الطلبات الجديدة
        </Link>
      </p>
      <header className="space-y-1">
        <h1 className={ad.h1}>إضافة طلب من الإدارة</h1>
        <p className={ad.lead}>
          خيارات متعددة: <strong>رفع من محل</strong>، <strong>وجهة واحدة</strong>، <strong>وجهتان</strong>، أو <strong>طلب تجهيز (تحليل رسالة)</strong>.
        </p>
      </header>
      <AdminCreateOrderForm
        shops={shops}
        regions={regions}
        employees={employees}
        preparers={preparers}
        couriers={couriers}
        icons={icons}
      />
    </div>
  );
}
