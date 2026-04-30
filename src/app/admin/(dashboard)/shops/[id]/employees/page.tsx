import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { AddEmployeePanel } from "./add-employee-panel";
import { EmployeesList, type EmployeeRow } from "./employees-list";
import { getGlobalIcons } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";
import { buildEmployeeOrderPortalUrl } from "@/lib/employee-order-portal-link";
import { buildEmployeeChatGreeting, whatsappAppUrl } from "@/lib/whatsapp";
import { getPublicAppUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

export default async function ShopEmployeesPage(props: { params: Promise<{ id: string }> }) {
  const { id: shopId } = await props.params;
  const baseUrl = getPublicAppUrl();

  const [shop, icons] = await Promise.all([
    prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        name: true,
        locationUrl: true,
        employees: {
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            phone: true,
            orderPortalToken: true,
          },
        },
      },
    }),
    getGlobalIcons()
  ]);

  if (!shop) {
    notFound();
  }

  // توليد الروابط على السيرفر لضمان صحة التوقيع الرقمي
  const employeesWithLinks: EmployeeRow[] = shop.employees.map((emp) => {
    const orderPortalUrl = buildEmployeeOrderPortalUrl(emp.id, emp.orderPortalToken, baseUrl);
    const greeting = buildEmployeeChatGreeting({ employeeName: emp.name });
    const whatsappLink = whatsappAppUrl(emp.phone, greeting);

    return {
      id: emp.id,
      name: emp.name,
      phone: emp.phone,
      orderPortalUrl,
      whatsappLink
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/admin/shops" className={`${ad.link} flex items-center gap-1`}>
          <DynamicIcon iconKey="ui_shops" config={icons} fallback="←" className="w-4 h-4" />
          المحلات
        </Link>
        <span className="text-slate-400">/</span>
        <span className="font-bold text-slate-800">{shop.name}</span>
      </div>

      <div>
        <h1 className={ad.h1}>موظفي المحل (العملاء الذين يرفعون الطلبات)</h1>
        <p className={`mt-1 ${ad.lead}`}>
          هؤلاء هم موظفوك الذين يملكون صلاحية رفع طلبات التوصيل إلى النظام عبر روابط خاصة.
        </p>
        {shop.locationUrl?.trim().length > 5 ? (
          <a
            href={shop.locationUrl.trim()}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-emerald-700 underline"
          >
            <DynamicIcon iconKey="ui_map" config={icons} fallback="" className="w-4 h-4" />
            فتح موقع المحل على الخريطة
            <DynamicIcon iconKey="ui_external_link" config={icons} fallback="↗" className="w-3.5 h-3.5" />
          </a>
        ) : null}
      </div>

      <AddEmployeePanel shopId={shop.id} />

      <section className={ad.section}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h2 className={ad.h2}>قائمة العملاء ({employeesWithLinks.length})</h2>
          <Link
            href={`/admin/shops/${shop.id}/edit`}
            className="text-sm font-medium text-sky-700 underline hover:text-sky-900"
          >
            تعديل بيانات المحل
          </Link>
        </div>
        <EmployeesList
          shopId={shop.id}
          shopName={shop.name}
          locationUrl={shop.locationUrl}
          employees={employeesWithLinks}
          icons={icons}
        />
      </section>
    </div>
  );
}
