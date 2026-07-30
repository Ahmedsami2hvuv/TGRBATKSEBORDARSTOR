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
  onHide,
}: {
  order: DebtOrder;
  auth: { p: string; exp: string; s: string };
  onHide: (orderId: string) => void;
}) {
  const [isPaying, setIsPaying] = useState(false);
  const [showConfirmHide, setShowConfirmHide] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [amountAlf, setAmountAlf] = useState(String(order.debtAmount));
  const [mismatchNote, setMismatchNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const isPaid = order.debtAmount <= 0;
  const isPartiallyPaid = order.totalPaid > 0 && order.debtAmount > 0;
  const isPartial = Number(amountAlf) < order.debtAmount;

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
        const paidAmountNum = Number(amountAlf) || 0;
        const isFullyPaidNow = paidAmountNum >= order.debtAmount;
        setTimeout(() => {
          setShowSuccess(false);
          if (isFullyPaidNow) {
            onHide(order.id);
          }
          window.location.reload();
        }, 1200);
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
    onHide(order.id);

    startTransition(async () => {
      const res = await hideOrderFromPreparerDebtsAction(null, fd);
      if (res && res.error) {
        // إذا فشل فعلياً في قاعدة البيانات، نعيده للظهور وننبه المستخدم
        alert(res.error);
        window.location.reload();
      }
    });
  }

  return (
    <div className={`kse-glass-dark rounded-[2rem] border p-5 shadow-sm overflow-hidden relative transition-all duration-300 ${
      isPaid
        ? "bg-slate-100 border-slate-200 text-slate-500 opacity-70"
        : isPartiallyPaid
          ? "bg-amber-50 border-amber-200"
          : "bg-white border-slate-200"
    }`}>
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

      {/* شريط علوي يحتوي على رقم الطلب وزر الإخفاء */}
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">طلب رقم</span>
          <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg shadow-sm ${
            isPaid
              ? "bg-slate-200 text-slate-600"
              : isPartiallyPaid
                ? "bg-amber-100 text-amber-700"
                : "bg-indigo-600 text-white"
          }`}>#{order.orderNumber}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowConfirmHide(true)}
          className="text-xs font-bold text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1 border border-slate-200 rounded-xl px-3 py-1 bg-slate-50 hover:bg-rose-50"
          title="إخفاء هذا الدين"
        >
          <span>👁️</span>
          إخفاء
        </button>
      </div>

      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
             <h3 className={`font-black text-xl leading-tight ${isPaid ? "text-slate-500" : "text-slate-900"}`}>{order.shop.name}</h3>
          </div>
          <p className="text-sm font-bold text-slate-500 flex items-center gap-1">
            <span className="opacity-50">📍</span>
            {order.customerRegion?.name || "منطقة غير محددة"}
          </p>

          {isPartiallyPaid && (
            <div className="mt-3 flex gap-2">
               <div className="bg-slate-100 px-2 py-1 rounded-lg">
                 <p className="text-[9px] font-black text-slate-400 leading-none mb-0.5">المبلغ الكلي</p>
                 <p className="text-xs font-black text-slate-600 leading-none">{formatDinarAsAlfWithUnit(order.orderSubtotal)}</p>
               </div>
               <div className="bg-emerald-50 px-2 py-1 rounded-lg">
                 <p className="text-[9px] font-black text-emerald-400 leading-none mb-0.5">الواصل</p>
                 <p className="text-xs font-black text-emerald-600 leading-none">{formatDinarAsAlfWithUnit(order.totalPaid)}</p>
               </div>
            </div>
          )}
        </div>
        <div className="text-left shrink-0">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1">{isPaid ? "الحالة" : "المتبقي"}</p>
          {isPaid ? (
            <div className="bg-slate-200 px-4 py-2 rounded-2xl border border-slate-300">
               <p className="text-xl font-black text-slate-500">✅ مسدد</p>
            </div>
          ) : isPartiallyPaid ? (
            <div className="text-left">
               <p className="text-3xl font-black text-amber-600 tabular-nums leading-none tracking-tighter">{formatDinarAsAlfWithUnit(order.debtAmount)}</p>
               <p className="text-xs font-black text-amber-500 mt-2 bg-amber-100/50 px-2 py-0.5 rounded-lg inline-block">مسدد جزئياً</p>
            </div>
          ) : (
            <p className="text-4xl font-black text-rose-600 tabular-nums tracking-tighter">{formatDinarAsAlfWithUnit(order.debtAmount)}</p>
          )}
        </div>
      </div>

      {!isPaying ? (
        <div className="flex items-center gap-3 mt-8 pt-6 border-t-2 border-slate-50">
          {!isPaid && (
            <button
              onClick={() => setIsPaying(true)}
              className="w-full h-16 rounded-[1.5rem] bg-indigo-600 text-lg font-black text-white shadow-xl shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>💳</span>
              تسديد الدين
            </button>
          )}
          {isPaid && (
            <div className="w-full py-4 text-center">
               <p className="text-sm font-black text-slate-500 bg-slate-200 rounded-2xl py-3 border border-slate-300">بانتظار تدقيق الإدارة للأرشفة</p>
            </div>
          )}
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
