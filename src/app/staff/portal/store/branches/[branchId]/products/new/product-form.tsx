"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertProduct } from "@/app/admin/(dashboard)/store/actions";
import { compressImageFileForUpload } from "@/lib/client-image-compress";
import { ad } from "@/lib/admin-ui";

export function ProductForm({
  branchId,
  categories,
  authParams
}: {
  branchId: string;
  categories: { id: string, name: string }[];
  authParams: { se: string; exp: string; s: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [profitMargin, setProfitMargin] = useState(0.25); // الهامش الافتراضي 25%

  const handlePurchasePriceChange = (val: number) => {
    setPurchasePrice(val);
    // تسعير تلقائي: سعر البيع = سعر الشراء + (سعر الشراء * الهامش)
    // نلغي Math.ceil للسماح بالكسور (مثلاً 1.25) كما طلب المستخدم
    const suggestedSale = val * (1 + profitMargin);
    setSalePrice(suggestedSale);
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      // ضغط الصور قبل الرفع
      const photoFiles = formData.getAll("photos") as File[];
      const validPhotos: File[] = [];
      for (const f of photoFiles) {
        if (f && f.size > 0) {
          try {
            const compressed = await compressImageFileForUpload(f, {
              maxEdgePx: 1000,
              jpegQuality: 0.8,
            });
            validPhotos.push(compressed);
          } catch (e) {
            console.error("Compression error", e);
            validPhotos.push(f); // fallback to original if failed
          }
        }
      }

      formData.delete("photos");
      validPhotos.forEach(f => formData.append("photos", f));

      const res = await upsertProduct(null, formData);
      if (res.ok) {
        const authQ = new URLSearchParams(authParams).toString();
        router.push(`/staff/portal/store/branches/${branchId}?${authQ}`);
        router.refresh();
      } else {
        setError(res.error || "حدث خطأ غير متوقع");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="branchId" value={branchId} />

      <div>
        <label className={ad.label}>اسم المنتج *</label>
        <input
          name="name"
          required
          placeholder="مثال: طماطم، خيار..."
          className={ad.input}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={ad.label}>سعر الشراء (دينار)</label>
          <input
            name="purchasePrice"
            type="number"
            step="0.001"
            value={purchasePrice}
            onChange={(e) => handlePurchasePriceChange(Number(e.target.value))}
            className={ad.input}
            required
          />
        </div>
        <div>
          <label className={ad.label}>سعر البيع المقترح</label>
          <input
            name="salePrice"
            type="number"
            step="0.001"
            value={salePrice}
            onChange={(e) => setSalePrice(Number(e.target.value))}
            className={`${ad.input} text-emerald-600 font-black`}
            required
          />
        </div>
      </div>

      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
        <label className="text-xs font-bold text-slate-500 mb-2 block">هامش الربح التلقائي</label>
        <div className="flex gap-2">
           {[0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50].map(m => (
             <button
               key={m}
               type="button"
               onClick={() => {
                 setProfitMargin(m);
                 setSalePrice(purchasePrice * (1 + m));
               }}
               className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition ${profitMargin === m ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200'}`}
             >
               %{m * 100}
             </button>
           ))}
        </div>
      </div>

      <div>
        <label className={ad.label}>صور المنتج</label>
        <input
          name="photos"
          type="file"
          accept="image/*"
          multiple
          className={ad.input}
        />
        <p className="mt-1 text-[10px] text-slate-400 font-bold">سيتم ضغط الصور تلقائياً لتسريع التحميل</p>
      </div>

      <div>
        <label className={ad.label}>وصف قصير (اختياري)</label>
        <textarea
          name="description"
          rows={2}
          className={ad.input}
          placeholder="مثال: طازج، انتاج اليوم..."
        ></textarea>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-2xl bg-emerald-600 py-4 text-sm font-black text-white shadow-lg transition hover:bg-emerald-700 disabled:opacity-50 active:scale-95"
      >
        {isPending ? "جارٍ ضغط الصور والحفظ..." : "حفظ المنتج"}
      </button>
    </form>
  );
}
