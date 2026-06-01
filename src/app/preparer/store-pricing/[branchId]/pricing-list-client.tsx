"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateStoreProductPrice } from "../../actions";
import { DynamicIcon } from "@/components/dynamic-icon";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import {
  dinarDecimalToAlfInputString,
  parseAlfInputToDinarNumber,
} from "@/lib/money-alf";

export function PricingListClient({
  branch,
  products,
  auth
}: {
  branch: any;
  products: any[];
  auth: { p: string; exp: string; s: string };
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);
  const router = useRouter();

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  async function handlePriceChange(productId: string, purchasePriceAlf: string) {
    const dinar = parseAlfInputToDinarNumber(purchasePriceAlf);
    if (dinar == null) return;

    setLoadingId(productId);
    setSuccessId(null);
    const formData = new FormData();
    formData.append("p", auth.p);
    formData.append("exp", auth.exp);
    formData.append("s", auth.s);
    formData.append("productId", productId);
    formData.append("purchasePrice", String(dinar));
    formData.append("branchId", branch.id);

    const res = await updateStoreProductPrice(null, formData);
    if (!res.ok) {
      alert(res.error || "فشل تحديث السعر");
    } else {
      setSuccessId(productId);
      setTimeout(() => setSuccessId(null), 3000);
      router.refresh();
    }
    setLoadingId(null);
  }

  return (
    <div className="space-y-4">
      {products.map((p) => (
        <ProductPricingCard
          key={p.id}
          product={p}
          loading={loadingId === p.id}
          success={successId === p.id}
          onSave={(price) => handlePriceChange(p.id, price)}
          icons={icons}
        />
      ))}
      {products.length === 0 && (
        <div className="text-center py-10 text-slate-400 font-bold bg-white rounded-3xl border-2 border-dashed border-slate-100">
          لا توجد منتجات في هذا الفرع حالياً.
        </div>
      )}
    </div>
  );
}

function ProductPricingCard({ product, loading, success, onSave, icons }: {
  product: any;
  loading: boolean;
  success: boolean;
  onSave: (price: string) => void;
  icons: GlobalIconsConfig | null;
}) {
  const dinarStored = Number(product.purchasePrice) || 0;
  const alfInitial = dinarDecimalToAlfInputString(dinarStored);
  const [alfInput, setAlfInput] = useState(alfInitial);

  useEffect(() => {
    setAlfInput(dinarDecimalToAlfInputString(Number(product.purchasePrice) || 0));
  }, [product.id, product.purchasePrice]);

  const parsed = parseAlfInputToDinarNumber(alfInput);
  const hasChanged =
    parsed != null && Math.round(parsed * 100) !== Math.round(dinarStored * 100);

  return (
    <div className={`bg-white p-4 rounded-3xl border shadow-sm flex items-center gap-4 transition-all focus-within:ring-4 focus-within:ring-emerald-50/50 ${
      success ? "border-emerald-500 bg-emerald-50/10" : "border-slate-100 focus-within:border-emerald-500"
    }`}>
      <div className="w-14 h-14 rounded-2xl bg-slate-50 overflow-hidden shrink-0 border border-slate-100">
        {product.image ? (
          <img src={product.image} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <DynamicIcon
              iconKey="ui_box"
              config={icons}
              className="h-8 w-8 text-slate-300"
              fallback={<span className="text-2xl">📦</span>}
            />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-black text-slate-800 truncate text-sm sm:text-base">{product.name}</h3>
        <p className={`text-[10px] font-bold italic transition-colors ${success ? "text-emerald-600" : "text-slate-400"}`}>
          {success ? "تم الحفظ بنجاح ✓" : "أدخل السعر ثم اضغط حفظ"}
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative w-24 sm:w-28">
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={alfInput}
            onChange={(e) => setAlfInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && hasChanged && !loading) {
                onSave(alfInput);
              }
            }}
            placeholder="0.00"
            className={`w-full pl-2 pr-10 sm:pr-12 py-2.5 border-2 rounded-xl text-center font-black transition-all text-sm sm:text-base outline-none ${
              hasChanged ? "bg-white border-emerald-500 text-emerald-600" : "bg-slate-50 border-slate-100 text-slate-600"
            }`}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] sm:text-[9px] font-black text-slate-400 leading-tight text-center pointer-events-none">
            ألف<br />د.ع
          </span>
        </div>

        <button
          onClick={() => onSave(alfInput)}
          disabled={loading || !hasChanged || parsed == null}
          className={`px-4 sm:px-5 py-2.5 rounded-xl font-black text-xs transition-all whitespace-nowrap ${
            hasChanged
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100 active:scale-95"
              : success ? "bg-emerald-100 text-emerald-600 cursor-default" : "bg-slate-100 text-slate-400 cursor-default"
          }`}
        >
          {loading ? "..." : success ? "تم" : "حفظ"}
        </button>
      </div>
    </div>
  );
}
