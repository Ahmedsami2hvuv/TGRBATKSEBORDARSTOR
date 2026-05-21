"use client";

import { useState, useTransition } from "react";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { hideOrderFromPreparerDebtsAction, payOrderDebtAction } from "../actions";

type DebtOrder = {
  id: string;
  orderNumber: number;
  debtAmount: number;
  orderSubtotal: any;
  totalPaid: number;
  shop: { name: string };
  customerRegion: { name: string } | null;
};

export function DebtItemClient({
  order,
  auth,
}: {
  order: DebtOrder;
  auth: { p: string; exp: string; s: string };
}) {
  const [isPaying, setIsPaying] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [amountAlf, setAmountAlf] = useState(String(order.debtAmount));
  const [isPending, startTransition] = useTransition();

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("p", auth.p);
    fd.append("exp", auth.exp);
    fd.append("s", auth.s);
    fd.append("orderId", order.id);
    fd.append("amountAlf", amountAlf);

    startTransition(async () => {
      const res = await payOrderDebtAction(null, fd);
      if (res.ok) {
        setIsPaying(false);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else if (res.error) {
        alert(res.error);
      }
    });
  }

  async function handleHide(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm("هل تريد إخفاء هذا الدين؟")) return;
    const fd = new FormData();
    fd.append("p", auth.p);
    fd.append("exp", auth.exp);
    fd.append("s", auth.s);
    fd.append("orderId", order.id);

    startTransition(async () => {
      await hideOrderFromPreparerDebtsAction(null, fd);
    });
  }

  return (
    <div className="kse-glass-dark rounded-[2rem] border border-slate-200 p-5 shadow-sm bg-white overflow-hidden relative transition-all">
      {showSuccess && (
        <div className="absolute inset-0 bg-emerald-500/90 flex items-center justify-center z-10 animate-in fade-in duration-300">
           <div className="text-center text-white">
             <div className="text-3xl mb-2">✅</div>
             <p className="font-black">تم التسديد بنجاح</p>
           </div>
        </div>
      )}

      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg">#{order.orderNumber}</span>
             <h3 className="font-black text-slate-900 text-lg">{order.shop.name}</h3>
          </div>
          <p className="text-xs font-bold text-slate-400">{order.customerRegion?.name || "منطقة غير محددة"}</p>
        </div>
        <div className="text-left">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">المتبقي</p>
          <p className="text-xl font-black text-rose-600 tabular-nums">{formatDinarAsAlfWithUnit(order.debtAmount)}</p>
        </div>
      </div>

      {!isPaying ? (
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-50">
          <div className="text-[10px] font-bold text-slate-400">
             الحساب: {formatDinarAsAlfWithUnit(order.orderSubtotal)}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsPaying(true)}
              className="rounded-2xl bg-slate-900 px-6 py-2.5 text-xs font-black text-white shadow-lg shadow-slate-200 transition-transform active:scale-95"
            >
              تسديد
            </button>
            <button
              onClick={handleHide}
              className="rounded-2xl bg-slate-100 px-4 py-2.5 text-xs font-black text-slate-500 hover:bg-slate-200"
            >
              إخفاء
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handlePay} className="mt-5 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2">
          <p className="text-xs font-black text-slate-500 mb-3">أدخل المبلغ المراد تسديده للمحل:</p>
          <div className="flex gap-2">
            <input
              autoFocus
              inputMode="decimal"
              value={amountAlf}
              onChange={(e) => setAmountAlf(e.target.value)}
              className="h-12 flex-1 rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 font-black outline-none focus:border-indigo-500 focus:bg-white transition-all"
              placeholder="المبلغ"
            />
            <button
              type="submit"
              disabled={isPending}
              className="h-12 rounded-2xl bg-emerald-600 px-6 font-black text-white shadow-lg shadow-emerald-100 disabled:opacity-50"
            >
              {isPending ? "..." : "تأكيد"}
            </button>
            <button
              type="button"
              onClick={() => setIsPaying(false)}
              className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400"
            >
              ✕
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
