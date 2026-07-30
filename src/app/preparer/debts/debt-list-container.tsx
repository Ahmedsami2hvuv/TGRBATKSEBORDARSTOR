"use client";

import { useState, useTransition } from "react";
import { DebtItemClient } from "./debt-item-client";
import { hideOrderFromPreparerDebtsAction, createPreparerDebtAction } from "../actions";

export function DebtListContainer({
  initialOrders,
  auth,
  preparerShops = []
}: {
  initialOrders: any[],
  auth: { p: string; exp: string; s: string },
  preparerShops?: { id: string; name: string }[]
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [selectedShopId, setSelectedShopId] = useState<string | "all">("all");
  const [isPending, startTransition] = useTransition();

  // ميزات تسجيل الدين الجديد
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [shopName, setShopName] = useState("");
  const [amountAlf, setAmountAlf] = useState("");
  const [isSubmittingDebt, setIsSubmittingDebt] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // استخراج المحلات الفريدة التي لها ديون حالياً
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

  const handleHideOne = (orderId: string) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const handleHideAllCurrent = () => {
    const currentIds = filteredOrders.map(o => o.id);
    if (currentIds.length === 0) return;

    if (!confirm("هل أنت متأكد من إخفاء كافة الديون المعروضة حالياً؟")) return;

    // إخفاء محلي فوري لراحة المستخدم
    setOrders(prev => prev.filter(o => !currentIds.includes(o.id)));

    startTransition(async () => {
      const fd = new FormData();
      fd.append("p", auth.p);
      fd.append("exp", auth.exp);
      fd.append("s", auth.s);
      fd.append("orderIds", currentIds.join(","));

      const res = await hideOrderFromPreparerDebtsAction(null, fd);
      if (res && res.error) {
        alert(res.error);
        window.location.reload();
      }
    });
  };

  const handleAddDebtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountAlf.trim()) {
      alert("يرجى إدخال المبلغ.");
      return;
    }

    setIsSubmittingDebt(true);
    try {
      const fd = new FormData();
      fd.append("p", auth.p);
      fd.append("exp", auth.exp);
      fd.append("s", auth.s);
      fd.append("shopName", shopName.trim());
      fd.append("amountAlf", amountAlf.trim());

      const res = await createPreparerDebtAction(null, fd);
      if (res.ok) {
        setShowAddDebt(false);
        setShopName("");
        setAmountAlf("");
        window.location.reload();
      } else {
        alert(res.error || "حدث خطأ ما أثناء حفظ الدين.");
      }
    } catch (err: any) {
      alert("خطأ: " + (err.message || err));
    } finally {
      setIsSubmittingDebt(false);
    }
  };

  // فلترة اقتراحات المحلات بناءً على النص المدخل
  const filteredSuggestions = preparerShops.filter(s =>
    s.name.toLowerCase().includes(shopName.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* زر أخذت دين الرئيسي */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowAddDebt(true)}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base transition-all shadow-lg shadow-indigo-100 active:scale-[0.99]"
        >
          <span>💸</span>
          أخذت دين
        </button>
      </div>

      {/* مودال تسجيل دين جديد */}
      {showAddDebt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-[2rem] p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 relative">
            <button
              onClick={() => setShowAddDebt(false)}
              className="absolute top-4 left-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold"
            >
              ✕
            </button>
            <h3 className="text-xl font-black text-slate-900 mb-6 text-center">تسجيل دين جديد</h3>
            
            <form onSubmit={handleAddDebtSubmit} className="space-y-4">
              <div className="relative">
                <label className="block text-xs font-black text-slate-500 mb-1.5 mr-1">اسم المحل (اختياري - اتركه فارغاً لدين عام)</label>
                <input
                  type="text"
                  placeholder="مثال: أسواق النور"
                  value={shopName}
                  onChange={(e) => {
                    setShopName(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full h-12 rounded-xl border-2 border-slate-100 bg-slate-50 px-4 font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all text-sm"
                />
                {showSuggestions && shopName.trim() !== "" && filteredSuggestions.length > 0 && (
                  <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                    {filteredSuggestions.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setShopName(s.name);
                          setShowSuggestions(false);
                        }}
                        className="w-full text-right px-4 py-2.5 hover:bg-slate-50 text-sm font-bold text-slate-700 transition-colors border-b border-slate-100 last:border-0"
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5 mr-1">المبلغ بالألف</label>
                <input
                  type="number"
                  inputMode="decimal"
                  required
                  placeholder="مثال: 25000 أو 25"
                  value={amountAlf}
                  onChange={(e) => setAmountAlf(e.target.value)}
                  className="w-full h-12 rounded-xl border-2 border-slate-100 bg-slate-50 px-4 font-mono font-black outline-none focus:border-indigo-500 focus:bg-white transition-all text-lg"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmittingDebt}
                  className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center"
                >
                  {isSubmittingDebt ? "جاري الحفظ..." : "تأكيد تسجيل الدين"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddDebt(false)}
                  className="px-6 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-all"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* شريط الفلترة والأزرار الجماعية */}
      <div className="sticky top-0 z-30 bg-slate-50/80 backdrop-blur-md pt-2 pb-4 -mx-4 px-4 border-b border-slate-200/50">
        <div className="flex overflow-x-auto gap-2 no-scrollbar mb-3">
          <button
            onClick={() => setSelectedShopId("all")}
            className={`shrink-0 px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-sm ${
              selectedShopId === "all"
                ? "bg-indigo-600 text-white shadow-indigo-200"
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
                  className={`shrink-0 px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-sm ${
                      selectedShopId === shop.id
                      ? "bg-indigo-600 text-white shadow-indigo-200"
                      : "bg-white text-slate-500 border border-slate-200"
                  }`}
                  >
                  {shop.name} ({count})
                  </button>
              );
          })}
        </div>

        {filteredOrders.length > 0 && (
          <button
            onClick={handleHideAllCurrent}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black text-sm transition-all shadow-lg shadow-rose-100/50 active:scale-[0.99]"
          >
            <span>🚫</span>
            {selectedShopId === "all" 
              ? `إخفاء كافة الديون الحالية (${filteredOrders.length})`
              : `إخفاء كل ديون ${shopsMap.get(selectedShopId)} (${filteredOrders.length})`
            }
          </button>
        )}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-white/50 backdrop-blur-sm rounded-[2rem] p-12 text-center text-slate-400 border-2 border-dashed border-slate-200">
          <div className="text-4xl mb-3">✨</div>
          <p className="text-lg font-black text-slate-700">لا توجد ديون غير مسددة حالياً</p>
          <p className="text-xs font-bold text-slate-400 mt-1">جميع المستحقات والمعاملات مسددة بالكامل</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => (
            <DebtItemClient key={order.id} order={order} auth={auth} onHide={handleHideOne} />
          ))}
        </div>
      )}
    </div>
  );
}

