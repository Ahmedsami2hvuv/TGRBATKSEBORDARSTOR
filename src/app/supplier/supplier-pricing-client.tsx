"use client";

import { useState } from "react";
import { updateSupplierProductPrice } from "./actions";

type Product = {
  id: string;
  name: string;
  image: string;
  purchasePrice: number;
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {products.map((p) => (
        <div
          key={p.id}
          className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => {
            if (editingId !== p.id) {
              setEditingId(p.id);
              setTempPrice(p.purchasePrice.toString());
            }
          }}
        >
          <div className="w-16 h-16 rounded-2xl bg-slate-50 overflow-hidden shrink-0 border border-slate-50">
            {p.image ? (
              <img src={p.image} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-black text-slate-800 truncate">{p.name}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] font-black text-slate-400">سعر التجهيز الحالي: {Number(p.purchasePrice).toLocaleString()} د.ع</span>
            </div>
          </div>

          {editingId === p.id ? (
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
               <input
                 autoFocus
                 type="number"
                 step="0.05"
                 value={tempPrice}
                 onChange={e => setTempPrice(e.target.value)}
                 className="w-20 py-2 bg-emerald-50 border-2 border-emerald-500 rounded-xl text-center font-black text-emerald-700 outline-none"
               />
               <button
                 onClick={() => handleSave(p.id)}
                 disabled={loadingId === p.id}
                 className="bg-emerald-600 text-white p-2 rounded-xl"
               >
                 {loadingId === p.id ? ".." : "✔️"}
               </button>
            </div>
          ) : (
            <div className="text-slate-300">
               📝
            </div>
          )}
        </div>
      ))}

      {products.length === 0 && (
        <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
           <p className="text-slate-400 font-bold">لم يتم تخصيص أي منتجات لك بعد.</p>
        </div>
      )}
    </div>
  );
}
