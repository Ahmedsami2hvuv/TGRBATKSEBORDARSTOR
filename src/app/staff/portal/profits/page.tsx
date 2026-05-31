import { prisma } from "@/lib/prisma";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { DynamicIcon } from "@/components/dynamic-icon";
import Link from "next/link";
import { settleStaffProfit } from "../actions";
import { getGlobalIcons } from "@/lib/icon-settings";

export default async function StaffProfitsPage({
  searchParams,
}: {
  searchParams: Promise<{ se?: string; exp?: string; s?: string }>;
}) {
  const { se, exp, s } = await searchParams;
  const v = verifyStaffEmployeePortalQuery(se || "", exp || "", s || "");

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

  // تصفية الطلبات برمجياً للتأكد من حالة profitSettled
  const pendingProfits = orders.filter((o) => {
    const json = o.preparerShoppingJson as any;
    return json && json.staffProfit && !json.profitSettled;
  });

  const totalPendingProfit = pendingProfits.reduce((acc, o) => {
    const json = o.preparerShoppingJson as any;
    return acc + (Number(json.staffProfit) || 0);
  }, 0);

  const authQ = `se=${se}&exp=${exp}&s=${s}`;
  const icons = await getGlobalIcons();

  return (
    <main className="min-h-screen bg-slate-50 p-4 pb-20 font-sans" dir="rtl">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <Link
            href={`/staff/portal?${authQ}`}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm text-slate-600"
          >
            <DynamicIcon iconKey="ui_arrow_right" config={icons} className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-black text-slate-800">أرباحي (المحفظة)</h1>
          <div className="w-10"></div>
        </header>

        {/* Total Summary */}
        <div className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-600 p-6 text-white shadow-lg shadow-emerald-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium opacity-90">إجمالي الأرباح المستحقة</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-black">{totalPendingProfit.toLocaleString()}</span>
                <span className="text-sm font-bold opacity-80">د.ع</span>
              </div>
            </div>
            <Link
              href={`/staff/portal/profits/history?${authQ}`}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm transition hover:bg-white/30"
            >
              <DynamicIcon iconKey="ui_history" config={icons} className="w-6 h-6 text-white" />
            </Link>
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          <h2 className="px-2 text-sm font-bold text-slate-500">طلبات تم تسليمها (انتظار الاستلام)</h2>
          {pendingProfits.length === 0 ? (
            <div className="rounded-3xl bg-white p-12 text-center shadow-sm">
              <p className="text-slate-400">لا توجد أرباح معلقة حالياً.</p>
            </div>
          ) : (
            pendingProfits.map((order) => {
              const json = order.preparerShoppingJson as any;
              return (
                <div
                  key={order.id}
                  className="group relative overflow-hidden rounded-3xl bg-white p-5 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-400">طلب #{order.id.slice(-6).toUpperCase()}</p>
                      <p className="mt-1 font-bold text-slate-800">{order.summary || "طلب ذو وجهتين"}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-lg font-black text-emerald-600">+{json.staffProfit} د.ع</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-4">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-600">
                      تم التسليم بنجاح
                    </span>

                    <form action={settleStaffProfit}>
                      <input type="hidden" name="se" value={se} />
                      <input type="hidden" name="exp" value={exp} />
                      <input type="hidden" name="s" value={s} />
                      <input type="hidden" name="orderId" value={order.id} />
                      <button
                        type="submit"
                        className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white shadow-sm transition active:scale-95"
                      >
                        تم الاستلام مني
                      </button>
                    </form>
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
