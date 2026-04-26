import { ALF_PER_DINAR } from "@/lib/money-alf";
import type { EmployeeOrderPortalVerifyReason } from "@/lib/employee-order-portal-link";
import { verifyEmployeeOrderPortalQuery } from "@/lib/employee-order-portal-link";
import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
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
  }
}

type Props = {
  searchParams: Promise<{ e?: string; exp?: string; s?: string; edit?: string; phone?: string }>;
};

export default async function ClientOrderPage({ searchParams }: Props) {
  const sp = await searchParams;
  const v = verifyEmployeeOrderPortalQuery(sp.e, sp.exp, sp.s);

  if (!v.ok) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">تعذّر فتح صفحة إدخال الطلب</p>
            <p className="mt-2 text-sm text-slate-600">{invalidMessage(v.reason)}</p>
          </div>
        </div>
      </div>
    );
  }

  const employee = await prisma.employee.findUnique({
    where: { id: v.employeeId },
    include: { shop: { include: { region: true } } },
  });

  if (!employee) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl p-8 text-center">
            <p className="text-lg font-bold text-slate-800">الموظف غير موجود</p>
          </div>
        </div>
      </div>
    );
  }

  if (employee.orderPortalToken !== v.token) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">تعذّر فتح صفحة إدخال الطلب</p>
            <p className="mt-2 text-sm text-slate-600">الرابط غير صالح. اطلب رابطاً جديداً من الإدارة.</p>
          </div>
        </div>
      </div>
    );
  }

  const shop = employee.shop;
  const shopDeliveryAlf =
    Number(shop.region.deliveryPrice.toString()) / ALF_PER_DINAR;
  const editRaw = String(sp.edit ?? "").trim();
  const editOrderNumber = Number.parseInt(editRaw, 10);
  const isEditMode = Number.isInteger(editOrderNumber) && editOrderNumber > 0;

  const viewerPhone = normalizeIraqMobileLocal11(sp.phone ?? "");
  let viewerName = "";
  if (viewerPhone) {
    const cust = await prisma.customer.findFirst({
      where: { shopId: shop.id, phone: viewerPhone },
      select: { name: true },
    });
    viewerName = cust?.name || "";
  }

  let initialOrder: {
    orderNumber: number;
    customerPhone: string;
    customerName: string;
    orderType: string;
    orderSubtotal: string;
    alternatePhone: string;
    orderTime: string;
    notes: string;
    customerLocationUrl: string;
    customerLandmark: string;
    prepaidAll: boolean;
    customerRegion: { id: string; name: string; deliveryPrice: string };
  } | null = null;

  if (isEditMode) {
    if (!viewerPhone) {
      return (
        <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
          <div className="kse-app-inner mx-auto max-w-md">
            <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
              <p className="text-lg font-bold text-rose-700">تعذّر فتح تعديل الطلب</p>
              <p className="mt-2 text-sm text-slate-600">رقم الهاتف مطلوب لفتح صفحة التعديل.</p>
            </div>
          </div>
        </div>
      );
    }
    const foundOrder = await prisma.order.findFirst({
      where: {
        orderNumber: editOrderNumber,
        shopId: shop.id,
        customerPhone: viewerPhone,
      },
      select: {
        orderNumber: true,
        status: true,
        customerPhone: true,
        orderType: true,
        orderSubtotal: true,
        alternatePhone: true,
        orderNoteTime: true,
        summary: true,
        customerLocationUrl: true,
        customerLandmark: true,
        prepaidAll: true,
        customer: { select: { name: true } },
        customerRegion: {
          select: { id: true, name: true, deliveryPrice: true },
        },
      },
    });

    if (!foundOrder) {
      return (
        <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
          <div className="kse-app-inner mx-auto max-w-md">
            <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
              <p className="text-lg font-bold text-rose-700">تعذّر فتح تعديل الطلب</p>
              <p className="mt-2 text-sm text-slate-600">الطلب غير موجود لهذا الرقم.</p>
            </div>
          </div>
        </div>
      );
    }

    if (foundOrder.status !== "pending" && foundOrder.status !== "assigned") {
      return (
        <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
          <div className="kse-app-inner mx-auto max-w-md">
            <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
              <p className="text-lg font-bold text-rose-700">لا يمكن تعديل الطلب</p>
              <p className="mt-2 text-sm text-slate-600">
                التعديل متاح فقط للطلبات الجديدة أو بانتظار المندوب.
              </p>
            </div>
          </div>
        </div>
      );
    }
    if (!foundOrder.customerRegion) {
      return (
        <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
          <div className="kse-app-inner mx-auto max-w-md">
            <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
              <p className="text-lg font-bold text-rose-700">تعذّر فتح تعديل الطلب</p>
              <p className="mt-2 text-sm text-slate-600">بيانات منطقة الزبون غير مكتملة لهذا الطلب.</p>
            </div>
          </div>
        </div>
      );
    }

    initialOrder = {
      orderNumber: foundOrder.orderNumber,
      customerPhone: foundOrder.customerPhone ?? "",
      customerName: foundOrder.customer?.name || "",
      orderType: foundOrder.orderType ?? "",
      orderSubtotal:
        foundOrder.orderSubtotal == null
          ? ""
          : (Number(foundOrder.orderSubtotal.toString()) / ALF_PER_DINAR).toString(),
      alternatePhone: foundOrder.alternatePhone ?? "",
      orderTime: foundOrder.orderNoteTime ?? "",
      notes: foundOrder.summary ?? "",
      customerLocationUrl: foundOrder.customerLocationUrl ?? "",
      customerLandmark: foundOrder.customerLandmark ?? "",
      prepaidAll: Boolean(foundOrder.prepaidAll),
      customerRegion: {
        id: foundOrder.customerRegion.id,
        name: foundOrder.customerRegion.name,
        deliveryPrice: foundOrder.customerRegion.deliveryPrice.toString(),
      },
    };
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
          shopRegionName={shop.region.name}
          shopDeliveryAlf={shopDeliveryAlf}
          e={sp.e!}
          exp={sp.exp!}
          sig={sp.s!}
          viewerName={viewerName}
          initialOrder={initialOrder}
        />
      </div>
    </div>
  );
}
