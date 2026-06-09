import { prisma } from "@/lib/prisma";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { checkAndApplyMonthlySalary } from "@/lib/staff-salary";
import Link from "next/link";
import { DynamicIcon } from "@/components/dynamic-icon";
import { getGlobalIcons } from "@/lib/icon-settings";
import { serializePrisma } from "@/lib/serialize-prisma";
import { SalaryWalletClient } from "./salary-wallet-client";

export const dynamic = "force-dynamic";

export default async function StaffSalaryWalletPage({
  searchParams,
}: {
  searchParams: Promise<{ se?: string; exp?: string; s?: string }>;
}) {
  const { se, exp, s } = await searchParams;
  const v = verifyStaffEmployeePortalQuery(se || "", exp || "", s || "");

  if (!v.ok) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-center bg-slate-50">
        <div className="rounded-3xl bg-white p-8 shadow-xl border border-rose-100 max-w-sm">
          <p className="text-rose-600 font-black text-lg">عذراً، الرابط غير صالح أو انتهت صلاحيته.</p>
          <p className="text-xs text-slate-400 mt-2">يرجى طلب رابط دخول جديد من الإدارة.</p>
        </div>
      </div>
    );
  }

  // 1. تطبيق تحديث الراتب التلقائي للشهر الجديد إن وجد
  await checkAndApplyMonthlySalary(v.staffEmployeeId);

  // 2. جلب معلومات الموظف مع المعاملات
  const staff = await prisma.staffEmployee.findUnique({
    where: { id: v.staffEmployeeId },
    include: {
      staffTransactions: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!staff || !staff.active) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-center bg-slate-50">
        <div className="rounded-3xl bg-white p-8 shadow-xl border border-slate-100 max-w-sm">
          <p className="text-red-600 font-black text-lg">الحساب غير موجود أو غير مفعل.</p>
        </div>
      </div>
    );
  }

  const icons = await getGlobalIcons();
  const authQ = `se=${se}&exp=${exp}&s=${s}`;

  // حساب إجمالي أرباح المبيعات (العمولات التي استلمها بيده في هذا الشهر)
  // لتسهيل الحسبة، سنقوم بجمع العمولات للـ receive_profit
  const totalReceivedProfits = staff.staffTransactions
    .filter(t => t.type === "receive_profit")
    .reduce((acc, t) => acc + Number(t.profit), 0);

  // جلب الطلبات التي رفعها هذا الموظف ولم يتم تسوية أرباحها بعد، وحالتها "تم التسليم"
  const orders = await prisma.order.findMany({
    where: {
      preparerShoppingJson: {
        path: ["staffId"],
        equals: staff.id,
      },
      status: "delivered",
    },
    orderBy: { createdAt: "desc" },
  });

  const pendingOrders = orders.filter((o) => {
    const json = o.preparerShoppingJson as any;
    return json && json.staffProfit && !json.profitSettled;
  });

  const serializedStaff = serializePrisma(staff);
  const serializedIcons = serializePrisma(icons);
  const serializedPendingOrders = serializePrisma(pendingOrders);

  return (
    <main className="min-h-screen bg-slate-50/50 px-4 py-8 pb-24 font-sans text-slate-800" dir="rtl">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <Link
            href={`/staff/portal?${authQ}`}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-100 text-slate-600 active:scale-95 transition-all"
          >
            <DynamicIcon iconKey="ui_arrow_right" config={icons} className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-black text-slate-900">المحفظة والرواتب</h1>
          <div className="w-10"></div>
        </header>

        {/* الكلاينت كومبوننت لتشغيل المعاملات التفاعلية والواتساب */}
        <SalaryWalletClient 
          staff={serializedStaff} 
          icons={serializedIcons} 
          authQ={authQ} 
          se={se || ""}
          exp={exp || ""}
          s={s || ""}
          totalReceivedProfits={totalReceivedProfits}
          pendingOrders={serializedPendingOrders}
        />
      </div>
    </main>
  );
}
