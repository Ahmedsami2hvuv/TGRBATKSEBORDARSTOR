import { ALF_PER_DINAR } from "@/lib/money-alf";
import type { EmployeeOrderPortalVerifyReason } from "@/lib/employee-order-portal-link";
import { verifyEmployeeOrderPortalQuery } from "@/lib/employee-order-portal-link";
import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { getPublicAppUrl } from "@/lib/app-url";
import { ClientOrderForm } from "./client-order-form";
import { ThemeSwitcher } from "@/components/theme-switcher";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "إدخال طلب — أبو الأكبر للتوصيل",
};

function invalidMessage(reason: EmployeeOrderPortalVerifyReason): string {
  switch (reason) {
    case "expired":
      return "انتهت صلاحية الرابط. اطلب رابطاً جديداً من موظف المحل.";
    case "bad_signature":
    case "missing":
      return "الرابط غير صالح. تأكد من نسخه كاملاً.";
    case "no_secret":
      return "إعداد الخادم غير مكتمل.";
    default:
      return "الرابط غير صالح.";
  }
}

type Props = {
  searchParams: Promise<{ e?: string; exp?: string; s?: string; edit?: string; phone?: string }>;
};

export default async function ClientOrderPage(props: Props) {
  const sp = await props.searchParams;

  // التحقق الأولي سريع جداً قبل جلب بيانات قاعدة البيانات
  const v = verifyEmployeeOrderPortalQuery(sp.e, sp.exp, sp.s);

  if (!v.ok) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center shadow-sm">
            <p className="text-lg font-bold text-rose-700">تعذّر فتح صفحة إدخال الطلب</p>
            <p className="mt-2 text-sm text-slate-600">{invalidMessage(v.reason)}</p>
          </div>
        </div>
      </div>
    );
  }

  try {
    // جلب البيانات الأساسية فقط وبسرعة
    const employee = await prisma.employee.findUnique({
      where: { id: v.employeeId },
      select: {
        id: true,
        name: true,
        orderPortalToken: true,
        shop: {
          select: {
            id: true,
            name: true,
            photoUrl: true,
            region: {
              select: {
                name: true,
                deliveryPrice: true
              }
            }
          }
        }
      }
    });

    if (!employee) {
      return (
        <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
          <div className="kse-app-inner mx-auto max-w-md text-center">
             <p className="text-lg font-bold">الموظف غير موجود</p>
          </div>
        </div>
      );
    }

    if (employee.orderPortalToken !== v.token) {
      return (
        <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
          <div className="kse-app-inner mx-auto max-w-md text-center">
            <p className="text-lg font-bold text-rose-700">الرابط غير صالح (توكن قديم)</p>
          </div>
        </div>
      );
    }

    const shop = employee.shop;
    const shopDeliveryAlf = shop?.region
      ? Number(shop.region.deliveryPrice.toString()) / ALF_PER_DINAR
      : 0;

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "";
    const portalUrl = `${getPublicAppUrl().replace(/\/+$/, "")}/client/order?e=${sp.e}&exp=${sp.exp}&s=${sp.s}`;

    return (
      <div className="kse-app-bg relative min-h-screen px-4 py-8 pb-16 text-slate-800">
        <div className="absolute top-4 left-4 z-50">
          <ThemeSwitcher />
        </div>
        <div className="kse-app-inner">
          <ClientOrderForm
            shopName={shop.name}
            employeeName={employee.name}
            photoUrl={shop.photoUrl}
            shopRegionName={shop.region?.name || "غير محددة"}
            shopDeliveryAlf={shopDeliveryAlf}
            e={sp.e!}
            exp={sp.exp!}
            sig={sp.s!}
            viewerName=""
            initialOrder={null}
            botUsername={botUsername}
            portalUrl={portalUrl}
          />
        </div>
      </div>
    );
  } catch (error: any) {
    return (
      <div className="p-8 direction-rtl text-center">
        <h1 className="text-xl font-bold text-red-600">خطأ في فتح الصفحة</h1>
        <p className="mt-4 text-slate-600">نعتذر، حدث خطأ تقني غير متوقع.</p>
        <pre className="mt-4 p-4 bg-slate-100 rounded text-xs overflow-auto">{error?.message}</pre>
      </div>
    );
  }
}
