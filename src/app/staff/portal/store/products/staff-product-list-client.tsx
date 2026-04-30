"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { upsertProduct, deleteProduct } from "../../../../admin/(dashboard)/store/actions";
import { compressImageFileForUpload } from "@/lib/client-image-compress";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

export function StaffProductListClient({
  initialProducts,
  branches,
  suppliers,
  authQ
}: {
  initialProducts: any[],
  branches: any[],
  suppliers: any[],
  authQ: string
}) {
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  // مراقبة معطيات البحث لفتح نموذج التعديل تلقائياً
  useEffect(() => {
    const search = searchParams.get("search");
    if (search && !editing) {
      const found = initialProducts.find(p => p.id === search || p.name === search);
      if (found) {
        setEditing(found);
        setShowForm(true);
        setTimeout(() => {
          document.getElementById('product-form')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [searchParams, initialProducts, editing]);

  // حالة المتغيرات والأسعار
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<any[]>([]);
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [salePrice, setSalePrice] = useState<number>(0);

  // تحديث البيانات عند اختيار منتج للتعديل
  useEffect(() => {
    if (editing) {
      setHasVariants(editing.hasVariants || false);
      setVariants(editing.variants?.map((v: any) => ({
        name: v.name,
        purchasePrice: (Number(v.purchasePrice) / 1000).toString(),
        salePrice: (Number(v.salePrice) / 1000).toString()
      })) || []);
      setPurchasePrice(Number(editing.purchasePrice) / 1000 || 0);
      setSalePrice(Number(editing.salePrice) / 1000 || 0);
    } else {
      setHasVariants(false);
      setVariants([]);
      setPurchasePrice(0);
      setSalePrice(0);
    }
  }, [editing]);

  // دالة الحفظ
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    formData.append("hasVariants", hasVariants.toString());
    formData.append("variants", JSON.stringify(variants));
    formData.append("active", editing ? String(editing.active) : "true");

    const photoFiles = formData.getAll("photos") as File[];
    const validPhotos: File[] = [];
    for (const f of photoFiles) {
      if (f && f.size > 0) {
        const compressed = await compressImageFileForUpload(f, { maxEdgePx: 1000, jpegQuality: 0.8 });
        validPhotos.push(compressed);
      }
    }
    formData.delete("photos");
    validPhotos.forEach(f => formData.append("photos", f));

    const res = await upsertProduct(null, formData);
    if (res.ok) {
       window.location.reload();
    } else {
      alert("خطأ: " + res.error);
      setLoading(false);
    }
  }

  const filteredProducts = initialProducts.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      {/* البحث وزر الإضافة */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <input
            type="text"
            placeholder="بحث عن منتج..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-3 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-emerald-500 font-bold"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <DynamicIcon icon={icons?.ui_search} className="w-5 h-5 opacity-40" fallback={<span>🔍</span>} />
          </span>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(!showForm); }}
          className="w-full md:w-auto px-10 py-3 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          {showForm ? (
            <>
              <DynamicIcon icon={icons?.ui_close} className="w-5 h-5 brightness-0 invert" fallback={<span>✕</span>} />
              إغلاق
            </>
          ) : (
            <>
              <DynamicIcon icon={icons?.ui_add} className="w-5 h-5 brightness-0 invert" fallback={<span>+</span>} />
              إضافة منتج جديد
            </>
          )}
        </button>
      </div>

      {/* نموذج التعديل / الإضافة */}
      {(showForm || editing) && (
        <div className="bg-white p-8 rounded-[2.5rem] border-4 border-emerald-50 shadow-2xl animate-in fade-in zoom-in duration-300" id="product-form">
          <h2 className="text-2xl font-black text-slate-800 mb-8 border-b pb-4">
            {editing ? `تعديل المنتج: ${editing.name}` : "إضافة منتج جديد"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-8">
            <input type="hidden" name="id" value={editing?.id || ""} />
            <input type="hidden" name="currentPhotoUrls" value={JSON.stringify(editing?.photoUrls || [])} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 1. الفرع (تغيير المكان) */}
              <div className="space-y-2">
                <label className="text-sm font-black text-slate-500 mr-2">مكان المنتج (الفرع) *</label>
                <select name="branchId" defaultValue={editing?.branchId || ""} className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-none font-bold focus:ring-2 focus:ring-emerald-500" required>
                  <option value="">اختر الفرع...</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              {/* 2. اسم المنتج */}
              <div className="space-y-2">
                <label className="text-sm font-black text-slate-500 mr-2">اسم المنتج *</label>
                <input name="name" defaultValue={editing?.name || ""} className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-none font-bold focus:ring-2 focus:ring-emerald-500" required />
              </div>

              {/* 3. المورد */}
              <div className="space-y-2">
                <label className="text-sm font-black text-slate-500 mr-2">المورد</label>
                <select name="supplierId" defaultValue={editing?.supplierId || ""} className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-none font-bold focus:ring-2 focus:ring-emerald-500">
                  <option value="">تجهيز داخلي</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* 4. الأسعار */}
              <div className="space-y-2">
                <label className="text-sm font-black text-emerald-600 mr-2">سعر الشراء (بالآلاف)</label>
                <input name="purchasePrice" type="number" step="0.001" value={purchasePrice} onChange={(e) => setPurchasePrice(Number(e.target.value))} className="w-full px-5 py-3 rounded-2xl bg-emerald-50 border-none font-black text-emerald-700" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-violet-600 mr-2">سعر البيع (بالآلاف)</label>
                <input name="salePrice" type="number" step="0.001" value={salePrice} onChange={(e) => setSalePrice(Number(e.target.value))} className="w-full px-5 py-3 rounded-2xl bg-violet-50 border-none font-black text-violet-700" />
              </div>

              {/* 5. الصورة */}
              <div className="space-y-2">
                <label className="text-sm font-black text-slate-500 mr-2">تحديث الصورة (اختياري)</label>
                <input name="photos" type="file" accept="image/*" multiple className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200" />
              </div>
            </div>

            {/* زر الحفظ النهائي */}
            <div className="pt-6 border-t flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-5 bg-emerald-600 text-white font-black rounded-3xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 text-xl transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? "جاري الحفظ..." : "تـم - حفظ كافة التعديلات"}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(null); setShowForm(false); }}
                className="px-12 py-5 bg-slate-100 text-slate-500 font-black rounded-3xl hover:bg-slate-200 transition-all"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* عرض المنتجات */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        {filteredProducts.map((p) => (
          <div key={p.id} className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-transparent hover:border-emerald-200 transition-all overflow-hidden flex flex-col group">
            <div className="relative aspect-square bg-slate-50 flex items-center justify-center">
              {p.photoUrls?.[0] ? (
                <img src={p.photoUrls[0]} className="w-full h-full object-contain" alt="" />
              ) : (
                <DynamicIcon icon={icons?.ui_box} className="w-16 h-16 text-slate-200 opacity-50" fallback={<span className="text-5xl">📦</span>} />
              )}
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <h3 className="font-black text-slate-900 text-sm mb-1">{p.name}</h3>
              <p className="text-xs font-bold text-emerald-600 mb-4">{Number(p.salePrice).toLocaleString()} د.ع</p>
              <button
                onClick={() => { setEditing(p); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="w-full py-2 bg-sky-50 text-sky-700 rounded-xl font-black text-xs hover:bg-sky-100"
              >
                تعديل المنتج
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
