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
    <section className="kse-glass-dark rounded-[1.25rem] border border-rose-200 p-5 sm:p-6 shadow-xl shadow-rose-900/5">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-black text-rose-800 uppercase tracking-widest flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            إدارة الديون (المحلات)
          </h2>
          <p className="mt-1 text-xs text-slate-500 font-bold">متابعة المستحقات المالية للمجهزين</p>
        </div>
        <div className="bg-rose-50 border border-rose-100 px-4 py-2 rounded-2xl text-left">
           <p className="text-[10px] font-black text-rose-400 leading-none mb-1">إجمالي الديون المعلقة</p>
           <p className="text-xl font-black text-rose-600 tabular-nums">{formatDinarAsAlfWithUnit(totalDebtsSum)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
         <AdminDebtsClientModal initialOrders={debtOrders} />

         <Link
           href="/abo1stor3hlaa2kbr8-47/preparers"
           className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-white border-2 border-slate-100 py-3 text-xs font-black text-slate-600 transition hover:bg-slate-50 active:scale-95"
         >
           تفاصيل حسب المجهز
         </Link>
      </div>
    </section>
  );
}
