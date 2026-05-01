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
        <span className="text-slate-300">/</span>
        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{shop.name}</span>
      </div>

      <div className="relative overflow-hidden bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="relative z-10">
          <h1 className={`${ad.h1} flex items-center gap-3`}>
            موظفي المحل
            <span className="text-xs font-normal text-slate-400 bg-slate-50 px-2 py-1 rounded-full">العملاء</span>
          </h1>
          <p className={`mt-2 ${ad.lead} max-w-2xl`}>
            هؤلاء هم موظفوك الذين يملكون صلاحية رفع طلبات التوصيل إلى النظام عبر روابط خاصة ومحمية.
          </p>
          {shop.locationUrl?.trim().length > 5 ? (
            <a
              href={shop.locationUrl.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl hover:bg-emerald-100 transition-all border border-emerald-100/50"
            >
              <DynamicIcon iconKey="ui_map" config={icons} fallback="" className="w-5 h-5" />
              فتح موقع المحل على الخريطة
              <DynamicIcon iconKey="ui_external_link" config={icons} fallback="↗" className="w-3.5 h-3.5 opacity-50" />
            </a>
          ) : null}
        </div>

        {/* Decorative Background Icon - تظهر كعلامة مائية احترافية في الزاوية */}
        <div className="absolute -left-12 -top-12 opacity-[0.08] pointer-events-none rotate-12 transition-all duration-700">
           <DynamicIcon iconKey="ui_user" config={icons} width={220} height={220} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-6">
           <div className="bg-sky-50/50 p-6 rounded-3xl border border-sky-100/50 shadow-inner">
              <h3 className="font-black text-sky-900 mb-4 flex items-center gap-3">
                 <div className="bg-white p-2 rounded-xl shadow-sm border border-sky-100">
                    <DynamicIcon iconKey="ui_plus" config={icons} className="w-6 h-6 shrink-0" />
                 </div>
                 إضافة موظف جديد
              </h3>
              <AddEmployeePanel shopId={shop.id} />
           </div>
        </div>

        <div className="lg:col-span-8">
          <section className={`${ad.section} !mt-0 shadow-xl shadow-slate-200/50 border-slate-200/60`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5 mb-6">
              <div className="space-y-1">
                <h2 className={ad.h2}>قائمة العملاء الحالية</h2>
                <p className="text-xs text-slate-400 font-medium">إجمالي المسجلين: {employeesWithLinks.length} موظف</p>
              </div>
              <Link
                href={`/admin/shops/${shop.id}/edit`}
                className="text-sm font-bold text-sky-700 bg-sky-50 px-4 py-2 rounded-xl hover:bg-sky-100 transition-all"
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
      </div>
    </div>
  );
}
