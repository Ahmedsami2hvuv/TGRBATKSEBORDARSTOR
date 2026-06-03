import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { EmployeesList, type EmployeeRow } from "./employees-list";
import { getGlobalIcons } from "@/lib/icon-settings";
import { buildEmployeeOrderPortalUrl } from "@/lib/employee-order-portal-link";
import { whatsappAppUrl } from "@/lib/whatsapp";
import { getPublicAppUrl } from "@/lib/app-url";
import {
  getEmployeeWhatsappShareTemplate,
  renderEmployeeWhatsappShareTemplate,
} from "@/lib/whatsapp-template-settings";
import { serializePrisma } from "@/lib/serialize-prisma";

export const dynamic = "force-dynamic";


export default async function ShopEmployeesPage(props: { params: Promise<{ id: string }> }) {
  try {
    const { id: shopId } = await props.params;
    const baseUrl = getPublicAppUrl();

    // جلب بيانات المحل والموظفين في استعلام واحد لتقليل الضغط على الـ Pool
    const shopRaw = await prisma.shop.findUnique({
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
        }
      },
    });

    if (!shopRaw) {
      notFound();
    }

    // جلب الإعدادات الأخرى بتتابع وليس توازي لضمان عدم استهلاك أكثر من اتصال
    const iconsRaw = await getGlobalIcons();
    const employeeShareTemplate = await getEmployeeWhatsappShareTemplate();
    const allShopsRaw = await prisma.shop.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    const employeesRaw = shopRaw.employees;

    // تطهير البيانات قبل أي معالجة أخرى - استخدام الدالة المركزية لضمان التوافق مع Next.js 15
    const shop = serializePrisma(shopRaw);
    const employees = serializePrisma(employeesRaw);
    const icons = serializePrisma(iconsRaw);
    const allShops = serializePrisma(allShopsRaw);

    const employeesWithLinks: EmployeeRow[] = (employees || []).map((emp: any) => {
      const orderPortalUrl = buildEmployeeOrderPortalUrl(emp.id, emp.orderPortalToken, baseUrl);

      let whatsappLink = "";
      if (emp.phone && emp.phone.length > 5) {
        const message = renderEmployeeWhatsappShareTemplate({
          template: employeeShareTemplate,
          customerName: emp.name || "", // Fallback for old templates
          shopName: shop.name || "",
          customerLink: orderPortalUrl,
          shopLocation: shop.locationUrl || "",
        });
        whatsappLink = whatsappAppUrl(emp.phone, message);
      }

      return {
        id: emp.id,
        name: emp.name || "",
        phone: emp.phone || "",
        orderPortalUrl,
        whatsappLink
      };
    });

    return (
      <div className="space-y-4">
        <EmployeesList
          shopId={shop.id}
          shopName={shop.name}
          locationUrl={shop.locationUrl || ""}
          employees={employeesWithLinks}
          icons={icons}
          allShops={allShops}
        />
      </div>
    );
  } catch (err: any) {
    return (
      <div className="p-8 space-y-4 bg-red-50 text-red-900 min-h-screen" dir="ltr">
        <h1 className="text-2xl font-bold">Runtime Error in ShopEmployeesPage</h1>
        <p>عطل في جلب بيانات موظفي المحل:</p>
        <pre className="bg-slate-900 text-red-400 p-4 rounded overflow-auto whitespace-pre-wrap text-sm">
          {err.stack || err.message || String(err)}
        </pre>
        <a
          href=""
          className="inline-block bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700 transition-colors"
        >
          إعادة تحميل الصفحة
        </a>
      </div>
    );
  }
}
