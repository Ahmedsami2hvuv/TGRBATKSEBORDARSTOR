import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { getPublicAppUrl } from "@/lib/app-url";
import { buildEmployeeOrderPortalUrl } from "@/lib/employee-order-portal-link";
import { buildShopStaffOrderShareMessage, getWhatsappShareLink } from "@/lib/whatsapp";
import { EmployeesList } from "./employees-list";
import { AddEmployeePanel } from "./add-employee-panel";

export const dynamic = "force-dynamic";

export default async function ShopEmployeesPage(props: any) {
  // 1. معالجة الـ Params
  const params = await props.params;
  const shopId = String(params?.id || "");

  if (!shopId) return notFound();

  // 2. جلب البيانات الأساسية من قاعدة البيانات
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

  // 3. تجهيز "البيانات النهائية" في الخادم
  // هذا الجزء يقوم بكل العمليات الحسابية هنا بدلاً من المتصفح
  const rows = (employees || []).map((e) => {
    let portalUrl = "";
    let whatsappLink = "#";

    try {
      portalUrl = buildEmployeeOrderPortalUrl(e.id, e.orderPortalToken, baseUrl);

      const messageText = buildShopStaffOrderShareMessage({
        shopName: shop.name,
        locationUrl: shop.locationUrl || "",
        employeeName: e.name,
        orderPortalUrl: portalUrl,
      });

      whatsappLink = getWhatsappShareLink(e.phone, messageText);
    } catch (err) {
      console.error("Link Generation Error:", err);
    }

    return {
      id: String(e.id),
      name: String(e.name || ""),
      phone: String(e.phone || ""),
      orderPortalUrl: String(portalUrl),
      whatsappLink: String(whatsappLink),
    };
  });

  return (
    <div className="space-y-8 px-2 py-4">
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between">
        <Link href="/admin/shops" className={ad.link}>
          ← العودة للمحلات
        </Link>
        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 uppercase">
          Safe Mode Active
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-8 text-white">
        <div className="relative z-10">
          <h1 className="text-3xl font-black">إدارة أصحاب الروابط</h1>
          <div className="mt-2 flex items-center gap-2 text-slate-400">
            <span className="font-bold text-white">{shop.name}</span>
            <span>·</span>
            <span>{shop.region?.name || "بدون منطقة"}</span>
          </div>
        </div>
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky-500/20 blur-3xl"></div>
      </div>

      {/* لوحة الإضافة */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <AddEmployeePanel shopId={shopId} />
      </div>

      {/* قائمة الموظفين - تصلها البيانات جاهزة كلياً */}
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between border-b pb-4">
          <h2 className="text-xl font-black text-slate-800">قائمة الحسابات</h2>
          <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-500">
            {rows.length} موظف
          </span>
        </div>

        <EmployeesList
          shopId={shopId}
          shopName={shop.name}
          locationUrl={shop.locationUrl || ""}
          employees={JSON.parse(JSON.stringify(rows))}
        />
      </section>
    </div>
  );
}
