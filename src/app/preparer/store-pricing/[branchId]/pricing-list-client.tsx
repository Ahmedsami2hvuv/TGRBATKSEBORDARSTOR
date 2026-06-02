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
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  async function handlePriceChange(productId: string, purchasePriceAlf: string, variantId?: string) {
    const dinar = parseAlfInputToDinarNumber(purchasePriceAlf);
    if (dinar == null) return;

    const actionId = variantId || productId;
    setLoadingId(actionId);
    setSuccessId(null);
    const formData = new FormData();
    formData.append("p", auth.p);
    formData.append("exp", auth.exp);
    formData.append("s", auth.s);
    formData.append("productId", productId);
    if (variantId) formData.append("variantId", variantId);
    formData.append("purchasePrice", String(dinar));
    formData.append("branchId", branch.id);

    const res = await updateStoreProductPrice(null, formData);
    if (!res.ok) {
      alert(res.error || "فشل تحديث السعر");
    } else {
      setSuccessId(actionId);
      setTimeout(() => setSuccessId(null), 3000);
      router.refresh();
    }
    setLoadingId(null);
  }

  return (
    <div className="space-y-4">
      <div className="relative mb-6">
        <input
          type="text"
          placeholder="بحث عن منتج في هذا القسم..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-bold"
        />
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
      </div>

      {filteredProducts.map((p) => (
        <div key={p.id} className="space-y-2">
          <ProductPricingCard
            product={p}
            loading={loadingId === p.id}
            success={successId === p.id}
            onSave={(price) => handlePriceChange(p.id, price)}
            icons={icons}
          />
          {p.hasVariants && p.variants?.length > 0 && (
            <div className="mr-8 space-y-2 border-r-2 border-slate-100 pr-4">
              {p.variants.map((v: any) => (
                <ProductPricingCard
                  key={v.id}
                  product={v}
                  isVariant
                  loading={loadingId === v.id}
                  success={successId === v.id}
                  onSave={(price) => handlePriceChange(p.id, price, v.id)}
                  icons={icons}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {filteredProducts.length === 0 && (
        <div className="text-center py-10 text-slate-400 font-bold bg-white rounded-3xl border-2 border-dashed border-slate-100">
          {searchTerm ? "لا توجد نتائج تطابق بحثك" : "لا توجد منتجات في هذا الفرع حالياً."}
        </div>
      )}
    </div>
  );
}

function ProductPricingCard({ product, loading, success, onSave, icons, isVariant }: {
  product: any;
  loading: boolean;
  success: boolean;
  onSave: (price: string) => void;
  icons: GlobalIconsConfig | null;
  isVariant?: boolean;
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
    <div className={`bg-white p-3 md:p-4 rounded-3xl border shadow-sm flex items-center gap-3 transition-all focus-within:ring-4 focus-within:ring-emerald-50/50 ${
      success ? "border-emerald-500 bg-emerald-50/10" : "border-slate-100 focus-within:border-emerald-500"
    } ${isVariant ? "py-2 bg-slate-50/30" : ""}`}>
      <div className={`${isVariant ? "w-10 h-10" : "w-14 h-14"} rounded-2xl bg-slate-50 overflow-hidden shrink-0 border border-slate-100`}>
        {product.image ? (
          <img src={product.image} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <DynamicIcon
              iconKey={isVariant ? "ui_tag" : "ui_box"}
              config={icons}
              className={`${isVariant ? "h-5 w-5" : "h-8 w-8"} text-slate-300`}
              fallback={<span className={isVariant ? "text-lg" : "text-2xl"}>{isVariant ? "🏷️" : "📦"}</span>}
            />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className={`font-black text-slate-800 truncate ${isVariant ? "text-xs" : "text-sm sm:text-base"}`}>
          {isVariant ? `← ${product.name}` : product.name}
        </h3>
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
