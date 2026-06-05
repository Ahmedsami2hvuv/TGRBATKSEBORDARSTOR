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

export function AdminDebtsClientModal({
  initialOrders,
  inline = false
}: {
  initialOrders: DebtOrder[];
  inline?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [orders, setOrders] = useState(initialOrders);
  const [isPending, startTransition] = useTransition();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<string | "all">("all");

  // استخراج المحلات الفريدة
  const shopsMap = new Map();
  orders.forEach(o => {
    if (!shopsMap.has(o.shopId)) {
      shopsMap.set(o.shopId, o.shop.name);
    }
  });
  const uniqueShops = Array.from(shopsMap.entries()).map(([id, name]) => ({ id, name }));

  const filteredOrders = selectedShopId === "all"
    ? orders
    : orders.filter(o => o.shopId === selectedShopId);

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

    // 1. تحديث الواجهة فوراً (حذف الطلبية من القائمة)
    setOrders(prev => prev.filter(o => o.id !== orderId));
    setProcessingId(orderId + "-hide");

    const fd = new FormData();
    fd.append("orderId", orderId);
    fd.append("isAdmin", "true");

    startTransition(async () => {
      try {
        const res = await hideOrderFromPreparerDebtsAction(null, fd);
        if (!res.ok) {
          // إذا فشل السيرفر فعلياً (وليس التيليجرام فقط)، نعيد الطلبية للقائمة
          alert(res.error || "فشل الإخفاء");
          window.location.reload(); // لإعادة جلب البيانات الصحيحة
        }
      } catch (err) {
        console.error("Action error:", err);
        window.location.reload();
      } finally {
        setProcessingId(null);
      }
    });
  }

  return (
    <>
      {!inline && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex-[2] rounded-2xl bg-slate-900 py-3 text-xs font-black text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 active:scale-95 flex items-center justify-center gap-2"
        >
          <span>📂</span>
          فتح كشف الديون الكامل
        </button>
      )}

      {(inline || isOpen) && (
        <div className={inline ? "w-full" : "fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200"}>
          <div className={inline 
            ? "bg-white w-full rounded-[2.5rem] border border-slate-100 flex flex-col overflow-hidden" 
            : "bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300"
          }>
            {/* Header */}
            <div className="bg-rose-600 p-6 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-black">ديون المجهزين للمحلات</h3>
                <p className="text-xs font-bold text-rose-100 opacity-80">نفس الواجهة الظاهرة للمجهز مع صلاحيات المدير</p>
              </div>
              {!inline && (
                <button
                  onClick={() => setIsOpen(false)}
                  className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-xl hover:bg-white/30 transition"
                >
                  ✕
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 space-y-4">
              {/* شريط الفلترة للإدارة */}
              {orders.length > 0 && (
                <div className="flex overflow-x-auto pb-4 gap-2 no-scrollbar sticky top-0 z-30 bg-slate-50/80 backdrop-blur-md pt-2 mb-4">
                  <button
                    onClick={() => setSelectedShopId("all")}
                    className={`shrink-0 px-5 py-2.5 rounded-xl font-black text-xs transition-all shadow-sm ${
                      selectedShopId === "all"
                        ? "bg-rose-600 text-white"
                        : "bg-white text-slate-500 border border-slate-200"
                    }`}
                  >
                    الكل ({orders.length})
                  </button>
                  {uniqueShops.map(shop => {
                      const count = orders.filter(o => o.shopId === shop.id).length;
                      return (
                          <button
                          key={shop.id}
                          onClick={() => setSelectedShopId(shop.id)}
                          className={`shrink-0 px-5 py-2.5 rounded-xl font-black text-xs transition-all shadow-sm ${
                              selectedShopId === shop.id
                              ? "bg-rose-600 text-white"
                              : "bg-white text-slate-500 border border-slate-200"
                          }`}
                          >
                          {shop.name} ({count})
                          </button>
                      );
                  })}
                </div>
              )}

              {filteredOrders.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="text-slate-400 font-bold">{orders.length === 0 ? "لا توجد ديون معلقة حالياً" : "لا توجد ديون لهذا المحل"}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredOrders.map((order) => (
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

  const isPaid = order.debtAmount <= 0;
  const isPartiallyPaid = order.totalPaid > 0 && order.debtAmount > 0;
  const isPartialInput = Number(payVal) < order.debtAmount;

  return (
    <div className={`rounded-[2.5rem] p-6 border shadow-xl relative overflow-hidden group transition-all duration-300 ${
      isPaid
        ? "bg-emerald-50 border-emerald-200"
        : isPartiallyPaid
          ? "bg-amber-50 border-amber-200"
          : "bg-white border-slate-100"
    }`}>
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
           <div className="flex items-center gap-3 mb-2">
             <span className={`text-sm font-black px-3 py-1 rounded-xl shadow-sm ${
               isPaid
                 ? "bg-emerald-100 text-emerald-700"
                 : isPartiallyPaid
                   ? "bg-amber-100 text-amber-700"
                   : "bg-rose-600 text-white"
             }`}>#{order.orderNumber}</span>
             <h4 className="font-black text-slate-800 text-xl leading-tight">{order.shop.name}</h4>
           </div>
           <p className="text-sm font-bold text-slate-400 mt-1">{order.customerRegion?.name || "منطقة غير محددة"}</p>

           {isPartiallyPaid && (
            <div className="mt-3 flex gap-2">
               <div className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                 <p className="text-[9px] font-black text-slate-400 leading-none mb-0.5">المبلغ الكلي</p>
                 <p className="text-xs font-black text-slate-600 leading-none">{formatDinarAsAlfWithUnit(order.orderSubtotal)}</p>
               </div>
               <div className="bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                 <p className="text-[9px] font-black text-emerald-400 leading-none mb-0.5">الواصل</p>
                 <p className="text-xs font-black text-emerald-600 leading-none">{formatDinarAsAlfWithUnit(order.totalPaid)}</p>
               </div>
            </div>
          )}
        </div>
        <div className="text-left shrink-0">
           <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1">{isPaid ? "الحالة" : "المتبقي"}</p>
           {isPaid ? (
             <div className="bg-emerald-100 px-4 py-2 rounded-2xl border border-emerald-200">
                <p className="text-xl font-black text-emerald-600">✅ مسدد</p>
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

      <div className="flex flex-col gap-3 mt-8 pt-6 border-t-2 border-slate-50">
        {!isInputOpen ? (
          <div className="flex gap-3">
            {!isPaid && (
              <button
                disabled={isProcessing}
                onClick={() => setIsInputOpen(true)}
                className="flex-[3] h-16 rounded-[1.5rem] bg-indigo-600 text-white text-lg font-black shadow-xl shadow-indigo-100 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span>💳</span>
                تسديد
              </button>
            )}
            <button
              disabled={isProcessing}
              onClick={() => onHide(order.id)}
              className="flex-1 h-16 rounded-[1.5rem] bg-slate-100 text-slate-500 text-sm font-black hover:bg-slate-200 active:scale-95 transition disabled:opacity-50 flex items-center justify-center"
            >
              إخفاء
            </button>
          </div>
        ) : (
          <div className="space-y-3 animate-in slide-in-from-right-2 duration-300">
            <div className="flex gap-2">
              <input
                autoFocus
                className="h-16 flex-1 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-5 text-xl font-black outline-none focus:border-indigo-500"
                value={payVal}
                onChange={e => setPayVal(e.target.value)}
              />
              <button
                onClick={() => {
                  if (isPartialInput && !mismatchNote.trim()) {
                    alert("يرجى كتابة سبب التسديد الجزئي");
                    return;
                  }
                  (onPay as any)(order.id, payVal, mismatchNote, order.debtAmount);
                }}
                disabled={isProcessing}
                className="h-16 px-8 bg-emerald-600 text-white rounded-[1.5rem] text-lg font-black shadow-xl shadow-emerald-100 flex items-center justify-center"
              >
                {isProcessing ? ".." : "تم"}
              </button>
              <button
                onClick={() => setIsInputOpen(false)}
                className="h-16 w-16 bg-slate-100 text-slate-400 rounded-[1.5rem] flex items-center justify-center text-xl"
              >
                ✕
              </button>
            </div>

            {isPartialInput && (
              <div className="animate-in fade-in zoom-in-95 duration-200">
                <textarea
                  required
                  placeholder="سبب النقص؟ (مطلوب)"
                  value={mismatchNote}
                  onChange={e => setMismatchNote(e.target.value)}
                  className="w-full rounded-2xl border-2 border-rose-100 bg-rose-50/50 p-4 text-sm font-bold outline-none focus:border-rose-400"
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
