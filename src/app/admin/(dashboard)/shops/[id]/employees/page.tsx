import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { AddEmployeePanel } from "./add-employee-panel";
import { EmployeesList, type EmployeeRow } from "./employees-list";
import { buildEmployeeOrderPortalUrl } from "@/lib/employee-order-portal-link";
import { buildEmployeeChatGreeting, whatsappAppUrl } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ShopEmployeesPage({ params }: Props) {
  const { id: shopId } = await params;

  // جلب بيانات المحل مع موظفيه
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: {
      employees: {
        orderBy: { name: "asc" },
      },
    },
  });

  if (!shop) {
    notFound();
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aboakbar.vercel.app";

  // تحضير البيانات للـ Client Component مع إضافة روابط واتساب
  const rows: EmployeeRow[] = shop.employees.map((emp) => {
    const orderPortalUrl = buildEmployeeOrderPortalUrl(emp.id, emp.orderPortalToken, baseUrl);
    const greeting = buildEmployeeChatGreeting({ employeeName: emp.name });
    const whatsappLink = whatsappAppUrl(emp.phone, greeting);

    return {
      id: emp.id,
      name: emp.name,
      phone: emp.phone,
      orderPortalUrl,
      whatsappLink,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/admin/shops" className={ad.link}>
          ← المحلات
        </Link>
        <span className="text-slate-400">/</span>
        <span className="font-bold text-slate-800">{shop.name}</span>
      </div>

      <div>
        <h1 className={ad.h1}>موظفي المحل (العملاء الذين يرفعون الطلبات)</h1>
        <p className={`mt-1 ${ad.lead}`}>
          هؤلاء هم موظفوك الذين يملكون صلاحية رفع طلبات التوصيل إلى النظام عبر روابط خاصة.
        </p>
        {shop.locationUrl ? (
          <a
            href={shop.locationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex text-sm font-bold text-emerald-700 underline"
          >
            فتح موقع المحل على الخريطة ↗
          </a>
        ) : null}
      </div>

      <AddEmployeePanel shopId={shop.id} />

      <section className={ad.section}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h2 className={ad.h2}>قائمة العملاء ({rows.length})</h2>
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
          employees={rows}
        />
      </section>
    </div>
  );
}