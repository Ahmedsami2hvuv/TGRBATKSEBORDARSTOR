import Link from "next/link";
import { ad } from "@/lib/admin-ui";
import { prisma } from "@/lib/prisma";
import { AdminCreateOrderForm } from "./admin-create-order-form";
import { buildEmployeeOrderPortalUrl } from "@/lib/employee-order-portal-link";
import { headers } from "next/headers";
import { getGlobalIcons } from "@/lib/icon-settings";
import { courierAssignableWhere } from "@/lib/courier-assignable";
import { serializePrisma } from "@/lib/serialize-prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "إضافة طلب من الإدارة — أبو الأكبر للتوصيل",
};

export default async function AdminCreateOrderPage() {
  try {
    const headerList = await headers();
    const host = headerList.get("host") || "";
    const protocol = host.includes("localhost") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;

    // جلب المحلات، المناطق، الزبائن (للملء التلقائي)، والموظفين (كأزرار سريعة)، والمجهزين (لطلبات التجهيز)
    const [shopsRaw, regionsRaw, employeesRaw, preparersRaw, couriersRaw, iconsRaw] = await Promise.all([
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

    // تأمين البيانات للنقل إلى Client Components
    const shops = serializePrisma(shopsRaw);
    const regions = serializePrisma(regionsRaw);
    const preparers = serializePrisma(preparersRaw);
    const couriers = serializePrisma(couriersRaw);
    const icons = serializePrisma(iconsRaw);

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
          employees={serializePrisma(employees)}
          preparers={preparers}
          couriers={couriers}
          icons={icons}
        />
      </div>
    );
  } catch (err: any) {
    return (
      <div className="p-8 space-y-4 bg-red-50 text-red-900 min-h-screen" dir="ltr">
        <h1 className="text-2xl font-bold">Runtime Error in AdminCreateOrderPage</h1>
        <p>عطل في جلب بيانات صفحة إضافة الطلب:</p>
        <pre className="bg-slate-900 text-red-400 p-4 rounded overflow-auto whitespace-pre-wrap text-sm">
          {err.stack || err.message || String(err)}
        </pre>
        <button
          onClick={() => window.location.reload()}
          className="bg-red-600 text-white px-4 py-2 rounded shadow"
        >
          إعادة تحميل الصفحة
        </button>
      </div>
    );
  }
}
