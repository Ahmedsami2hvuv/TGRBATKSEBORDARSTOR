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
import Link from "next/link";

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

function PausedOverlay({
  title,
  message,
  color = "rose",
  icon = "🛑",
  params
}: {
  title: string;
  message: string;
  color?: "rose" | "orange";
  icon?: string;
  params: { e?: string; exp?: string; s?: string }
}) {
  const colorClasses = {
    rose: {
      border: "border-rose-300",
      text: "text-rose-700",
      bg: "bg-rose-50",
      btn: "bg-rose-500 hover:bg-rose-600 shadow-rose-200"
    },
    orange: {
      border: "border-orange-300",
      text: "text-orange-700",
      bg: "bg-orange-50",
      btn: "bg-orange-500 hover:bg-orange-600 shadow-orange-200"
    }
  }[color];

  return (
    <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800" dir="rtl">
      <div className="kse-app-inner mx-auto max-w-md">
        <div className={`kse-glass-dark rounded-3xl border-2 ${colorClasses.border} p-8 text-center shadow-2xl bg-white/80 backdrop-blur-md`}>
          <div className="mb-4 text-5xl">{icon}</div>
          <h2 className={`text-2xl font-black ${colorClasses.text} mb-4`}>{title}</h2>
          <div className={`${colorClasses.bg} rounded-2xl p-6 mb-8 border border-slate-100`}>
            <p className="text-xl font-bold text-slate-800 leading-relaxed">{message}</p>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-medium text-slate-500">
              هل ترغب في رفع طلبية ليتم توصيلها بعد انتهاء فترة التوقف؟
            </p>
            <Link
              href={`/client/order?e=${params.e}&exp=${params.exp}&s=${params.s}&force=true`}
              className={`block w-full py-4 ${colorClasses.btn} text-white rounded-2xl font-black text-lg transition-all shadow-lg active:scale-95`}
            >
              نعم، أريد رفع طلبية لبعد العطلة
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

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

    // جلب الإعدادات العامة أولاً
    const globalSettings = await prisma.globalSettings.findUnique({ where: { id: "system" } }).catch(() => null);

    if (globalSettings?.allOrdersPaused && sp.force !== "true") {
      return (
        <PausedOverlay
          title="توقف التوصيل حاليا"
          message={globalSettings.pauseMessage || "نعتذر، استقبال الطلبات متوقف حالياً في النظام بالكامل."}
          color="rose"
          icon="🛑"
          params={sp}
        />
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
        uiMode: true,
        shop: {
          select: {
            id: true,
            name: true,
            photoUrl: true,
            ordersPaused: true,
            pauseMessage: true,
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

    // معالجة حالة إيقاف الطلبات الخاصة بالمحل
    if (shop.ordersPaused && sp.force !== "true") {
      return (
        <PausedOverlay
          title={shop.name}
          message={shop.pauseMessage || "نعتذر، استقبال الطلبات متوقف حالياً."}
          color="orange"
          icon="📢"
          params={sp}
        />
      );
    }

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

    let initialOrder = null;
    if (sp.edit) {
      const editOrderNum = parseInt(sp.edit, 10);
      if (!isNaN(editOrderNum)) {
        const orderData = await prisma.order.findFirst({
          where: {
            orderNumber: editOrderNum,
            shopId: shop.id,
            status: { in: ["pending", "assigned"] }
          },
          include: {
            customerRegion: {
              select: {
                id: true,
                name: true,
                deliveryPrice: true,
              }
            },
            customer: {
              select: {
                name: true
              }
            }
          }
        });

        if (orderData) {
          initialOrder = {
            orderNumber: orderData.orderNumber,
            customerPhone: orderData.customerPhone,
            customerName: orderData.customer?.name || "",
            orderType: orderData.orderType,
            orderSubtotal: orderData.orderSubtotal ? orderData.orderSubtotal.toString() : "",
            alternatePhone: orderData.alternatePhone || "",
            orderTime: orderData.orderNoteTime || "",
            notes: orderData.summary || "",
            customerLocationUrl: orderData.customerLocationUrl,
            customerLandmark: orderData.customerLandmark,
            prepaidAll: orderData.prepaidAll,
            customerRegion: orderData.customerRegion ? {
              id: orderData.customerRegion.id,
              name: orderData.customerRegion.name,
              deliveryPrice: orderData.customerRegion.deliveryPrice.toString(),
            } : { id: "", name: "", deliveryPrice: "0" }
          };
        }
      }
    }

    return (
      <div className="kse-app-bg relative min-h-screen px-4 py-8 pb-16 text-slate-800">
        <div className="absolute top-4 left-4 z-50">
          <ThemeSwitcher />
        </div>
        <div className="kse-app-inner">
          <ClientOrderForm
            shopId={shop.id}
            shopName={shop.name}
            employeeName={employee.name}
            photoUrl={shop.photoUrl}
            shopRegionName={shop.region?.name || "غير محددة"}
            shopDeliveryAlf={shopDeliveryAlf}
            e={sp.e!}
            exp={sp.exp!}
            sig={sp.s!}
            viewerName=""
            initialOrder={initialOrder}
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
