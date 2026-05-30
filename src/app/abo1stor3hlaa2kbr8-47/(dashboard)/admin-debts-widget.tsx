import { prisma } from "@/lib/prisma";
import { MONEY_KIND_PICKUP } from "@/lib/mandoub-money-events";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import Link from "next/link";
import { AdminDebtsClientModal } from "./admin-debts-client-modal";

export async function AdminDebtsWidget() {
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const orders = await prisma.order.findMany({
    where: {
      preparerDebtHidden: false, // الديون غير المخفية من قبل الإدارة
      status: { notIn: ["cancelled"] },
      orderSubtotal: { gt: 0 },
      createdAt: { gte: sixtyDaysAgo },
    },
    include: {
      moneyEvents: {
        where: { kind: MONEY_KIND_PICKUP, deletedAt: null },
      },
      customerRegion: { select: { name: true } },
      shop: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const debtOrders = orders.filter(o => {
    const totalPaid = o.moneyEvents.reduce((sum, e) => sum + Number(e.amountDinar), 0);
    const subtotal = Number(o.orderSubtotal || 0);
    return totalPaid < subtotal;
  }).map(o => {
    const totalPaid = o.moneyEvents.reduce((sum, e) => sum + Number(e.amountDinar), 0);
    const subtotal = Number(o.orderSubtotal || 0);
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      debtAmount: subtotal - totalPaid,
      orderSubtotal: subtotal,
      totalPaid,
      shop: { name: o.shop.name },
      customerRegion: o.customerRegion,
      createdAt: o.createdAt,
    };
  });

  const totalDebtsSum = debtOrders.reduce((sum, o) => sum + o.debtAmount, 0);

  return (
    <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-8 shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
            إدارة الديون (المحلات)
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">متابعة المستحقات المالية للمجهزين</p>
        </div>
        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 px-5 py-3 rounded-2xl text-left">
           <p className="text-xs font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider mb-1">إجمالي الديون المعلقة</p>
           <p className="text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">{formatDinarAsAlfWithUnit(totalDebtsSum)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
         <AdminDebtsClientModal initialOrders={debtOrders} />

         <Link
           href="/abo1stor3hlaa2kbr8-47/preparers"
           className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 py-4 text-sm font-bold text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95"
         >
           تفاصيل حسب المجهز
         </Link>
      </div>
    </section>
  );
}
