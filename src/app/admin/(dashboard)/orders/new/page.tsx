import Link from "next/link";
import { ad } from "@/lib/admin-ui";
import { prisma } from "@/lib/prisma";
import { AdminCreateOrderForm } from "./admin-create-order-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "إضافة طلب من الإدارة — أبو الأكبر للتوصيل",
};

export default async function AdminCreateOrderPage() {
  // جلب المحلات، المناطق، الزبائن (للملء التلقائي)، والموظفين (كأزرار سريعة)، والمجهزين (لطلبات التجهيز)
  const [shops, regions, employees, preparers] = await Promise.all([
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
      },
      orderBy: { name: "asc" },
    }),
    prisma.companyPreparer.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, availableForAssignment: true },
    }),
  ]);

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
      />
    </div>
  );
}
