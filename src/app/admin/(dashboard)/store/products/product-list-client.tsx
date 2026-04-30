"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { upsertProduct, deleteProduct } from "../actions";
import { compressImageFileForUpload } from "@/lib/client-image-compress";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

export function ProductListClient({
  initialProducts,
  branches,
  defaultBranchId,
  productCardBgUrl,
  icons
}: {
  initialProducts: any[],
  branches: any[],
  defaultBranchId?: string,
  productCardBgUrl?: string,
  icons: GlobalIconsConfig | null
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const router = useRouter();

  // --- Smart Scraper State ---
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<any[]>([]);
  const [bulkBranchId, setBulkBranchId] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [totalToImport, setTotalToImport] = useState(0);

  // Variants State
  const [hasVariants, setHasVariants] = useState(false);
  const [variantType, setVariantType] = useState("الوزن");
  const [variants, setVariants] = useState<{ name: string; purchasePrice: string; salePrice: string }[]>([]);

  // Pricing State for non-variant products
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [profitMargin, setProfitMargin] = useState(0.25);

  useEffect(() => {
    if (editing) {
      setHasVariants(editing.hasVariants || false);
      setVariantType(editing.variantType || "الوزن");
      setVariants(editing.variants?.map((v: any) => ({
        name: v.name,
        purchasePrice: (v.purchasePrice / 1000).toString(),
        salePrice: (v.salePrice / 1000).toString()
      })) || []);
      setPurchasePrice(editing.purchasePrice / 1000 || 0);
      setSalePrice(editing.salePrice / 1000 || 0);
    } else {
      setHasVariants(false);
      setVariants([]);
      setPurchasePrice(0);
      setSalePrice(0);
    }
  }, [editing]);

  const handlePurchasePriceChange = (val: number) => {
    setPurchasePrice(val);
    const suggestedSale = val * (1 + profitMargin);
    setSalePrice(suggestedSale);
  };

  const filteredProducts = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return initialProducts.filter(p =>
      p.name.toLowerCase().includes(lowerSearch) ||
      p.branch?.name?.toLowerCase().includes(lowerSearch)
    );
  }, [initialProducts, searchTerm]);

  const displayedProducts = filteredProducts.slice(0, visibleCount);

  function addVariant() {
    setVariants([...variants, { name: "", purchasePrice: "0", salePrice: "0" }]);
  }

  function removeVariant(index: number) {
    setVariants(variants.filter((_, i) => i !== index));
  }

  function updateVariant(index: number, field: string, value: string) {
    const newVariants = [...variants];
    (newVariants[index] as any)[field] = value;

    // تلقائي حساب سعر البيع عند تغيير سعر الشراء للمتغيرات
    if (field === "purchasePrice") {
      const p = parseFloat(value);
      if (!isNaN(p)) {
        (newVariants[index] as any).salePrice = calculateAutoSalePrice(p).toString();
      }
    }

    setVariants(newVariants);
  }

  function calculateAutoSalePrice(purchaseUnit: number): number {
    if (purchaseUnit <= 0) return 0;
    // تحويل القيمة المدخلة (مثلا 1) إلى قيمتها بالدنانير (1000)
    const purchase = purchaseUnit * 1000;

    let sale = 0;
    if (purchase < 1000) {
      sale = purchase + 250;
    } else if (purchase < 5000) {
      sale = purchase * 1.25;
    } else if (purchase < 10000) {
      sale = purchase + 1000;
    } else {
      sale = purchase * 1.10;
    }

    let roundedSale = 0;
    if (sale >= 10000) {
      roundedSale = Math.ceil(sale / 500) * 500;
    } else {
      roundedSale = Math.ceil(sale / 250) * 250;
    }

    // إعادة القيمة بصيغة الآلاف (مثلا 1.25) لتناسب الخانة
    return roundedSale / 1000;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    formData.append("hasVariants", hasVariants.toString());
    formData.append("variants", JSON.stringify(variants));

    const photoFiles = formData.getAll("photos") as File[];
    const validPhotos: File[] = [];
    for (const f of photoFiles) {
      if (f && f.size > 0) {
        const compressed = await compressImageFileForUpload(f, {
          maxEdgePx: 1000,
          jpegQuality: 0.8,
        });
        validPhotos.push(compressed);
      }
    }

    formData.delete("photos");
    validPhotos.forEach(f => formData.append("photos", f));

    const res = await upsertProduct(null, formData);
    if (res.ok) {
       // إذا كنا نقوم بتعديل منتج موجود، نغلق الفورم
       if (editing) {
         setEditing(null);
         setShowForm(false);
         router.refresh();
       } else {
         // إذا كان منتج جديد، لا نغلق الفورم، بل نصفره ونركز على الاسم
         form.reset();
         // إعادة تصفير قيم السعر اليدوية في الـ state إن وجدت
         const nameInput = form.querySelector('input[name="name"]') as HTMLInputElement;
         if (nameInput) nameInput.focus();
         setLoading(false);
         // تصفير المتغيرات
         setHasVariants(false);
         setVariants([]);
         // تنبيه بسيط للنجاح
         const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
         if (submitBtn) {
            const oldText = submitBtn.innerText;
            submitBtn.innerText = "✅ تم الحفظ بنجاح! أضف التالي...";
            setTimeout(() => { submitBtn.innerText = oldText; }, 2000);
         }
       }
    } else {
      alert(res.error);
      setLoading(false);
    }
  }

  async function handleBulkPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newEntries = files.map(file => ({
      file,
      name: file.name.split('.')[0], // اسم الملف كاسم مبدئي
      purchasePrice: "0",
      salePrice: "0",
      preview: URL.createObjectURL(file)
    }));

    setBulkFiles(prev => [...prev, ...newEntries]);
    setShowBulkModal(true);
  }

  async function handleImportUrl() {
    if (!importUrl) return;
    setImportLoading(true);

    try {
        // سحب المنتجات من actions.ts
        const { scrapeProductFromUrl, scrapeCategoryFromUrl } = await import("../actions");

        if (importUrl.includes("/sub/") || importUrl.includes("/cat/")) {
            // إذا كان رابط قسم
            const res = await scrapeCategoryFromUrl(importUrl);
            if (res.ok && res.productUrls) {
                const urls = res.productUrls.slice(0, 30);
                setTotalToImport(urls.length);
                setImportProgress(0);

                const newEntries = [];
                for (const pUrl of urls) {
                    const pRes = await scrapeProductFromUrl(pUrl);
                    if (pRes.ok && pRes.data) {
                        newEntries.push({
                            name: pRes.data.name,
                            description: pRes.data.description,
                            purchasePrice: pRes.data.price.toString(),
                            salePrice: pRes.data.price.toString(),
                            preview: pRes.data.imageUrl,
                            isUrl: true
                        });
                    }
                    setImportProgress(prev => prev + 1);
                }
                setBulkFiles(prev => [...prev, ...newEntries]);
                setShowBulkModal(true);
            }
        } else {
            // إذا كان رابط منتج واحد
            const res = await scrapeProductFromUrl(importUrl);
            if (res.ok && res.data) {
                setBulkFiles(prev => [...prev, {
                    name: res.data.name,
                    description: res.data.description,
                    purchasePrice: res.data.price.toString(),
                    salePrice: res.data.price.toString(),
                    preview: res.data.imageUrl,
                    isUrl: true
                }]);
                setShowBulkModal(true);
            } else {
                alert(res.error);
            }
        }
    } catch (e) {
        console.error("Scraping error:", e);
        alert("حدث خطأ أثناء محاولة جلب البيانات");
    } finally {
        setImportLoading(false);
        setImportUrl("");
    }
  }

  async function handleBulkSave() {
    if (!bulkBranchId) return alert("الرجاء اختيار الفرع أولاً");
    setLoading(true);

    try {
        const productsToUpload = await Promise.all(bulkFiles.map(async (item) => {
            let base64 = "";
            if (item.file) {
                // تحويل الملف لـ base64 للإرسال في JSON أو FormData
                // بما أننا سنستخدم API جديد، سنرسل FormData يحتوي على معلومات الصور
                // لكن لتسهيل المعالجة في الخلفية، سنحولها هنا لـ DataURL مؤقتاً
                base64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(item.file);
                });
            }
            return {
                name: item.name,
                description: item.description || "",
                purchasePrice: item.purchasePrice,
                salePrice: item.salePrice,
                imageUrl: item.isUrl ? item.preview : null,
                base64: base64 || null
            };
        }));

        const fd = new FormData();
        fd.append("branchId", bulkBranchId);
        fd.append("products", JSON.stringify(productsToUpload));
        fd.append("removeBg", "true"); // افتراضياً للمنتجات الجديدة من السحب

        const res = await fetch('/api/admin/store/bulk-products', {
            method: 'POST',
            body: fd
        });

        if (res.ok) {
            const data = await res.json();
            alert(`✅ تم البدء في إنشاء ${data.count} منتج!\nالعملية مستمرة في الخلفية لمعالجة الصور، ستظهر المنتجات فوراً وتلحقها الصور.`);
            setShowBulkModal(false);
            setBulkFiles([]);
            router.refresh();
        } else {
            const err = await res.json();
            alert("❌ فشل الاستيراد الجماعي: " + (err.error || "خطأ غير معروف"));
        }
    } catch (e: any) {
        alert("⚠️ حدث خطأ: " + e.message);
    } finally {
        setLoading(false);
    }
  }

  async function handleToggleActive(p: any) {
    const formData = new FormData();
    formData.append("id", p.id);
    formData.append("name", p.name);
    formData.append("branchId", p.branchId);
    formData.append("active", String(!p.active));

    // لإكمال النموذج لـ upsertProduct
    formData.append("hasVariants", String(p.hasVariants));
    formData.append("variants", JSON.stringify(p.variants || []));
    formData.append("purchasePrice", String(p.purchasePrice));
    formData.append("salePrice", String(p.salePrice));

    const res = await upsertProduct(null, formData);
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      {/* Search & Action Bar */}
      <div className="flex flex-col xl:flex-row gap-4 justify-between items-center bg-white p-4 rounded-3xl border border-slate-100 shadow-sm transition-all">
        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
              <DynamicIcon iconKey="ui_search" config={icons} fallback="🔍" className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="ابحث عن منتج..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-12 pl-4 py-3 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-sm transition-all"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full xl:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-2xl items-center border border-slate-200">
             <input
                placeholder="رابط الموقع القديم..."
                className="bg-transparent border-none outline-none px-4 py-2 text-xs font-bold w-40"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
             />
             <button
                onClick={handleImportUrl}
                disabled={importLoading}
                className="bg-violet-600 text-white px-4 py-2 rounded-xl text-[10px] font-black hover:bg-violet-700 transition disabled:opacity-50 min-w-[80px] flex items-center justify-center gap-1.5"
             >
                {importLoading ? (
                  <span className="flex items-center gap-1">
                    ⏳ {totalToImport > 0 ? `${importProgress}/${totalToImport}` : "..."}
                  </span>
                ) : (
                  <>
                    <DynamicIcon iconKey="ui_flash" config={icons} fallback="⚡" className="w-3 h-3" />
                    سحب ذكي
                  </>
                )}
             </button>
          </div>
          <label className="flex-1 md:flex-none px-6 py-3 bg-violet-600 text-white font-black rounded-2xl hover:bg-violet-700 transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2 text-xs">
            <DynamicIcon iconKey="ui_image" config={icons} fallback="🖼️" className="w-4 h-4" />
            إضافة متعددة
            <input type="file" multiple accept="image/*" className="hidden" onChange={handleBulkPhotoSelect} />
          </label>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(!showForm);
            }}
            className="flex-1 md:flex-none px-8 py-3 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-lg active:scale-95 text-xs flex items-center justify-center gap-2"
          >
            {showForm ? "✕ إغلاق" : (
              <>
                <DynamicIcon iconKey="ui_plus" config={icons} fallback="+" className="w-4 h-4" />
                إضافة منتج
              </>
            )}
          </button>
        </div>
      </div>

      {showBulkModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-[3rem] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95">
                <div className="p-8 border-b flex items-center justify-between bg-slate-50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">إضافة مجموعة منتجات ({bulkFiles.length})</h2>
                        <p className="text-sm text-slate-500 font-bold">قم بتعبئة البيانات لكل صورة وسيتم حفظها جميعاً فوراً</p>
                    </div>
                    <button onClick={() => setShowBulkModal(false)} className="w-12 h-12 flex items-center justify-center bg-white rounded-2xl shadow-sm text-xl">✕</button>
                </div>

                <div className="p-8 space-y-4">
                   <div className="bg-violet-50 p-6 rounded-2xl border border-violet-100 flex flex-col md:flex-row items-center gap-6 mb-6">
                      <div className="flex items-center gap-4">
                        <label className="font-black text-violet-900 text-sm">اختر الفرع لجميع هذه المنتجات:</label>
                        <select
                          value={bulkBranchId}
                          onChange={(e) => setBulkBranchId(e.target.value)}
                          className="px-4 py-2 rounded-xl border-none font-bold text-sm outline-none focus:ring-2 focus:ring-violet-500"
                        >
                          <option value="">اختر الفرع...</option>
                          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </div>

                      <div className="h-8 w-px bg-violet-200 hidden md:block" />
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 pt-0">
                    <div className="grid grid-cols-1 gap-4">
                        {bulkFiles.map((item, idx) => (
                            <div key={idx} className="flex flex-col md:flex-row gap-6 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 items-center">
                                <div className="w-32 h-32 rounded-2xl overflow-hidden shadow-md shrink-0 border-4 border-white">
                                    <img src={item.preview} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 mr-2">اسم المنتج</label>
                                        <input
                                            value={item.name}
                                            onChange={(e) => {
                                                const newBulk = [...bulkFiles];
                                                newBulk[idx].name = e.target.value;
                                                setBulkFiles(newBulk);
                                            }}
                                            className="w-full px-5 py-3 rounded-xl bg-white border-none font-black text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 mr-2">الوصف</label>
                                        <input
                                            value={item.description || ""}
                                            onChange={(e) => {
                                                const newBulk = [...bulkFiles];
                                                newBulk[idx].description = e.target.value;
                                                setBulkFiles(newBulk);
                                            }}
                                            placeholder="لا يوجد وصف"
                                            className="w-full px-5 py-3 rounded-xl bg-white border-none font-black text-xs text-slate-500 italic"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-emerald-600 mr-2">سعر الشراء (ألف)</label>
                                        <input
                                            type="number"
                                            value={item.purchasePrice}
                                            onChange={(e) => {
                                                const newBulk = [...bulkFiles];
                                                newBulk[idx].purchasePrice = e.target.value;
                                                // تطبيق التسعير التلقائي
                                                const p = parseFloat(e.target.value);
                                                if (!isNaN(p)) {
                                                    newBulk[idx].salePrice = calculateAutoSalePrice(p).toString();
                                                }
                                                setBulkFiles(newBulk);
                                            }}
                                            className="w-full px-5 py-3 rounded-xl bg-white border-none font-black text-sm text-emerald-600"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-violet-600 mr-2">سعر البيع</label>
                                        <input
                                            type="number"
                                            value={item.salePrice}
                                            onChange={(e) => {
                                                const newBulk = [...bulkFiles];
                                                newBulk[idx].salePrice = e.target.value;
                                                setBulkFiles(newBulk);
                                            }}
                                            className="w-full px-5 py-3 rounded-xl bg-white border-none font-black text-sm text-violet-600"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={() => setBulkFiles(bulkFiles.filter((_, i) => i !== idx))}
                                    className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition flex items-center justify-center"
                                >
                                    <DynamicIcon iconKey="ui_delete" config={icons} fallback="🗑️" className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-8 bg-slate-50 border-t flex gap-4">
                    <button
                        onClick={handleBulkSave}
                        disabled={loading || bulkFiles.length === 0}
                        className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 disabled:opacity-50 transition-all active:scale-95"
                    >
                        {loading ? "جاري حفظ كل المنتجات..." : `🚀 حفظ كل الـ (${bulkFiles.length}) منتجات الآن`}
                    </button>
                    <button
                        onClick={() => setShowBulkModal(false)}
                        className="px-8 py-4 bg-white text-slate-500 font-bold rounded-2xl border border-slate-200 hover:bg-slate-100 transition-all"
                    >
                        إلغاء
                    </button>
                </div>
            </div>
        </div>
      )}

      {(showForm || editing) && (
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-emerald-100 shadow-2xl animate-in fade-in zoom-in duration-300" id="product-form">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
            <h2 className="text-2xl font-black text-slate-900">{editing ? "تعديل بيانات المنتج" : "إضافة منتج جديد للمتجر"}</h2>
            <button onClick={() => { setEditing(null); setShowForm(false); }} className="text-slate-400 hover:text-rose-500 transition">✕</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <input type="hidden" name="id" value={editing?.id || ""} />
            <input type="hidden" name="currentPhotoUrls" value={JSON.stringify(editing?.photoUrls || [])} />
            <input type="hidden" name="active" value={editing ? String(editing.active) : "true"} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2">الفرع التابع له</label>
                    <select
                        name="branchId"
                        defaultValue={editing?.branchId || defaultBranchId || ""}
                        className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white outline-none font-bold transition-all text-sm"
                        required
                    >
                        <option value="">اختر الفرع...</option>
                        {branches.map(b => (
                        <option key={b.id} value={b.id}>
                            {b.category?.name || "بدون قسم"} - {b.name}
                        </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2">اسم المنتج</label>
                    <input
                        name="name"
                        defaultValue={editing?.name || ""}
                        className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white outline-none font-bold transition-all text-sm"
                        placeholder="اسم المنتج بوضوح..."
                        required
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2">تسلسل العرض</label>
                    <input
                        name="sequence"
                        type="number"
                        defaultValue={editing?.sequence || 0}
                        className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white outline-none font-bold transition-all text-sm"
                    />
                </div>

                <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2">وصف المنتج (اختياري)</label>
                    <textarea
                        name="description"
                        defaultValue={editing?.description || ""}
                        rows={2}
                        className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white outline-none font-bold transition-all text-sm"
                        placeholder="أضف تفاصيل المنتج هنا..."
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2">صور المنتج</label>
                    <input
                        name="photos"
                        type="file"
                        accept="image/*"
                        multiple
                        className="w-full px-4 py-2 text-xs font-bold text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                    />
                </div>
            </div>

            {/* Has Variants Toggle */}
            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
              <div className="flex items-center gap-4 mb-6">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${hasVariants ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white'}`}>
                    <input
                        type="checkbox"
                        checked={hasVariants}
                        onChange={(e) => setHasVariants(e.target.checked)}
                        className="hidden"
                    />
                    {hasVariants && <span className="text-white text-xs">✓</span>}
                  </div>
                  <span className="font-black text-slate-900 text-sm">هذا المنتج يحتوي على أحجام أو أوزان مختلفة</span>
                </label>
              </div>

              {!hasVariants ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2">سعر الكلفة (شراء)</label>
                      <div className="relative">
                          <input
                              name="purchasePrice"
                              type="number"
                              step="0.001"
                              value={purchasePrice}
                              onChange={(e) => handlePurchasePriceChange(Number(e.target.value))}
                              className="w-full px-5 py-3 rounded-2xl bg-white border-2 border-transparent focus:border-emerald-500 outline-none font-black text-emerald-600 transition-all shadow-sm"
                          />
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">د.ع</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2">سعر البيع للمستهلك</label>
                      <div className="relative">
                          <input
                              name="salePrice"
                              type="number"
                              step="0.001"
                              value={salePrice}
                              onChange={(e) => setSalePrice(Number(e.target.value))}
                              className="w-full px-5 py-3 rounded-2xl bg-white border-2 border-transparent focus:border-emerald-500 outline-none font-black text-violet-600 transition-all shadow-sm"
                          />
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">د.ع</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-[2rem] border border-slate-100">
                    <label className="text-xs font-black text-slate-400 mb-3 block mr-2">تطبيق هامش ربح سريع:</label>
                    <div className="flex flex-wrap gap-2">
                      {[0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setProfitMargin(m);
                            setSalePrice(purchasePrice * (1 + m));
                          }}
                          className={`flex-1 min-w-[70px] py-2 text-xs font-black rounded-xl border transition-all ${profitMargin === m ? 'bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-100' : 'bg-slate-50 text-slate-500 border-transparent hover:bg-slate-100'}`}
                        >
                          %{m * 100}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row gap-4 items-end bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex-1 space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest">نوع المتغير</label>
                      <select
                        name="variantType"
                        value={variantType}
                        onChange={(e) => setVariantType(e.target.value)}
                        className="w-full px-5 py-3 rounded-xl bg-slate-50 border-none outline-none font-bold text-sm"
                      >
                        <option value="الوزن">الوزن (1 كغم، 500 غم...)</option>
                        <option value="القياس">القياس (XL, Large, 42...)</option>
                        <option value="اللون">اللون (أحمر، أزرق...)</option>
                        <option value="أخرى">أخرى</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={addVariant}
                      className="px-8 py-3 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-100 active:scale-95"
                    >
                      + إضافة قيمة
                    </button>
                  </div>

                  <div className="space-y-3">
                    {variants.map((v, idx) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-2xl border border-slate-50 shadow-sm items-center">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400">القيمة</label>
                          <input
                            value={v.name}
                            onChange={(e) => updateVariant(idx, "name", e.target.value)}
                            placeholder="مثلاً: 1 كغم"
                            className="w-full px-4 py-2 rounded-xl bg-slate-50 border-none font-black text-sm"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-emerald-600">كلفة الشراء</label>
                          <input
                            type="number"
                            step="0.001"
                            value={v.purchasePrice}
                            onChange={(e) => updateVariant(idx, "purchasePrice", e.target.value)}
                            className="w-full px-4 py-2 rounded-xl bg-emerald-50 border-none font-black text-sm text-emerald-700"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-violet-600">سعر البيع</label>
                          <input
                            type="number"
                            step="0.001"
                            value={v.salePrice}
                            onChange={(e) => updateVariant(idx, "salePrice", e.target.value)}
                            className="w-full px-4 py-2 rounded-xl bg-violet-50 border-none font-black text-sm text-violet-700"
                            required
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeVariant(idx)}
                          className="mt-4 p-2 bg-rose-50 text-rose-600 rounded-xl font-black text-xs hover:bg-rose-100 transition"
                        >
                          ✕ حذف
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-6 border-t border-slate-50">
              <button
                disabled={loading}
                className="flex-1 md:flex-none px-12 py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 disabled:opacity-50 shadow-xl shadow-emerald-100 transition-all active:scale-95"
              >
                {loading ? "جاري الحفظ..." : "حفظ المنتج الآن"}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(null); setShowForm(false); }}
                className="px-8 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid Display */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {displayedProducts.map((p) => (
          <div
            key={p.id}
            className={`relative group bg-white rounded-[2.5rem] border-2 transition-all duration-300 flex flex-col overflow-hidden ${p.active ? 'border-transparent shadow-xl shadow-slate-200/50 hover:border-emerald-100' : 'border-slate-100 bg-slate-50/50 grayscale'}`}
          >
            {/* Status Badge */}
            <div className={`absolute top-4 left-4 z-10 w-3 h-3 rounded-full border-2 border-white shadow-sm ${p.active ? 'bg-emerald-500' : 'bg-slate-300'}`} />

            <div className="relative aspect-square bg-slate-50 overflow-hidden shadow-inner">
              {productCardBgUrl && (
                <div
                  className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                  style={{ backgroundImage: `url(${productCardBgUrl})` }}
                />
              )}
              {p.photoUrls?.[0] ? (
                <img
                  src={p.photoUrls[0]}
                  alt={p.name}
                  loading="lazy"
                  className="relative z-10 w-full h-full object-contain transition-transform duration-700 group-hover:scale-110"
                />
              ) : (
                <div className="relative z-10 w-full h-full flex items-center justify-center text-slate-300 text-5xl">
                  <DynamicIcon iconKey="ui_box" config={icons} fallback="📦" className="w-16 h-16 opacity-20" />
                </div>
              )}
              <div className="absolute bottom-3 right-3 z-20 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[9px] font-black text-emerald-600 shadow-sm">
                {p.branch?.name || "عام"}
              </div>
            </div>

            <div className="p-4 flex-1 flex flex-col">
              <h3 className="font-black text-slate-900 line-clamp-2 mb-1 group-hover:text-emerald-600 transition-colors h-10 leading-tight">{p.name}</h3>

              <div className="flex flex-col gap-0.5 mb-4">
                <p className="text-[10px] font-black text-emerald-600">
                    {p.hasVariants ? "تبدأ من:" : "السعر:"} {Number(p.salePrice).toLocaleString()} د.ع
                </p>
                <p className="text-[8px] font-bold text-slate-400">التكلفة: {Number(p.purchasePrice).toLocaleString()} د.ع</p>
              </div>

              {/* Actions */}
              <div className="mt-auto grid grid-cols-3 gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                <button
                  onClick={() => {
                    setEditing(p);
                    setShowForm(true);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="p-2 bg-sky-50 text-sky-700 rounded-xl text-[10px] font-black hover:bg-sky-100 transition-colors flex items-center justify-center"
                  title="تعديل"
                >
                  <DynamicIcon iconKey="ui_edit" config={icons} fallback="✏️" className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleToggleActive(p)}
                  className={`p-2 rounded-xl text-[10px] font-black transition-colors flex items-center justify-center ${p.active ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                  title={p.active ? "إخفاء" : "إظهار"}
                >
                  {p.active ? (
                    <DynamicIcon iconKey="ui_eye_off" config={icons} fallback="👁️" className="w-3.5 h-3.5" />
                  ) : (
                    <DynamicIcon iconKey="ui_eye" config={icons} fallback="🕶️" className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={() => setConfirmDelete(p.id)}
                  className="p-2 bg-rose-50 text-rose-700 rounded-xl text-[10px] font-black hover:bg-rose-100 transition-colors flex items-center justify-center"
                  title="حذف"
                >
                  <DynamicIcon iconKey="ui_delete" config={icons} fallback="🗑️" className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Delete Overlay */}
            {confirmDelete === p.id && (
                <div className="absolute inset-0 z-20 bg-rose-600/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-200">
                    <p className="text-white font-black text-sm mb-6 leading-relaxed">حذف المنتج نهائياً من المتجر؟</p>
                    <div className="flex gap-2 w-full">
                        <button
                            onClick={async () => {
                                await deleteProduct(p.id);
                                setConfirmDelete(null);
                                router.refresh();
                            }}
                            className="flex-1 py-3 bg-white text-rose-600 rounded-2xl font-black text-xs"
                        >نعم، احذف</button>
                        <button
                            onClick={() => setConfirmDelete(null)}
                            className="flex-1 py-3 bg-rose-800 text-white rounded-2xl font-black text-xs"
                        >إلغاء</button>
                    </div>
                </div>
            )}
          </div>
        ))}
      </div>

      {filteredProducts.length > visibleCount && (
        <div className="flex justify-center pt-8">
          <button
            onClick={() => setVisibleCount(prev => prev + 50)}
            className="px-12 py-4 bg-white text-slate-900 font-black rounded-2xl border-2 border-slate-100 hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm active:scale-95"
          >
            عرض المزيد من المنتجات ({filteredProducts.length - visibleCount} إضافية)
          </button>
        </div>
      )}
    </div>
  );
}
