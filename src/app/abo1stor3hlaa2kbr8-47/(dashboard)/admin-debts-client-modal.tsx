"use client";

import { useState, useTransition } from "react";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { hideOrderFromPreparerDebtsAction, payOrderDebtAction } from "@/app/preparer/actions";

type DebtOrder = {
  id: string;
  orderNumber: number;
  debtAmount: number;
  orderSubtotal: number;
  totalPaid: number;
  shop: { name: string };
  customerRegion: { name: true } | any;
  createdAt: Date;
};

export function AdminDebtsClientModal({ initialOrders }: { initialOrders: DebtOrder[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [orders, setOrders] = useState(initialOrders);
  const [isPending, startTransition] = useTransition();
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function handlePay(orderId: string, amountAlf: string, mismatchNote?: string, expectedAlf?: number) {
    if (!amountAlf || Number(amountAlf) <= 0) return;

    setProcessingId(orderId + "-pay");
    const fd = new FormData();
    fd.append("orderId", orderId);
    fd.append("amountAlf", amountAlf);
    fd.append("isAdmin", "true");
    fd.append("adminName", "الإدارة");
    if (mismatchNote) fd.append("mismatchNote", mismatchNote);
    if (expectedAlf) fd.append("expectedAlf", String(expectedAlf));

    startTransition(async () => {
      const res = await payOrderDebtAction(null, fd);
      if (res.ok) {
        // تحديث محلي سريع
        setOrders(prev => prev.filter(o => o.id !== orderId));
      } else {
        alert(res.error || "فشل التسديد");
      }
      setProcessingId(null);
    });
  }

  async function handleHide(orderId: string) {
    if (!confirm("هل أنت متأكد من إخفاء هذا الدين عن الجميع؟")) return;

    setProcessingId(orderId + "-hide");
    const fd = new FormData();
    fd.append("orderId", orderId);
    fd.append("isAdmin", "true");

    startTransition(async () => {
      const res = await hideOrderFromPreparerDebtsAction(null, fd);
      if (res.ok) {
        setOrders(prev => prev.filter(o => o.id !== orderId));
      } else {
        alert(res.error || "فشل الإخفاء");
      }
      setProcessingId(null);
    });
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex-[2] rounded-2xl bg-slate-900 py-3 text-xs font-black text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 active:scale-95 flex items-center justify-center gap-2"
      >
        <span>📂</span>
        فتح كشف الديون الكامل
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="bg-rose-600 p-6 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-black">ديون المجهزين للمحلات</h3>
                <p className="text-xs font-bold text-rose-100 opacity-80">نفس الواجهة الظاهرة للمجهز مع صلاحيات المدير</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-xl hover:bg-white/30 transition"
              >
                ✕
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 space-y-4">
              {orders.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="text-slate-400 font-bold">لا توجد ديون معلقة حالياً</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {orders.map((order) => (
                    <DebtItemRow
                      key={order.id}
                      order={order}
                      onPay={handlePay}
                      onHide={handleHide}
                      isProcessing={processingId?.startsWith(order.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-white text-center">
               <p className="text-[10px] font-black text-slate-400">أي تعديل هنا سيؤثر على حسابات المجهزين ويرسل إشعارات فورية</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DebtItemRow({ order, onPay, onHide, isProcessing }: any) {
  const [payVal, setPayVal] = useState(String(order.debtAmount));
  const [mismatchNote, setMismatchNote] = useState("");
  const [isInputOpen, setIsInputOpen] = useState(false);

  const isPartial = Number(payVal) < order.debtAmount;

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm relative overflow-hidden group">
      <div className="flex justify-between items-start mb-4">
        <div>
           <div className="flex items-center gap-2">
             <span className="text-[10px] font-black bg-rose-50 text-rose-600 px-2 py-0.5 rounded-lg">#{order.orderNumber}</span>
             <h4 className="font-black text-slate-800">{order.shop.name}</h4>
           </div>
           <p className="text-[10px] font-bold text-slate-400 mt-1">{order.customerRegion?.name || "منطقة غير محددة"}</p>
        </div>
        <div className="text-left">
           <p className="text-[9px] font-black text-slate-400 uppercase">المتبقي</p>
           <p className="text-lg font-black text-rose-600 tabular-nums">{formatDinarAsAlfWithUnit(order.debtAmount)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {!isInputOpen ? (
          <div className="flex gap-2">
            <button
              disabled={isProcessing}
              onClick={() => setIsInputOpen(true)}
              className="flex-1 h-10 rounded-2xl bg-indigo-600 text-white text-[11px] font-black shadow-lg shadow-indigo-100 active:scale-95 transition disabled:opacity-50"
            >
              تسديد
            </button>
            <button
              disabled={isProcessing}
              onClick={() => onHide(order.id)}
              className="flex-1 h-10 rounded-2xl bg-slate-100 text-slate-500 text-[11px] font-black hover:bg-slate-200 active:scale-95 transition disabled:opacity-50"
            >
              إخفاء للكل
            </button>
          </div>
        ) : (
          <div className="space-y-2 animate-in slide-in-from-right-2">
            <div className="flex gap-2">
              <input
                autoFocus
                className="h-10 flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-3 text-xs font-black outline-none focus:border-indigo-500"
                value={payVal}
                onChange={e => setPayVal(e.target.value)}
              />
              <button
                onClick={() => {
                  if (isPartial && !mismatchNote.trim()) {
                    alert("يرجى كتابة سبب التسديد الجزئي");
                    return;
                  }
                  // سنقوم بتمرير formData بشكل غير مباشر عبر تعديل الـ onPay لتقبل البارامترات الجديدة
                  // لكن بما أن الـ onPay معرفة في الـ Parent، سنقوم بتعديل استدعائها هناك أو تمرير كائن
                  (onPay as any)(order.id, payVal, mismatchNote, order.debtAmount);
                }}
                disabled={isProcessing}
                className="h-10 px-4 bg-emerald-600 text-white rounded-2xl text-[11px] font-black shadow-lg shadow-emerald-100"
              >
                {isProcessing ? ".." : "تم"}
              </button>
              <button
                onClick={() => setIsInputOpen(false)}
                className="h-10 w-10 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {isPartial && (
              <div className="animate-in fade-in zoom-in-95 duration-200">
                <textarea
                  required
                  placeholder="سبب النقص؟ (مطلوب)"
                  value={mismatchNote}
                  onChange={e => setMismatchNote(e.target.value)}
                  className="w-full rounded-xl border-2 border-rose-100 bg-rose-50/50 p-2 text-[10px] font-bold outline-none focus:border-rose-400"
                  rows={2}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {isProcessing && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
           <div className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
        </div>
      )}
    </div>
  );
}
