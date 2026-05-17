import { ALF_PER_DINAR } from "@/lib/money-alf";
import type { EmployeeOrderPortalVerifyReason } from "@/lib/employee-order-portal-link";
import { verifyEmployeeOrderPortalQuery } from "@/lib/employee-order-portal-link";
import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { getPublicAppUrl } from "@/lib/app-url";
import { ClientOrderForm } from "./client-order-form";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { getActiveBotByPurpose } from "@/lib/telegram-bots";
import { randomBytes } from "crypto";

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

    // جلب يوزر بوت العملاء من الإعدادات وتنظيفه تماماً
    const customerBot = await getActiveBotByPurpose("customer");
    const rawBotUsername = customerBot?.username || process.env.TELEGRAM_BOT_USERNAME || "";
    const botUsername = rawBotUsername
      .replace(/^https?:\/\/t\.me\//, "")
      .replace(/^@/, "")
      .trim();

    const portalUrl = `${getPublicAppUrl().replace(/\/+$/, "")}/client/order?e=${sp.e}&exp=${sp.exp}&s=${sp.s}`;

    // توليد رمز مختصر لتجاوز حد الـ 64 حرف في تليجرام
    // نستخدم upsert أو نتأكد من عدم وجود تكرار (رغم أن الـ hex8 احتمال تكراره ضئيل جداً)
    const botStartParam = `pl_${randomBytes(8).toString("hex")}`;
    await prisma.schemaPlaceholder.create({
      data: {
        id: botStartParam,
        note: portalUrl,
      },
    });

    // تنظيف بسيط "على الماشي" (اختياري) لمنع تراكم البيانات إذا لم يتم إعداد Cron
    // سنقوم بحذف الروابط التي مضى عليها أكثر من 48 ساعة بشكل عشوائي (1 من كل 20 طلب)
    if (Math.random() < 0.05) {
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      prisma.schemaPlaceholder.deleteMany({
        where: { id: { startsWith: "pl_" }, createdAt: { lt: twoDaysAgo } }
      }).catch(() => {}); // لا نريد تعطيل الطلب الحالي إذا فشل المسح
    }

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
            botStartParam={botStartParam}
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
