"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  updateShopStoreProfile,
  addShopStoreCategory,
  deleteShopStoreCategory,
  addShopStoreBranch,
  deleteShopStoreBranch,
  addShopStoreProduct,
  deleteShopStoreProduct,
  addShopStoreSlide,
  deleteShopStoreSlide,
} from "@/app/actions/shop-store-actions";
import {
  Store,
  Plus,
  Trash2,
  ExternalLink,
  Share2,
  Copy,
  Check,
  Image as ImageIcon,
  FolderPlus,
  PackagePlus,
  Layers,
  Settings,
  Sparkles,
  UploadCloud,
  Loader2,
  ChevronLeft,
  Tag,
  Eye,
  Megaphone,
  Camera,
} from "lucide-react";

interface StoreManagerProps {
  shop: any;
  categories: any[];
  branches: any[];
  products: any[];
  slides: any[];
}

export function StoreManager({
  shop,
  categories = [],
  branches = [],
  products = [],
  slides = [],
}: StoreManagerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"products" | "categories" | "banners" | "profile">("products");
  const [uploading, setUploading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // حقول بيانات وهوية المتجر
  const [storeLogoUrl, setStoreLogoUrl] = useState(shop.storeLogoUrl || "");
  const [bannerUrl, setBannerUrl] = useState(shop.storeBannerUrl || "");
  const [bio, setBio] = useState(shop.storeBio || "");

  // حقول إضافة قسم جديد
  const [newCatName, setNewCatName] = useState("");
  const [newCatPhoto, setNewCatPhoto] = useState("");

  // حقول إضافة فرع
  const [newBranchCatId, setNewBranchCatId] = useState(categories[0]?.id || "");
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchPhoto, setNewBranchPhoto] = useState("");

  // حقول إضافة منتج جديد
  const [prodName, setProdName] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodPhoto, setProdPhoto] = useState("");
  const [prodCatId, setProdCatId] = useState(categories[0]?.id || "");
  const [prodBranchId, setProdBranchId] = useState("");

  // حقول إضافة بانر
  const [slideImage, setSlideImage] = useState("");
  const [slideTitle, setSlideTitle] = useState("");

  // مزامنة تلقائية لاختيار القسم الفعال
  useEffect(() => {
    if (categories && categories.length > 0) {
      if (!prodCatId || !categories.some((c) => c.id === prodCatId)) {
        setProdCatId(categories[0].id);
      }
      if (!newBranchCatId || !categories.some((c) => c.id === newBranchCatId)) {
        setNewBranchCatId(categories[0].id);
      }
    }
  }, [categories, prodCatId, newBranchCatId]);

  // الرابط المباشر الجديد لمتجر المحل
  const targetToken = shop.storeToken || shop.id;
  const storeUrl = typeof window !== "undefined"
    ? `${window.location.origin}/shop/${targetToken}`
    : `https://aboakbr.com/shop/${targetToken}`;

  const shareText = `مرحبا الي سالوني عن متجرنه هذا الرابط مالتنه:\n${storeUrl}`;

  // دالة رفع الصور مع الضغط التلقائي
  async function handleFileUpload(file: File, type: string) {
    setUploading(type);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", `shop_${shop.id}`);

      const res = await fetch("/api/shop-store/upload", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (data.success && data.url) {
        if (type === "shop_logo") setStoreLogoUrl(data.url);
        if (type === "shop_banner") setBannerUrl(data.url);
        if (type === "cat_photo") setNewCatPhoto(data.url);
        if (type === "branch_photo") setNewBranchPhoto(data.url);
        if (type === "prod_photo") setProdPhoto(data.url);
        if (type === "slide_image") setSlideImage(data.url);
      } else {
        alert(data.error || "فشل رفع الصورة");
      }
    } catch (e: any) {
      alert("حدث خطأ أثناء رفع الصورة: " + e.message);
    } finally {
      setUploading(null);
    }
  }

  // نسخ رسالة المشاركة
  function copyShareMessage() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      window.prompt("انسخ رسالة المتجر:", shareText);
    }
  }

  function shareOnWhatsApp() {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, "_blank");
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 font-sans text-slate-800" dir="rtl">
      {/* 1. البطاقة الترحيبية والهيدر القيادي الفاخر */}
      <div className="bg-gradient-to-br from-[#0B2E8C] via-[#0E3AA8] to-[#1E40AF] text-white rounded-3xl p-6 md:p-8 shadow-xl shadow-blue-950/15 relative overflow-hidden">
        {/* زخرفة خفيفة في الخلفية */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-amber-400/10 rounded-full blur-2xl -ml-16 -mb-16 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-1 flex items-center justify-center shrink-0 shadow-lg">
              {storeLogoUrl ? (
                <img src={storeLogoUrl} alt={shop.name} className="w-full h-full object-cover rounded-xl" />
              ) : (
                <Store className="w-8 h-8 md:w-10 md:h-10 text-white" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  متجرك الإلكتروني مفعّل ونشط
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight">
                إدارة متجر {shop.name}
              </h1>
              <p className="text-blue-100/80 text-xs md:text-sm mt-0.5 max-w-md line-clamp-1">
                {bio || "تحكم بأقسامك ومنتجاتك وعروضك وشارك رابط متجرك مع زبائنك بسهولة"}
              </p>
            </div>
          </div>

          {/* أزرار الإجراءات السريعة */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              href={`/shop/${targetToken}`}
              target="_blank"
              className="bg-white/15 hover:bg-white/25 text-white border border-white/25 px-4 py-2.5 rounded-2xl text-xs md:text-sm font-black transition flex items-center gap-2 shadow-sm active:scale-95"
            >
              <Eye className="w-4 h-4 text-amber-300" />
              <span>معاينة متجر الزبائن</span>
            </Link>

            <button
              onClick={shareOnWhatsApp}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-2xl text-xs md:text-sm font-black transition flex items-center gap-2 shadow-md shadow-emerald-900/20 active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              <span>مشاركة واتساب</span>
            </button>
          </div>
        </div>

        {/* شريط نسخ الرابط المباشر */}
        <div className="mt-6 pt-5 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-blue-200 font-bold shrink-0">رابط متجرك المباشر:</span>
            <span className="bg-black/25 px-3 py-1.5 rounded-xl text-white font-mono text-[11px] md:text-xs truncate select-all border border-white/10">
              {storeUrl}
            </span>
          </div>

          <button
            onClick={copyShareMessage}
            className="bg-white text-[#0B2E8C] hover:bg-blue-50 px-4 py-2 rounded-xl font-black flex items-center justify-center gap-1.5 transition shadow-sm shrink-0 active:scale-95"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                <span className="text-emerald-700">تم نسخ الرابط بنجاح!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#0B2E8C]" />
                <span>نسخ رسالة ورابط المتجر</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. كروت الإحصائيات السريعة */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-black text-slate-900 leading-none">{products.length}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">المنتجات المعروضة</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FolderPlus className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-black text-slate-900 leading-none">{categories.length}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">الأقسام الرئيسية</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-black text-slate-900 leading-none">{branches.length}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">الفروع التابعة</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-black text-slate-900 leading-none">{slides.length}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">إعلانات البانر</div>
          </div>
        </div>
      </div>

      {/* 3. شريط التبويبات الفخم */}
      <div className="bg-slate-100/90 p-1.5 rounded-2xl flex items-center gap-1.5 overflow-x-auto hide-scrollbar border border-slate-200/70">
        <button
          onClick={() => setActiveTab("products")}
          className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-2 shrink-0 ${
            activeTab === "products"
              ? "bg-white text-[#0B2E8C] shadow-sm shadow-slate-300/50"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <PackagePlus className="w-4 h-4" />
          <span>المنتجات ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("categories")}
          className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-2 shrink-0 ${
            activeTab === "categories"
              ? "bg-white text-[#0B2E8C] shadow-sm shadow-slate-300/50"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <FolderPlus className="w-4 h-4" />
          <span>الأقسام والفروع ({categories.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("banners")}
          className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-2 shrink-0 ${
            activeTab === "banners"
              ? "bg-white text-[#0B2E8C] shadow-sm shadow-slate-300/50"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>إعلانات البانر ({slides.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("profile")}
          className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-2 shrink-0 ${
            activeTab === "profile"
              ? "bg-white text-[#0B2E8C] shadow-sm shadow-slate-300/50"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>هوية وشعار المتجر</span>
        </button>
      </div>

      {/* ===================== محتوى التبويب 1: المنتجات ===================== */}
      {activeTab === "products" && (
        <div className="space-y-6">
          {/* بطاقة إضافة منتج جديد */}
          <div className="bg-white rounded-3xl p-6 md:p-7 border border-slate-200/90 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm">
                    ✨
                  </span>
                  نشر منتج جديد في المتجر
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  أدخل تفاصيل وسعر المنتج والصورة ليظهر للزبائن فوراً في متجرك
                </p>
              </div>
            </div>

            {categories.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center space-y-3">
                <p className="text-sm font-bold text-amber-800">
                  ⚠️ لا يمكنك نشر منتجات حالياً لأنه لا يوجد أقسام مضافة في متجرك بعد.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("categories")}
                  className="bg-amber-600 text-white font-bold text-xs px-5 py-2.5 rounded-xl hover:bg-amber-700 transition"
                >
                  الذهاب لإضافة أول قسم الآن ←
                </button>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!prodName.trim()) return alert("يرجى كتابة اسم المنتج");
                  if (!prodPrice.trim()) return alert("يرجى إدخال سعر المنتج");

                  const targetCatId = prodCatId || categories[0]?.id || "";
                  if (!targetCatId) return alert("يرجى اختيار القسم أولاً");

                  setSubmitting(true);
                  try {
                    const fd = new FormData();
                    fd.append("name", prodName);
                    fd.append("price", prodPrice);
                    fd.append("description", prodDesc);
                    fd.append("photoUrl", prodPhoto);
                    fd.append("categoryId", targetCatId);
                    fd.append("branchId", prodBranchId);

                    const res = await addShopStoreProduct(shop.id, fd);
                    if (res.ok) {
                      setProdName("");
                      setProdPrice("");
                      setProdDesc("");
                      setProdPhoto("");
                      router.refresh();
                      alert("تم نشر المنتج في المتجر بنجاح! ✅");
                    } else {
                      alert(res.error || "فشل نشر المنتج");
                    }
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      اسم المنتج *
                    </label>
                    <input
                      type="text"
                      value={prodName}
                      onChange={(e) => setProdName(e.target.value)}
                      placeholder="مثال: بطل ماء، شاي، حليب..."
                      className="w-full text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-right focus:bg-white focus:border-[#0B2E8C] focus:ring-2 focus:ring-blue-100 outline-none transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      السعر (بالدينار العراقي) *
                    </label>
                    <input
                      type="number"
                      value={prodPrice}
                      onChange={(e) => setProdPrice(e.target.value)}
                      placeholder="مثال: 5000"
                      className="w-full text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-right focus:bg-white focus:border-[#0B2E8C] focus:ring-2 focus:ring-blue-100 outline-none transition"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      القسم التابع له المنتج *
                    </label>
                    <select
                      value={prodCatId || categories[0]?.id || ""}
                      onChange={(e) => {
                        setProdCatId(e.target.value);
                        setProdBranchId("");
                      }}
                      className="w-full text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-right focus:bg-white focus:border-[#0B2E8C] outline-none transition cursor-pointer"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          قسم: {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      الفرع داخل القسم (اختياري)
                    </label>
                    <select
                      value={prodBranchId}
                      onChange={(e) => setProdBranchId(e.target.value)}
                      className="w-full text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-right focus:bg-white focus:border-[#0B2E8C] outline-none transition cursor-pointer"
                    >
                      <option value="">بدون فرع (داخل القسم مباشرة)</option>
                      {branches
                        .filter((b) => b.categoryId === (prodCatId || categories[0]?.id))
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            فرع: {b.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* رفع صورة المنتج */}
                <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-700">
                      صورة المنتج
                    </label>
                    <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                      تضغط 90% تلقائياً بصيغة WebP
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-xs relative">
                      {prodPhoto ? (
                        <img src={prodPhoto} alt="Product" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-slate-300" />
                      )}
                    </div>

                    <div className="flex-1">
                      <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 shadow-xs cursor-pointer active:scale-95 transition">
                        <Camera className="w-4 h-4 text-[#0B2E8C]" />
                        <span>{prodPhoto ? "تغيير صورة المنتج" : "اختيار صورة للمنتج"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFileUpload(f, "prod_photo");
                          }}
                          className="hidden"
                        />
                      </label>

                      {uploading === "prod_photo" && (
                        <p className="text-xs text-blue-600 font-bold mt-2 flex items-center gap-1.5 animate-pulse">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>جاري رفع وضغط الصورة بنجاح...</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* وصف المنتج */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    وصف أو تفاصيل إضافية عن المنتج (اختياري)
                  </label>
                  <textarea
                    value={prodDesc}
                    onChange={(e) => setProdDesc(e.target.value)}
                    placeholder="مواصفات، وزن، أو تفاصيل خاصة بالمنتج..."
                    rows={2}
                    className="w-full text-sm font-medium bg-slate-50 border border-slate-200 rounded-xl p-3 text-right focus:bg-white focus:border-[#0B2E8C] outline-none transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm px-8 py-3 rounded-2xl shadow-md shadow-emerald-900/15 transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>نشر المنتج الآن في المتجر</span>
                </button>
              </form>
            )}
          </div>

          {/* قائمة المنتجات الحالية */}
          <div className="bg-white rounded-3xl p-6 md:p-7 border border-slate-200/90 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  قائمة المنتجات الحالية في متجرك ({products.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تصفح المنتجات المنشورة أو احذف أي منتج غير متوفر
                </p>
              </div>
            </div>

            {products.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Store className="w-12 h-12 mx-auto text-slate-300 stroke-[1.5]" />
                <p className="text-sm font-bold">لا توجد منتجات منشورة في متجرك بعد</p>
                <p className="text-xs">استخدم النموذج أعلاه لنشر أول منتج الآن</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                {products.map((p) => {
                  const catName = categories.find((c) => c.id === p.categoryId)?.name || "قسم";
                  const branchName = branches.find((b) => b.id === p.branchId)?.name;
                  return (
                    <div
                      key={p.id}
                      className="border border-slate-200/90 rounded-2xl p-2.5 bg-white hover:border-blue-300 transition-all shadow-xs flex flex-col justify-between group"
                    >
                      <div>
                        <div className="w-full aspect-square rounded-xl bg-slate-50 overflow-hidden mb-2 relative flex items-center justify-center border border-slate-100">
                          {p.photoUrl ? (
                            <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                          ) : (
                            <span className="text-2xl">📦</span>
                          )}
                        </div>
                        <h4 className="font-black text-xs text-slate-900 line-clamp-1">{p.name}</h4>
                        <div className="text-emerald-700 font-black text-xs mt-1">
                          {Number(p.price).toLocaleString()} د.ع
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                          {catName} {branchName ? `• ${branchName}` : ""}
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          if (confirm(`هل أنت متأكد من حذف منتج "${p.name}"؟`)) {
                            await deleteShopStoreProduct(p.id, shop.id);
                            router.refresh();
                          }
                        }}
                        className="mt-2.5 w-full bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-bold py-1.5 rounded-xl transition flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>حذف</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== محتوى التبويب 2: الأقسام والفروع ===================== */}
      {activeTab === "categories" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* إضافة قسم جديد */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <FolderPlus className="w-5 h-5 text-blue-600" />
                  إضافة قسم رئيسي جديد
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  مثل: مياه، منظفات، معلبات، حلويات...
                </p>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newCatName.trim()) return alert("يرجى كتابة اسم القسم");
                  const fd = new FormData();
                  fd.append("name", newCatName);
                  fd.append("photoUrl", newCatPhoto);
                  const res = await addShopStoreCategory(shop.id, fd);
                  if (res.ok) {
                    setNewCatName("");
                    setNewCatPhoto("");
                    router.refresh();
                    alert("تمت إضافة القسم بنجاح! ✅");
                  } else {
                    alert(res.error || "فشل إضافة القسم");
                  }
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم القسم *</label>
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="مثال: مشروبات وعصائر"
                    className="w-full text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right focus:bg-white focus:border-[#0B2E8C] outline-none transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">صورة القسم (اختياري)</label>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                      {newCatPhoto ? (
                        <img src={newCatPhoto} alt="Category" className="w-full h-full object-cover" />
                      ) : (
                        <FolderPlus className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 shadow-xs cursor-pointer active:scale-95 transition">
                        <Camera className="w-3.5 h-3.5 text-[#0B2E8C]" />
                        <span>{newCatPhoto ? "تغيير صورة القسم" : "اختيار صورة"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFileUpload(f, "cat_photo");
                          }}
                          className="hidden"
                        />
                      </label>
                      {uploading === "cat_photo" && (
                        <p className="text-[11px] text-blue-600 font-bold mt-1 animate-pulse">جاري الرفع والضغط...</p>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#0B2E8C] hover:bg-[#082269] text-white font-bold text-xs py-2.5 rounded-xl transition shadow-sm active:scale-95"
                >
                  حفظ وإضافة القسم
                </button>
              </form>
            </div>

            {/* إضافة فرع داخل قسم */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-600" />
                  إضافة فرع داخل قسم
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  لتنظيم المنتجات في فروع داخلية (اختياري)
                </p>
              </div>

              {categories.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">أضف قسماً أولاً لتتمكن من إنشاء فروع بداخله</p>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newBranchName.trim()) return alert("يرجى كتابة اسم الفرع");
                    const targetBranchCatId = newBranchCatId || categories[0]?.id || "";
                    const fd = new FormData();
                    fd.append("categoryId", targetBranchCatId);
                    fd.append("name", newBranchName);
                    fd.append("photoUrl", newBranchPhoto);
                    const res = await addShopStoreBranch(shop.id, fd);
                    if (res.ok) {
                      setNewBranchName("");
                      setNewBranchPhoto("");
                      router.refresh();
                      alert("تمت إضافة الفرع بنجاح! ✅");
                    } else {
                      alert(res.error || "فشل إضافة الفرع");
                    }
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">القسم الرئيسي *</label>
                    <select
                      value={newBranchCatId || categories[0]?.id || ""}
                      onChange={(e) => setNewBranchCatId(e.target.value)}
                      className="w-full text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right focus:bg-white focus:border-[#0B2E8C] outline-none transition cursor-pointer"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          قسم: {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">اسم الفرع *</label>
                    <input
                      type="text"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      placeholder="مثال: مياه غازية، عصائر طبيعية..."
                      className="w-full text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right focus:bg-white focus:border-[#0B2E8C] outline-none transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">صورة الفرع (اختياري)</label>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {newBranchPhoto ? (
                          <img src={newBranchPhoto} alt="Branch" className="w-full h-full object-cover" />
                        ) : (
                          <Layers className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 shadow-xs cursor-pointer active:scale-95 transition">
                          <Camera className="w-3.5 h-3.5 text-[#0B2E8C]" />
                          <span>{newBranchPhoto ? "تغيير صورة الفرع" : "اختيار صورة"}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleFileUpload(f, "branch_photo");
                            }}
                            className="hidden"
                          />
                        </label>
                        {uploading === "branch_photo" && (
                          <p className="text-[11px] text-blue-600 font-bold mt-1 animate-pulse">جاري الرفع والضغط...</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-sm active:scale-95"
                  >
                    إضافة الفرع داخل القسم
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* قائمة الأقسام والفروع الحالية */}
          <div className="bg-white rounded-3xl p-6 md:p-7 border border-slate-200/90 shadow-sm">
            <h3 className="text-base font-black text-slate-900 mb-4">
              الأقسام والفروع المعروضة في متجرك ({categories.length})
            </h3>

            {categories.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">لا توجد أقسام بعد</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {categories.map((cat) => {
                  const catBranches = branches.filter((b) => b.categoryId === cat.id);
                  const catProducts = products.filter((p) => p.categoryId === cat.id);
                  return (
                    <div key={cat.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                            {cat.photoUrl ? (
                              <img src={cat.photoUrl} alt={cat.name} className="w-full h-full object-cover" />
                            ) : (
                              <FolderPlus className="w-6 h-6 text-blue-500" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-black text-slate-900 text-sm">{cat.name}</h4>
                            <p className="text-[11px] text-slate-500">
                              {catProducts.length} منتج • {catBranches.length} فرع
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={async () => {
                            if (confirm(`هل أنت متأكد من حذف قسم "${cat.name}" وجميع منتجاته؟`)) {
                              await deleteShopStoreCategory(cat.id, shop.id);
                              router.refresh();
                            }
                          }}
                          className="text-xs text-rose-600 hover:text-rose-700 font-bold p-1"
                          title="حذف القسم"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* فروع القسم */}
                      {catBranches.length > 0 && (
                        <div className="border-t border-slate-200/80 pt-2 space-y-1.5">
                          <p className="text-[11px] font-bold text-slate-500">الفروع التابعة:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {catBranches.map((b) => (
                              <span
                                key={b.id}
                                className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 shadow-2xs"
                              >
                                {b.name}
                                <button
                                  onClick={async () => {
                                    if (confirm(`حذف فرع "${b.name}"؟`)) {
                                      await deleteShopStoreBranch(b.id, shop.id);
                                      router.refresh();
                                    }
                                  }}
                                  className="text-rose-500 hover:text-rose-700"
                                >
                                  ✕
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== محتوى التبويب 3: إعلانات البانر ===================== */}
      {activeTab === "banners" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 md:p-7 border border-slate-200/90 shadow-sm max-w-xl">
            <div className="border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-purple-600" />
                إضافة إعلان بانر ترويجي لمتجرك
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                تظهر إعلانات البانر في أعلى متجرك لتسليط الضوء على العروض والخصومات
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!slideImage) return alert("يرجى اختيار صورة الإعلان");
                const fd = new FormData();
                fd.append("imageUrl", slideImage);
                fd.append("title", slideTitle);
                const res = await addShopStoreSlide(shop.id, fd);
                if (res.ok) {
                  setSlideImage("");
                  setSlideTitle("");
                  router.refresh();
                  alert("تمت إضافة إعلان البانر بنجاح! ✅");
                } else {
                  alert(res.error || "فشل إضافة الإعلان");
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">صورة الإعلان *</label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-14 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                    {slideImage ? (
                      <img src={slideImage} alt="Banner" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 shadow-xs cursor-pointer active:scale-95 transition">
                      <Camera className="w-4 h-4 text-[#0B2E8C]" />
                      <span>{slideImage ? "تغيير صورة البانر" : "اختيار صورة الإعلان"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFileUpload(f, "slide_image");
                        }}
                        className="hidden"
                      />
                    </label>
                    {uploading === "slide_image" && (
                      <p className="text-xs text-blue-600 font-bold mt-1.5 animate-pulse">جاري الرفع والضغط...</p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">عنوان أو نص الإعلان (اختياري)</label>
                <input
                  type="text"
                  value={slideTitle}
                  onChange={(e) => setSlideTitle(e.target.value)}
                  placeholder="مثال: خصم 15% على جميع المشروبات هذا الأسبوع"
                  className="w-full text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-right focus:bg-white focus:border-[#0B2E8C] outline-none transition"
                />
              </div>

              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-700 text-white font-black text-xs px-6 py-2.5 rounded-xl shadow-sm transition active:scale-95"
              >
                إضافة إعلان البانر
              </button>
            </form>
          </div>

          {/* البانرات الحالية */}
          <div className="bg-white rounded-3xl p-6 md:p-7 border border-slate-200/90 shadow-sm">
            <h3 className="text-base font-black text-slate-900 mb-4">
              إعلانات البانر المعروضة حالياً ({slides.length})
            </h3>
            {slides.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">لا توجد إعلانات بانر مضافة بعد</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {slides.map((slide) => (
                  <div key={slide.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 relative group shadow-xs">
                    <img src={slide.imageUrl} alt="Banner" className="w-full h-36 object-cover" />
                    {slide.title && (
                      <div className="p-2.5 text-xs font-bold text-slate-800 text-center bg-white border-t border-slate-100">
                        {slide.title}
                      </div>
                    )}
                    <button
                      onClick={async () => {
                        if (confirm("حذف هذا الإعلان؟")) {
                          await deleteShopStoreSlide(slide.id, shop.id);
                          router.refresh();
                        }
                      }}
                      className="absolute top-2 left-2 bg-rose-600 text-white px-3 py-1 rounded-xl text-xs font-bold shadow-md hover:bg-rose-700 transition"
                    >
                      حذف 🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== محتوى التبويب 4: هوية وشعار المتجر ===================== */}
      {activeTab === "profile" && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm max-w-2xl overflow-hidden">
          {/* رأس البطاقة */}
          <div className="p-5 md:p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#0B2E8C]" />
                هوية ومظهر المتجر
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                خصص صورة الغلاف والشعار والنبذة التي ستظهر لزبائنك
              </p>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-full">
              معاينة حية
            </span>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData();
              fd.append("storeLogoUrl", storeLogoUrl);
              fd.append("storeBannerUrl", bannerUrl);
              fd.append("bio", bio);
              const res = await updateShopStoreProfile(shop.id, fd);
              if (res.ok) {
                router.refresh();
                alert("تم حفظ إعدادات وهوية المتجر بنجاح! ✅");
              } else {
                alert(res.error || "حدث خطأ أثناء الحفظ");
              }
            }}
            className="p-5 md:p-6 space-y-6"
          >
            {/* بطاقة المعاينة وتغيير الغلاف والشعار */}
            <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
              {/* 1. مساحة الغلاف (Banner) */}
              <div className="relative h-36 sm:h-44 bg-gradient-to-br from-[#0B2E8C] via-indigo-800 to-slate-900 flex items-center justify-center overflow-hidden">
                {bannerUrl ? (
                  <img src={bannerUrl} alt="Store Banner" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center text-white/50 p-4">
                    <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-40" />
                    <p className="text-xs font-medium">لم يتم تعيين صورة غلاف بعد</p>
                  </div>
                )}

                {/* تظليل سفلي ناعم */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

                {/* زر تغيير الغلاف العائم */}
                <div className="absolute top-3 left-3 z-10">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/50 hover:bg-black/70 backdrop-blur-md text-white border border-white/20 text-xs font-bold shadow-md active:scale-95 transition">
                    <Camera className="w-3.5 h-3.5 text-amber-300" />
                    <span>{bannerUrl ? "تغيير الغلاف" : "إضافة غلاف"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f, "shop_banner");
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                {uploading === "shop_banner" && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-white text-xs font-black gap-2 z-20">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                    <span>جاري رفع وضغط الغلاف...</span>
                  </div>
                )}
              </div>

              {/* 2. قسم الشعار المتداخل واسم المحل */}
              <div className="px-5 pb-5 pt-0 relative bg-white">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-14 mb-4">
                  {/* الشعار Avatar */}
                  <div className="flex items-end gap-3.5">
                    <div className="relative group shrink-0">
                      <div className="w-24 h-24 rounded-2xl bg-white border-4 border-white shadow-xl overflow-hidden flex items-center justify-center bg-slate-100">
                        {storeLogoUrl ? (
                          <img src={storeLogoUrl} alt="Store Logo" className="w-full h-full object-cover" />
                        ) : (
                          <Store className="w-10 h-10 text-slate-400" />
                        )}
                      </div>

                      {/* زر كاميرا عائم للشعار */}
                      <label className="absolute -bottom-1.5 -left-1.5 cursor-pointer w-8 h-8 rounded-full bg-[#0B2E8C] hover:bg-blue-700 text-white flex items-center justify-center shadow-lg border-2 border-white active:scale-90 transition">
                        <Camera className="w-4 h-4" />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFileUpload(f, "shop_logo");
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="pb-1">
                      <h4 className="text-base font-black text-slate-900 leading-tight">
                        {shop.name}
                      </h4>
                      <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                        شعار وهوية المتجر الإلكتروني
                      </p>
                    </div>
                  </div>

                  {/* زر رفع اللوغو المخصص */}
                  <div className="sm:pb-1">
                    <label className="cursor-pointer inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0B2E8C] border border-blue-200/80 text-xs font-black shadow-xs active:scale-95 transition">
                      <Camera className="w-4 h-4" />
                      <span>{storeLogoUrl ? "تغيير شعار المتجر" : "رفع شعار جديد"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFileUpload(f, "shop_logo");
                        }}
                        className="hidden"
                      />
                    </label>

                    {uploading === "shop_logo" && (
                      <p className="text-xs text-blue-600 font-bold mt-1.5 flex items-center gap-1 sm:justify-end animate-pulse">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>جاري رفع وضغط الشعار...</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* كرت الملاحظات الذكية */}
                <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 flex items-start gap-2.5 text-slate-600">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <span className="font-black text-slate-800">ملاحظة مهمة:</span> شعار متجرك هنا يظهر للزبائن في أعلى صفحة المتجر وهو منفصل كلياً عن صورة باب المحل. يتم ضغط كل الصور تلقائياً بصيغة WebP بنسبة 90% للحفاظ على السرعة الفائقة.
                  </div>
                </div>
              </div>
            </div>

            {/* 3. حقل النبذة الترحيبية */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                النبذة الترحيبية للزبائن (تظهر تحت اسم المتجر في الصفحة الرئيسية)
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="مثال: مرحباً بكم في متجرنا! نوفر لكم أفضل المنتجات بأعلى جودة وتوصيل سريع ومباشر..."
                rows={3}
                className="w-full text-xs sm:text-sm font-medium bg-slate-50/70 border border-slate-200 rounded-2xl p-3.5 text-right focus:bg-white focus:border-[#0B2E8C] focus:ring-2 focus:ring-blue-100 outline-none transition"
              />
            </div>

            {/* زر الحفظ الرئيسي */}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#0B2E8C] to-[#1e4fd8] hover:from-[#082269] hover:to-[#0B2E8C] text-white font-black text-sm sm:text-base py-3.5 rounded-2xl shadow-lg shadow-blue-950/20 active:scale-98 transition flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5 stroke-[2.5]" />
              <span>حفظ هوية ومظهر المتجر</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
