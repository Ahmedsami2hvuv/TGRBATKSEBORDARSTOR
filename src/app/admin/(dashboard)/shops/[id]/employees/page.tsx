import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { getPublicAppUrl } from "@/lib/app-url";
import { buildEmployeeOrderPortalUrl } from "@/lib/employee-order-portal-link";
import { buildShopStaffOrderShareMessage } from "@/lib/whatsapp";
import { EmployeesList } from "./employees-list";
import { AddEmployeePanel } from "./add-employee-panel";

export const dynamic = "force-dynamic";

export default async function ShopEmployeesPage(props: any) {
  // 1. انتظار المعايير (Params)
  const params = await props.params;
  const shopId = String(params?.id || "");

  if (!shopId) return notFound();

  // 2. جلب البيانات
  const shopData = await prisma.shop.findUnique({
    where: { id: shopId },
    include: { region: true },
  });

  if (!shopData) return notFound();

  const employeesData = await prisma.employee.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
  });

  const baseUrl = getPublicAppUrl();

  // 3. تجهيز البيانات "خارجياً" لتجنب أخطاء Serialization
  const rows = (employeesData || []).map((e) => {
    let portalUrl = "";
    try {
      portalUrl = buildEmployeeOrderPortalUrl(e.id, e.orderPortalToken, baseUrl);
    } catch (err) {}

    // نجهز نص الرسالة هنا في الخادم ليكون جاهزاً
    const shareText = buildShopStaffOrderShareMessage({
      shopName: shopData.name,
      locationUrl: shopData.locationUrl || "",
      employeeName: e.name,
      orderPortalUrl: portalUrl,
    });

    return {
      id: String(e.id),
      name: String(e.name || ""),
      phone: String(e.phone || ""),
      orderPortalUrl: String(portalUrl),
      shareText: String(shareText), // نمرر النص جاهزاً
    };
  });

  return (
    <div className="space-y-8 p-2 sm:p-4">
      <div className="flex items-center justify-between">
        <Link href="/admin/shops" className={ad.link}>
          ← العودة للمحلات
        </Link>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <h1 className="text-2xl font-black text-slate-800">موظفو المحل (أصحاب الروابط)</h1>
        <p className="mt-1 text-slate-500">
          المحل: <span className="font-bold text-sky-700">{shopData.name}</span> |
          المنطقة: {shopData.region?.name || "غير محددة"}
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-sky-50 overflow-hidden">
        <AddEmployeePanel shopId={shopId} />
      </div>

      <section className={ad.section}>
        <div className="flex items-center justify-between mb-6">
          <h2 className={ad.h2}>إدارة الحسابات والروابط</h2>
          <span className="bg-sky-100 text-sky-700 text-xs font-bold px-3 py-1 rounded-full">
            {rows.length} حساب
          </span>
        </div>

        <div className="mt-3">
          <EmployeesList
            shopId={shopId}
            shopName={shopData.name}
            locationUrl={shopData.locationUrl || ""}
            employees={JSON.parse(JSON.stringify(rows))}
          />
        </div>
      </section>
    </div>
  );
}
