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
  const [showConfirmHide, setShowConfirmHide] = useState(false);
  const [isHidingLocally, setIsHidingLocally] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [amountAlf, setAmountAlf] = useState(String(order.debtAmount));
  const [mismatchNote, setMismatchNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const isPartial = Number(amountAlf) < order.debtAmount;
  const isPaid = order.debtAmount <= 0;

  if (isHidingLocally) return null;

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();

    if (isPartial && !mismatchNote.trim()) {
      alert("يرجى كتابة سبب التسديد الجزئي");
      return;
    }

    const fd = new FormData();
    fd.append("p", auth.p);
    fd.append("exp", auth.exp);
    fd.append("s", auth.s);
    fd.append("orderId", order.id);
    fd.append("amountAlf", amountAlf);
    fd.append("expectedAlf", String(order.debtAmount));
    fd.append("mismatchNote", mismatchNote);

    startTransition(async () => {
      const res = await payOrderDebtAction(null, fd);
      if (res.ok) {
        setIsPaying(false);
        setShowSuccess(true);
        // لا نخفيها محلياً الآن بناءً على طلب المستخدم لتبقى ظاهرة كـ "مسددة"
        setTimeout(() => {
          setShowSuccess(false);
          window.location.reload();
        }, 2000);
      } else if (res.error) {
        alert(res.error);
      }
    });
  }

  async function handleHide() {
    const fd = new FormData();
    fd.append("p", auth.p);
    fd.append("exp", auth.exp);
    fd.append("s", auth.s);
    fd.append("orderId", order.id);

    // إخفاء فوري من الواجهة لراحة المستخدم
    setIsHidingLocally(true);

    startTransition(async () => {
      const res = await hideOrderFromPreparerDebtsAction(null, fd);
      if (res && res.error) {
        // إذا فشل فعلياً في قاعدة البيانات، نعيده للظهور وننبه المستخدم
        setIsHidingLocally(false);
        alert(res.error);
      }
    });
  }

  return (
    <div className={`kse-glass-dark rounded-[2rem] border p-5 shadow-sm overflow-hidden relative transition-all duration-300 ${isPaid ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"}`}>
      {showSuccess && (
        <div className="absolute inset-0 bg-emerald-500/95 flex items-center justify-center z-20 animate-in fade-in duration-300">
           <div className="text-center text-white">
             <div className="text-3xl mb-2">✅</div>
             <p className="font-black">تم التسديد بنجاح</p>
           </div>
        </div>
      )}

      {showConfirmHide && (
         <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center z-20 animate-in zoom-in-95 duration-200">
            <div className="text-center p-6">
               <p className="text-white font-black text-lg mb-6">هل أنت متأكد من إخفاء هذا الدين؟</p>
               <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleHide}
                    disabled={isPending}
                    className="bg-rose-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-rose-900/20 active:scale-95 transition-all"
                  >
                    نعم، إخفاء
                  </button>
                  <button
                    onClick={() => setShowConfirmHide(false)}
                    className="bg-white/10 text-white px-8 py-3 rounded-2xl font-black border border-white/20 active:scale-95 transition-all"
                  >
                    تراجع
                  </button>
               </div>
            </div>
         </div>
      )}

      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${isPaid ? "bg-emerald-100 text-emerald-700" : "bg-indigo-50 text-indigo-600"}`}>#{order.orderNumber}</span>
             <h3 className="font-black text-slate-900 text-lg leading-none">{order.shop.name}</h3>
          </div>
          <p className="text-xs font-bold text-slate-400">{order.customerRegion?.name || "منطقة غير محددة"}</p>
        </div>
        <div className="text-left">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{isPaid ? "الحالة" : "المتبقي"}</p>
          {isPaid ? (
            <p className="text-lg font-black text-emerald-600">✅ مسدد</p>
          ) : (
            <p className="text-xl font-black text-rose-600 tabular-nums">{formatDinarAsAlfWithUnit(order.debtAmount)}</p>
          )}
        </div>
      </div>

      {!isPaying ? (
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-50">
          <div className="text-[10px] font-bold text-slate-400">
             الحساب: {formatDinarAsAlfWithUnit(order.orderSubtotal)}
          </div>
          <div className="flex gap-2">
            {!isPaid && (
              <button
                onClick={() => setIsPaying(true)}
                className="rounded-2xl bg-indigo-600 px-6 py-2.5 text-xs font-black text-white shadow-lg shadow-indigo-100 transition-all active:scale-95"
              >
                تسديد
              </button>
            )}
            <button
              onClick={() => setShowConfirmHide(true)}
              className="rounded-2xl bg-slate-100 px-4 py-2.5 text-xs font-black text-slate-500 hover:bg-slate-200 active:scale-95 transition-all"
            >
              إخفاء
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handlePay} className="mt-5 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
          <p className="text-xs font-black text-slate-500 mb-3">أدخل المبلغ المراد تسديده للمحل:</p>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                autoFocus
                inputMode="decimal"
                value={amountAlf}
                onChange={(e) => setAmountAlf(e.target.value)}
                className="h-12 flex-1 rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 font-black outline-none focus:border-indigo-500 focus:bg-white transition-all text-lg"
                placeholder="المبلغ"
              />
              <button
                type="submit"
                disabled={isPending}
                className="h-12 rounded-2xl bg-emerald-600 px-6 font-black text-white shadow-lg shadow-emerald-100 disabled:opacity-50 active:scale-95 transition-all"
              >
                {isPending ? "..." : "تأكيد"}
              </button>
              <button
                type="button"
                onClick={() => setIsPaying(false)}
                className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 active:scale-95 transition-all"
              >
                ✕
              </button>
            </div>

            {isPartial && (
              <div className="animate-in fade-in zoom-in-95 duration-200">
                <p className="text-[10px] font-black text-rose-600 mb-1 mr-1">لماذا المبلغ أقل من المطلوب؟</p>
                <textarea
                  required
                  placeholder="اكتب السبب هنا... (مثلاً: خصم من المحل، تم دفع الباقي مسبقاً، إلخ)"
                  value={mismatchNote}
                  onChange={(e) => setMismatchNote(e.target.value)}
                  className="w-full rounded-xl border-2 border-rose-100 bg-rose-50/30 p-3 text-xs font-bold outline-none focus:border-rose-400"
                  rows={2}
                />
              </div>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
