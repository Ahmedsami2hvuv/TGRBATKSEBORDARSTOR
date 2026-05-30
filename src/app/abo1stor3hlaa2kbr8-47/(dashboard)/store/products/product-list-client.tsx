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
  const [smartRemoveBg, setSmartRemoveBg] = useState(false);
  const [manualRemoveBg, setManualRemoveBg] = useState(false);
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
        purchasePrice: v.purchasePrice.toString(),
        salePrice: v.salePrice.toString()
      })) || []);
      setPurchasePrice(editing.purchasePrice || 0);
      setSalePrice(editing.salePrice || 0);
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
    // السعر المدخل هو السعر المباشر
    const purchase = purchaseUnit;

    let sale = 0;
    if (purchase < 1) {
      sale = purchase + 0.25;
    } else if (purchase < 5) {
      sale = purchase * 1.25;
    } else if (purchase < 10) {
      sale = purchase + 1;
    } else {
      sale = purchase * 1.10;
    }

    let roundedSale = 0;
    if (sale >= 10) {
      roundedSale = Math.ceil(sale / 0.5) * 0.5;
    } else {
      roundedSale = Math.ceil(sale / 0.25) * 0.25;
    }

    return roundedSale;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    formData.append("hasVariants", hasVariants.toString());
    formData.append("variants", JSON.stringify(variants));
    formData.append("removeBg", String(manualRemoveBg));

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
        fd.append("removeBg", String(smartRemoveBg));

        const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

        const res = await fetch(`/api${SECRET_ADMIN_PATH}/store/bulk-products`, {
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
      <div className="flex flex-col xl:flex-row gap-4 justify-between items-center bg-white p-4 rounded-3xl border border-slate-200 shadow-sm transition-all">
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
              <DynamicIcon iconKey="ui_search" config={icons} fallback="🔍" className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="ابحث عن منتج بالاسم أو الفرع..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-11 pl-4 py-3 rounded-2xl bg-slate-50 border-none outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white font-bold text-sm transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full xl:w-auto">
          <div className="flex bg-slate-50 p-1 rounded-2xl items-center border border-slate-200">
             <input
                placeholder="رابط الموقع القديم..."
                className="bg-transparent border-none outline-none px-4 py-2 text-xs font-bold w-40 placeholder:text-slate-400"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
             />
             <label className="mx-2 inline-flex items-center gap-1.5 text-[10px] font-black text-slate-600 whitespace-nowrap cursor-pointer">
               <input
                 type="checkbox"
                 checked={smartRemoveBg}
                 onChange={(e) => setSmartRemoveBg(e.target.checked)}
                 className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
               />
               قص الخلفية
             </label>
             <button
                onClick={handleImportUrl}
                disabled={importLoading}
                className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-[10px] font-black hover:bg-indigo-700 transition-all disabled:opacity-50 min-w-[100px] flex items-center justify-center gap-1.5 shadow-md shadow-indigo-100"
             >
                {importLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    {totalToImport > 0 ? `${importProgress}/${totalToImport}` : "..."}
                  </span>
                ) : (
                  <>
                    <DynamicIcon iconKey="ui_flash" config={icons} fallback="⚡" className="w-3.5 h-3.5" />
                    سحب ذكي
                  </>
                )}
             </button>
          </div>
          <label className="flex-1 md:flex-none px-6 py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 cursor-pointer flex items-center justify-center gap-2 text-xs">
            <DynamicIcon iconKey="ui_image" config={icons} fallback="🖼️" className="w-4 h-4" />
            إضافة متعددة
            <input type="file" multiple accept="image/*" className="hidden" onChange={handleBulkPhotoSelect} />
          </label>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(!showForm);
            }}
            className="flex-1 md:flex-none px-8 py-3 bg-slate-900 text-white font-black rounded-2xl hover:bg-indigo-600 transition-all shadow-lg active:scale-95 text-xs flex items-center justify-center gap-2"
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
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95">
                <div className="p-6 border-b flex items-center justify-between bg-slate-50">
                    <div>
                        <h2 className="text-xl font-black text-slate-900">استيراد مجموعة منتجات ({bulkFiles.length})</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">قم بمراجعة وتعديل بيانات المنتجات قبل الحفظ النهائي</p>
                    </div>
                    <button onClick={() => setShowBulkModal(false)} className="w-10 h-10 flex items-center justify-center bg-white rounded-2xl shadow-sm text-lg hover:text-rose-600 transition-colors">✕</button>
                </div>

                <div className="p-6 space-y-4">
                   <div className="bg-indigo-500/10 p-5 rounded-2xl border border-indigo-100 flex flex-col md:flex-row items-center gap-6 mb-2">
                      <div className="flex items-center gap-4">
                        <label className="font-black text-indigo-900 text-xs">الفرع الموحد:</label>
                        <select
                          value={bulkBranchId}
                          onChange={(e) => setBulkBranchId(e.target.value)}
                          className="px-4 py-2.5 rounded-xl border-none font-bold text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-sm"
                        >
                          <option value="">اختر الفرع...</option>
                          {branches.map(b => <option key={b.id} value={b.id}>{b.category?.name} - {b.name}</option>)}
                        </select>
                      </div>

                      <div className="h-6 w-px bg-indigo-200 hidden md:block" />
                      <p className="text-[10px] font-bold text-indigo-600/70 max-w-md">ملاحظة: سيتم رفع الصور ومعالجتها تلقائياً عند الضغط على زر الحفظ.</p>
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-3">
                    {bulkFiles.map((item, idx) => (
                        <div key={idx} className="flex flex-col md:flex-row gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-200 items-center transition-all hover:bg-white hover:shadow-lg group">
                            <div className="w-20 h-20 rounded-xl overflow-hidden shadow-md shrink-0 border-2 border-white transition-transform group-hover:scale-105">
                                <img src={item.preview} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3 w-full">
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">الاسم</span>
                                    <input
                                        value={item.name}
                                        onChange={(e) => {
                                            const newBulk = [...bulkFiles];
                                            newBulk[idx].name = e.target.value;
                                            setBulkFiles(newBulk);
                                        }}
                                        className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 font-black text-xs focus:ring-4 focus:ring-indigo-500/10 outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">الوصف</span>
                                    <input
                                        value={item.description || ""}
                                        onChange={(e) => {
                                            const newBulk = [...bulkFiles];
                                            newBulk[idx].description = e.target.value;
                                            setBulkFiles(newBulk);
                                        }}
                                        placeholder="بدون وصف..."
                                        className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 font-bold text-[10px] text-slate-500 italic focus:ring-4 focus:ring-indigo-500/10 outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">الشراء</span>
                                    <input
                                        type="number"
                                        value={item.purchasePrice}
                                        onChange={(e) => {
                                            const newBulk = [...bulkFiles];
                                            newBulk[idx].purchasePrice = e.target.value;
                                            const p = parseFloat(e.target.value);
                                            if (!isNaN(p)) {
                                                newBulk[idx].salePrice = calculateAutoSalePrice(p).toString();
                                            }
                                            setBulkFiles(newBulk);
                                        }}
                                        className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 font-black text-xs text-indigo-600 focus:ring-4 focus:ring-indigo-500/10 outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">البيع</span>
                                    <input
                                        type="number"
                                        value={item.salePrice}
                                        onChange={(e) => {
                                            const newBulk = [...bulkFiles];
                                            newBulk[idx].salePrice = e.target.value;
                                            setBulkFiles(newBulk);
                                        }}
                                        className="w-full px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-100 font-black text-xs text-indigo-700 focus:ring-4 focus:ring-indigo-500/10 outline-none"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={() => setBulkFiles(bulkFiles.filter((_, i) => i !== idx))}
                                className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-all flex items-center justify-center shrink-0 active:scale-90"
                            >
                                <DynamicIcon iconKey="ui_delete" config={icons} fallback="🗑️" className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="p-6 bg-slate-50 border-t flex gap-3">
                    <button
                        onClick={handleBulkSave}
                        disabled={loading || bulkFiles.length === 0 || !bulkBranchId}
                        className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-[0.98] text-sm"
                    >
                        {loading ? (
                            <div className="flex items-center justify-center gap-3">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                                <span>جاري الحفظ...</span>
                            </div>
                        ) : `🚀 حفظ كل الـ (${bulkFiles.length}) منتجات`}
                    </button>
                    <button
                        onClick={() => setShowBulkModal(false)}
                        className="flex-1 py-4 bg-white text-slate-600 font-black rounded-2xl border border-slate-200 hover:bg-slate-100 transition-all active:scale-[0.98] text-sm"
                    >
                        إلغاء
                    </button>
                </div>
            </div>
        </div>
      )}


      {(showForm || editing) && (
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-2xl animate-in fade-in zoom-in duration-300" id="product-form">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
            <div>
                <h2 className="text-xl font-black text-slate-900">{editing ? "تعديل المنتج" : "إضافة منتج جديد"}</h2>
                <p className="text-[10px] font-bold text-slate-500 mt-0.5 uppercase tracking-wider">تأكد من دقة البيانات لضمان تجربة مستخدم أفضل</p>
            </div>
            <button onClick={() => { setEditing(null); setShowForm(false); }} className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-2xl text-slate-400 hover:text-rose-500 transition-all active:scale-90">✕</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <input type="hidden" name="id" value={editing?.id || ""} />
            <input type="hidden" name="currentPhotoUrls" value={JSON.stringify(editing?.photoUrls || [])} />
            <input type="hidden" name="active" value={editing ? String(editing.active) : "true"} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">الفرع *</span>
                    <select
                        name="branchId"
                        defaultValue={editing?.branchId || defaultBranchId || ""}
                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold transition-all text-xs shadow-sm"
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

                <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">الاسم *</span>
                    <input
                        name="name"
                        defaultValue={editing?.name || ""}
                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold transition-all text-xs shadow-sm"
                        placeholder="مثلاً: بيبسي 330 مل"
                        required
                    />
                </div>

                <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">الترتيب</span>
                    <input
                        name="sequence"
                        type="number"
                        defaultValue={editing?.sequence || 0}
                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold transition-all text-xs shadow-sm"
                    />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">وصف المنتج</span>
                    <textarea
                        name="description"
                        defaultValue={editing?.description || ""}
                        rows={2}
                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold transition-all text-xs shadow-sm"
                        placeholder="أضف وصفاً مختصراً للمنتج..."
                    />
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">الصور</span>
                        <label className="inline-flex items-center gap-1 text-[9px] font-black text-indigo-600 bg-indigo-500/10 px-2 py-1 rounded-lg cursor-pointer border border-indigo-100 transition-all hover:bg-indigo-100">
                           <input
                             type="checkbox"
                             checked={manualRemoveBg}
                             onChange={(e) => setManualRemoveBg(e.target.checked)}
                             className="h-3 w-3 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                           />
                           قص الخلفية
                        </label>
                    </div>
                    <input
                        name="photos"
                        type="file"
                        accept="image/*"
                        multiple
                        className="w-full px-3 py-2 text-[10px] font-bold text-slate-400 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer bg-slate-50 rounded-2xl border border-slate-100 shadow-sm"
                    />
                </div>
            </div>

            {/* Has Variants Toggle */}
            <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-200">
              <div className="flex items-center gap-4 mb-6">
                <label className="flex items-center gap-3 cursor-pointer group select-none">
                  <div className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${hasVariants ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-100' : 'border-slate-300 bg-white group-hover:border-indigo-400'}`}>
                    <input
                        type="checkbox"
                        checked={hasVariants}
                        onChange={(e) => setHasVariants(e.target.checked)}
                        className="hidden"
                    />
                    {hasVariants && (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                  </div>
                  <div>
                    <span className="font-black text-slate-900 text-sm block">تعدد الخيارات (أحجام/أوزان)</span>
                    <p className="text-[10px] font-bold text-slate-500">للمنتجات ذات الأحجام أو الأوزان المختلفة</p>
                  </div>
                </label>
              </div>

              {!hasVariants ? (
                <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">سعر الشراء</span>
                      <div className="relative group">
                          <input
                              name="purchasePrice"
                              type="number"
                              step="0.001"
                              value={purchasePrice}
                              onChange={(e) => handlePurchasePriceChange(Number(e.target.value))}
                              className="w-full px-5 py-3 rounded-2xl bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-black text-slate-800 transition-all shadow-sm text-base"
                          />
                          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 group-focus-within:text-indigo-500 transition-colors">د.ع</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">سعر البيع النهائي</span>
                      <div className="relative group">
                          <input
                              name="salePrice"
                              type="number"
                              step="0.001"
                              value={salePrice}
                              onChange={(e) => setSalePrice(Number(e.target.value))}
                              className="w-full px-5 py-3 rounded-2xl bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-black text-indigo-600 transition-all shadow-sm text-base"
                          />
                          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 group-focus-within:text-indigo-500 transition-colors">د.ع</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block mr-1">هوامش الربح المقترحة:</label>
                    <div className="grid grid-cols-4 md:grid-cols-7 gap-1.5">
                      {[0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setProfitMargin(m);
                            setSalePrice(purchasePrice * (1 + m));
                          }}
                          className={`py-2.5 text-[10px] font-black rounded-xl border transition-all active:scale-95 ${profitMargin === m ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-500 border-transparent hover:border-slate-200 hover:bg-white'}`}
                        >
                          %{m * 100}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex flex-col md:flex-row gap-4 items-end bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex-1 space-y-1.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">نوع المتغير</span>
                      <select
                        name="variantType"
                        value={variantType}
                        onChange={(e) => setVariantType(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 outline-none font-bold text-xs focus:ring-4 focus:ring-indigo-500/10 transition-all"
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
                      className="px-8 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 flex items-center justify-center gap-2 text-xs"
                    >
                      <DynamicIcon iconKey="ui_plus" config={icons} fallback="+" className="w-4 h-4" />
                      إضافة خيار
                    </button>
                  </div>

                  <div className="space-y-3">
                    {variants.map((v, idx) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm items-center transition-all hover:shadow-md group">
                        <div className="md:col-span-3 space-y-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">القيمة</span>
                          <input
                            value={v.name}
                            onChange={(e) => updateVariant(idx, "name", e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border-none font-black text-xs outline-none focus:ring-4 focus:ring-indigo-500/10"
                            required
                          />
                        </div>
                        <div className="md:col-span-3 space-y-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">الكلفة</span>
                          <input
                            type="number"
                            step="0.001"
                            value={v.purchasePrice}
                            onChange={(e) => updateVariant(idx, "purchasePrice", e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border-none font-black text-xs outline-none focus:ring-4 focus:ring-indigo-500/10"
                            required
                          />
                        </div>
                        <div className="md:col-span-3 space-y-1">
                          <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">البيع</span>
                          <input
                            type="number"
                            step="0.001"
                            value={v.salePrice}
                            onChange={(e) => updateVariant(idx, "salePrice", e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-indigo-500/10 border-none font-black text-xs text-indigo-700 outline-none focus:ring-4 focus:ring-indigo-500/10"
                            required
                          />
                        </div>
                        <div className="md:col-span-3 flex justify-end">
                            <button
                                type="button"
                                onClick={() => removeVariant(idx)}
                                className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center transition-all hover:bg-rose-100 active:scale-90"
                            >
                                <DynamicIcon iconKey="ui_delete" config={icons} fallback="🗑️" className="w-4 h-4" />
                            </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col md:flex-row gap-4 pt-8 border-t border-slate-100">
              <button
                disabled={loading}
                className="flex-[2] py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-indigo-600 disabled:opacity-50 shadow-xl shadow-slate-200 transition-all active:scale-[0.98] text-base flex items-center justify-center gap-3"
              >
                {loading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                ) : (
                    <>
                        <DynamicIcon iconKey="ui_save" config={icons} fallback="💾" className="w-5 h-5" />
                        <span>حفظ بيانات المنتج</span>
                    </>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(null); setShowForm(false); }}
                className="flex-1 py-4 bg-white text-slate-500 font-black rounded-2xl border border-slate-200 hover:bg-slate-100 transition-all active:scale-[0.98] text-base"
              >
                إلغاء وإغلاق
              </button>
            </div>
          </form>
        </div>
      )}


      {/* Grid Display */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {displayedProducts.map((p) => (
          <div
            key={p.id}
            className={`relative group bg-white rounded-3xl border border-slate-200 transition-all duration-500 flex flex-col overflow-hidden hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 ${!p.active ? 'opacity-60 grayscale' : ''}`}
          >
            {/* Status Badge */}
            <div className={`absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full text-[8px] font-black border backdrop-blur-md shadow-sm transition-all group-hover:scale-110 ${p.active ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                {p.active ? "نشط" : "مخفي"}
            </div>

            <div className="relative aspect-square bg-slate-50/50 overflow-hidden flex flex-col items-center justify-center p-4">
              {p.photoUrls?.[0] ? (
                <img
                  src={p.photoUrls[0]}
                  alt={p.name}
                  loading="lazy"
                  className="relative z-10 w-full h-full object-contain transition-transform duration-700 group-hover:scale-110 drop-shadow-lg"
                />
              ) : (
                <div className="relative z-10 w-full h-full flex items-center justify-center text-slate-200">
                  <DynamicIcon iconKey="ui_box" config={icons} fallback="📦" className="w-12 h-12 opacity-30" />
                </div>
              )}
              <div className="absolute bottom-3 inset-x-3 flex justify-center translate-y-10 group-hover:translate-y-0 transition-transform duration-500">
                  <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-[9px] font-black text-indigo-600 shadow-xl border border-indigo-50">
                    {p.branch?.name || "عام"}
                  </div>
              </div>
            </div>

            <div className="p-4 flex-1 flex flex-col">
              <h3 className="font-black text-slate-900 line-clamp-2 mb-2 group-hover:text-indigo-600 transition-colors h-9 leading-snug text-xs">{p.name}</h3>

              <div className="flex flex-col gap-1 mb-4">
                <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">السعر</span>
                    <span className="text-xs font-black text-indigo-600">
                        {Number(p.salePrice).toLocaleString()} <span className="text-[9px]">د.ع</span>
                    </span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">التكلفة</span>
                    <span className="text-[9px] font-black text-slate-400">
                        {Number(p.purchasePrice).toLocaleString()} د.ع
                    </span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-auto grid grid-cols-3 gap-1.5 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                <button
                  onClick={() => {
                    setEditing(p);
                    setShowForm(true);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="p-2.5 bg-indigo-500/10 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center shadow-sm"
                  title="تعديل"
                >
                  <DynamicIcon iconKey="ui_edit" config={icons} fallback="✏️" className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleToggleActive(p)}
                  className={`p-2.5 rounded-xl transition-all flex items-center justify-center shadow-sm ${p.active ? 'bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white'}`}
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
                  className="p-2.5 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-sm"
                  title="حذف"
                >
                  <DynamicIcon iconKey="ui_delete" config={icons} fallback="🗑️" className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Delete Overlay */}
            {confirmDelete === p.id && (
                <div className="absolute inset-0 z-30 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
                    <div className="w-12 h-12 bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mb-3">
                        <DynamicIcon iconKey="ui_delete" config={icons} fallback="🗑️" className="w-6 h-6" />
                    </div>
                    <p className="text-white font-black text-xs mb-6 leading-relaxed">هل أنت متأكد من الحذف؟</p>
                    <div className="flex gap-2 w-full">
                        <button
                            onClick={async () => {
                                await deleteProduct(p.id);
                                setConfirmDelete(null);
                                router.refresh();
                            }}
                            className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl font-black text-[10px] hover:bg-rose-700 transition-all active:scale-95 shadow-lg shadow-rose-900/20"
                        >حذف</button>
                        <button
                            onClick={() => setConfirmDelete(null)}
                            className="flex-1 py-2.5 bg-white/10 text-white rounded-xl font-black text-[10px] hover:bg-white/20 transition-all"
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
            className="px-12 py-4 bg-white text-slate-900 font-black rounded-2xl border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-xl shadow-slate-200/50 active:scale-95 flex items-center gap-3 text-sm"
          >
            <span>عرض المزيد</span>
            <span className="bg-slate-100 px-2 py-0.5 rounded-full text-[10px] text-slate-500">
                {filteredProducts.length - visibleCount}
            </span>
          </button>
        </div>
      )}

    </div>
  );
}
