import Link from "next/link";
import { ALF_PER_DINAR } from "@/lib/money-alf";
import type { EmployeeOrderPortalVerifyReason } from "@/lib/employee-order-portal-link";
import { verifyEmployeeOrderPortalQuery } from "@/lib/employee-order-portal-link";
import { clientOrderFormPath } from "@/lib/client-order-portal-nav";
import { prisma } from "@/lib/prisma";
import { EmployeePreparationClient } from "./preparation-client";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ e?: string; exp?: string; s?: string }>;
};

function invalidMessage(reason: EmployeeOrderPortalVerifyReason): string {
  switch (reason) {
    case "expired":
      return "انتهت صلاحية الرابط. اطلب رابطاً جديداً من الإدارة.";
    case "bad_signature":
    case "missing":
      return "الرابط غير صالح. تأكد من نسخه كاملاً.";
    case "no_secret":
      return "إعداد الخادم غير مكتمل.";
  }
}

export default async function EmployeePreparationPage({ searchParams }: Props) {
  const sp = await searchParams;
  const v = verifyEmployeeOrderPortalQuery(sp.e, sp.exp, sp.s);
  if (!v.ok) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">تعذّر فتح صفحة إنشاء طلبات</p>
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
  if (!employee || employee.orderPortalToken !== v.token) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">تعذّر فتح صفحة إنشاء طلبات</p>
            <p className="mt-2 text-sm text-slate-600">الرابط غير صالح. اطلب رابطاً جديداً من الإدارة.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="kse-app-bg min-h-screen px-4 py-8 pb-16 text-slate-800">
      <div className="kse-app-inner mx-auto max-w-2xl">
        <div className="mb-3 text-sm">
          <Link
            href={clientOrderFormPath(sp.e ?? "", sp.exp ?? "", sp.s ?? "")}
            className="font-bold text-sky-700 hover:underline"
          >
            ← الرجوع إلى صفحة إدخال الطلب
          </Link>
        </div>
        <EmployeePreparationClient
          employeeName={employee.name}
          shopName={employee.shop.name}
          shopRegionName={employee.shop.region.name}
          shopDeliveryAlf={Number(employee.shop.region.deliveryPrice.toString()) / ALF_PER_DINAR}
          e={sp.e ?? ""}
          exp={sp.exp ?? ""}
          sig={sp.s ?? ""}
        />
      </div>
    </div>
  );
}
