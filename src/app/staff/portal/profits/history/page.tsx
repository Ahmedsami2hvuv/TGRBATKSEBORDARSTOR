import { prisma } from "@/lib/prisma";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { DynamicIcon } from "@/components/dynamic-icon";
import Link from "next/link";
import { getGlobalIcons } from "@/lib/icon-settings";

export default async function StaffProfitsHistoryPage({
  searchParams,
}: {
  searchParams: { se?: string; exp?: string; s?: string };
}) {
  const { se, exp, s } = searchParams;
  const v = verifyStaffEmployeePortalQuery(se || "", exp || "", s || "");

  const icons = await getGlobalIcons();

  if (!v.ok) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <p className="text-red-600 font-bold">عذراً، الرابط غير صالح أو انتهت صلاحيته.</p>
        </div>
      </div>
    );
  }

  const staff = await prisma.staffEmployee.findUnique({
    where: { id: v.staffEmployeeId },
  });

  if (!staff || !staff.active) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <p className="text-red-600 font-bold">الحساب غير موجود أو غير مفعل.</p>
        </div>
      </div>
    );
  }

  // جلب الطلبات التي رفعها هذا الموظف وتم تسوية أرباحها
  const orders = await prisma.order.findMany({
    where: {
      preparerShoppingJson: {
        path: ["staffId"],
        equals: staff.id,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100, // نأخذ آخر 100 طلب كمثال
  });

  // تصفية الطلبات برمجياً للتأكد من حالة profitSettled
  const settledProfits = orders.filter((o) => {
    const json = o.preparerShoppingJson as any;
    return json && json.profitSettled;
  });

  const totalSettledProfit = settledProfits.reduce((acc, o) => {
    const json = o.preparerShoppingJson as any;
    return acc + (Number(json.staffProfit) || 0);
  }, 0);

  const authQ = `se=${se}&exp=${exp}&s=${s}`;

  return (
    <main className="min-h-screen bg-slate-50 p-4 pb-20 font-sans" dir="rtl">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <Link
            href={`/staff/portal/profits?${authQ}`}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm text-slate-600"
          >
            <DynamicIcon iconKey="ui_arrow_right" config={icons} className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-black text-slate-800">الأرباح المستلمة</h1>
          <div className="w-10"></div>
        </header>

        {/* Total Settled Summary */}
        <div className="mb-6 overflow-hidden rounded-3xl bg-slate-800 p-6 text-white shadow-lg">
          <p className="text-sm font-medium opacity-70">إجمالي الأرباح التي استلمتها</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-black">{totalSettledProfit.toLocaleString()}</span>
            <span className="text-sm font-bold opacity-60">د.ع</span>
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          <h2 className="px-2 text-sm font-bold text-slate-500">سجل الطلبات المسواة</h2>
          {settledProfits.length === 0 ? (
            <div className="rounded-3xl bg-white p-12 text-center shadow-sm">
              <p className="text-slate-400">لا يوجد سجل أرباح مسواة بعد.</p>
            </div>
          ) : (
            settledProfits.map((order) => {
              const json = order.preparerShoppingJson as any;
              const settledAt = json.settledAt ? new Date(json.settledAt) : null;

              return (
                <div
                  key={order.id}
                  className="overflow-hidden rounded-3xl bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-400">طلب #{order.id.slice(-6).toUpperCase()}</p>
                      <p className="mt-1 font-bold text-slate-800">{order.summary || "طلب ذو وجهتين"}</p>
                      {settledAt && (
                        <p className="mt-2 text-[10px] text-slate-400 italic">
                          تم الاستلام في: {settledAt.toLocaleString("ar-IQ")}
                        </p>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-lg font-black text-slate-400 line-through">+{json.staffProfit} د.ع</p>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-slate-50 pt-3 flex justify-end">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Settled / مسواة
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
