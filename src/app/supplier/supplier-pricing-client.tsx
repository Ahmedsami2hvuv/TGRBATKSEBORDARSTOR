"use client";

import { useState } from "react";
import { updateSupplierProductPrice, toggleSupplierProductActive } from "./actions";

type Product = {
  id: string;
  name: string;
  image: string;
  purchasePrice: number;
  active: boolean;
};

export function SupplierPricingClient({
  supplierId,
  token,
  initialProducts,
  profitMargin
}: {
  supplierId: string;
  token: string;
  initialProducts: Product[];
  profitMargin: number;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState("");

  async function handleSave(productId: string) {
    if (!tempPrice || isNaN(Number(tempPrice))) return;

    setLoadingId(productId);
    const formData = new FormData();
    formData.append("productId", productId);
    formData.append("supplierId", supplierId);
    formData.append("token", token);
    formData.append("purchasePrice", tempPrice);

    const res = await updateSupplierProductPrice(formData);
    if (res.ok) {
      setProducts(prev => prev.map(p => {
        if (p.id === productId) {
          const newBuy = Number(tempPrice);
          return { ...p, purchasePrice: newBuy };
        }
        return p;
      }));
      setEditingId(null);
    } else {
      alert(res.error || "فشل التحديث");
    }
    setLoadingId(null);
  }

  async function handleToggleActive(productId: string, currentActive: boolean, e: React.MouseEvent) {
    e.stopPropagation();

    setTogglingId(productId);
    const formData = new FormData();
    formData.append("productId", productId);
    formData.append("supplierId", supplierId);
    formData.append("token", token);
    formData.append("active", (!currentActive).toString());

    const res = await toggleSupplierProductActive(formData);
    if (res.ok) {
      setProducts(prev => prev.map(p => {
        if (p.id === productId) {
          return { ...p, active: !currentActive };
        }
        return p;
      }));
    } else {
      alert(res.error || "فشل تغيير حالة المنتج");
    }
    setTogglingId(null);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {products.map((p) => {
        const isHidden = !p.active;
        return (
          <div
            key={p.id}
            className={`p-4 rounded-3xl border transition-all cursor-pointer relative overflow-hidden flex items-center gap-4 ${
              isHidden
                ? "bg-red-600 border-red-700 text-white shadow-lg shadow-red-900/20"
                : "bg-white border-slate-100 shadow-sm hover:shadow-md text-slate-800"
            }`}
            onClick={() => {
              if (editingId !== p.id) {
                setEditingId(p.id);
                setTempPrice(p.purchasePrice.toString());
              }
            }}
          >
            {isHidden && (
              <div className="absolute top-0 right-0 bg-red-800 text-[10px] font-black px-3 py-1 rounded-bl-2xl text-red-100">
                مخفي عن الزبائن 🚫
              </div>
            )}

            <div className="w-16 h-16 rounded-2xl bg-white overflow-hidden shrink-0 border border-slate-150">
              {p.image ? (
                <img src={p.image} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl bg-slate-50">📦</div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className={`font-black truncate ${isHidden ? "text-white" : "text-slate-800"}`}>
                {p.name}
              </h3>
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-[10px] font-black ${isHidden ? "text-red-100" : "text-slate-400"}`}>
                  سعر التجهيز الحالي: {Number(p.purchasePrice).toLocaleString()} د.ع
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={(e) => handleToggleActive(p.id, !!p.active, e)}
                disabled={togglingId === p.id}
                className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1 shrink-0 ${
                  isHidden
                    ? "bg-white hover:bg-red-50 text-red-700 hover:scale-105 active:scale-95 shadow-sm"
                    : "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 hover:scale-105 active:scale-95"
                }`}
                title={isHidden ? "إظهار المنتج للزبائن" : "إخفاء المنتج عن الزبائن"}
              >
                {togglingId === p.id ? (
                  ".."
                ) : isHidden ? (
                  <>👁️ إظهار</>
                ) : (
                  <>🚫 إخفاء</>
                )}
              </button>

              {editingId === p.id ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    type="number"
                    step="50"
                    value={tempPrice}
                    onChange={(e) => setTempPrice(e.target.value)}
                    className={`w-24 py-1.5 border-2 rounded-xl text-center font-black outline-none ${
                      isHidden
                        ? "bg-red-800 border-white text-white"
                        : "bg-emerald-50 border-emerald-500 text-emerald-700"
                    }`}
                  />
                  <button
                    onClick={() => handleSave(p.id)}
                    disabled={loadingId === p.id}
                    className={`p-2.5 rounded-xl shrink-0 transition-all active:scale-90 ${
                      isHidden ? "bg-white text-red-700 hover:bg-red-50" : "bg-emerald-600 text-white hover:bg-emerald-700"
                    }`}
                  >
                    {loadingId === p.id ? ".." : "✔️"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(p.id);
                    setTempPrice(p.purchasePrice.toString());
                  }}
                  className={`p-2 rounded-xl shrink-0 transition-transform hover:scale-110 active:scale-95 ${
                    isHidden ? "text-white hover:bg-red-700" : "text-slate-400 hover:bg-slate-50"
                  }`}
                  title="تعديل السعر"
                >
                  📝
                </button>
              )}
            </div>
          </div>
        );
      })}

      {products.length === 0 && (
        <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
          <p className="text-slate-400 font-bold">لم يتم تخصيص أي منتجات لك بعد.</p>
        </div>
      )}
    </div>
  );
}
