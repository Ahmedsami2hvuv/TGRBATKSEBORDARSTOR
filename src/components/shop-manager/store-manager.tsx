"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  updateShopStoreProfile,
  addShopStoreCategory,
  deleteShopStoreCategory,
  updateShopStoreCategory,
  toggleShopStoreCategoryActive,
  addShopStoreBranch,
  deleteShopStoreBranch,
  updateShopStoreBranch,
  toggleShopStoreBranchActive,
  addShopStoreProduct,
  deleteShopStoreProduct,
  updateShopStoreProduct,
  toggleShopStoreProductActive,
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
  ChevronDown,
  ChevronUp,
  Tag,
  Eye,
  EyeOff,
  Pencil,
  X,
  Package,
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

  // حالات فتح الأقسام والتعديل المباشر
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(categories[0]?.id || null);
  const [addingBranchForCatId, setAddingBranchForCatId] = useState<string | null>(null);
  const [inlineBranchName, setInlineBranchName] = useState("");
  const [inlineBranchPhoto, setInlineBranchPhoto] = useState("");

  // حالات النوافذ المنبثقة للتعديل
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string; photoUrl: string } | null>(null);
  const [editingBranch, setEditingBranch] = useState<{ id: string; name: string; photoUrl: string; categoryId: string } | null>(null);
  const [editingProduct, setEditingProduct] = useState<{
    id: string;
    name: string;
    price: string;
    description: string;
    photoUrl: string;
    categoryId: string;
    branchId: string | null;
  } | null>(null);

  // مزامنة تلقائية لاختيار القسم الفعال
  useEffect(() => {
    if (categories && categories.length > 0) {
      if (!prodCatId || !categories.some((c) => c.id === prodCatId)) {
        setProdCatId(categories[0].id);
      }
      if (!newBranchCatId || !categories.some((c) => c.id === newBranchCatId)) {
        setNewBranchCatId(categories[0].id);
      }
      if (!selectedCategoryId || !categories.some((c) => c.id === selectedCategoryId)) {
        setSelectedCategoryId(categories[0].id);
      }
    }
  }, [categories, prodCatId, newBranchCatId, selectedCategoryId]);

  // الرابط المباشر الجديد لمتجر المحل
  const targetToken = shop.storeToken || shop.id;
  const storeUrl = typeof window !== "undefined"
    ? `${window.location.origin}/shop/${targetToken}`
    : `https://aboakbr.com/shop/${targetToken}`;

  const shareText = `مرحبا الي سالوني عن متجرنه هذا الرابط مالتنه:\n${storeUrl}`;

  // دالة رفع الصور مع الضغط التلقائي
  async function handleFileUpload(file: File, type: string, onSuccess?: (url: string) => void) {
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
        if (onSuccess) onSuccess(data.url);
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
                    <Sparkles className="w-4 h-4" />
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
                  لا يمكنك نشر منتجات حالياً لأنه لا يوجد أقسام مضافة في متجرك بعد.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("categories")}
                  className="bg-amber-600 text-white font-bold text-xs px-5 py-2.5 rounded-xl hover:bg-amber-700 transition"
                >
                  الذهاب لإضافة أول قسم الآن
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
                      alert("تم نشر المنتج في المتجر بنجاح");
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {products.map((p) => {
                  const catName = categories.find((c) => c.id === p.categoryId)?.name || "قسم";
                  const branchName = branches.find((b) => b.id === p.branchId)?.name;
                  const isVisible = p.active !== false;
                  return (
                    <div
                      key={p.id}
                      className={`border rounded-2xl p-3 bg-white transition-all shadow-xs flex flex-col justify-between ${
                        isVisible ? "border-slate-200/90" : "border-amber-200/90 bg-amber-50/20 opacity-80"
                      }`}
                    >
                      <div>
                        <div className="w-full aspect-square rounded-xl bg-slate-50 overflow-hidden mb-2 relative flex items-center justify-center border border-slate-100">
                          {p.photoUrl ? (
                            <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-8 h-8 text-slate-300" />
                          )}
                          <span
                            className={`absolute top-2 right-2 text-[10px] font-black px-2 py-0.5 rounded-md shadow-xs ${
                              isVisible
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-700 text-white"
                            }`}
                          >
                            {isVisible ? "معروض للزبائن" : "مخفي"}
                          </span>
                        </div>

                        <h4 className="font-black text-sm text-slate-900 line-clamp-1">{p.name}</h4>
                        <div className="text-emerald-700 font-black text-xs mt-1">
                          {Number(p.price).toLocaleString()} د.ع
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                          {catName} {branchName ? `• ${branchName}` : ""}
                        </div>
                      </div>

                      {/* أزرار التحكم بالمنتج: تعديل، إخفاء/إظهار، مسح */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProduct({
                              id: p.id,
                              name: p.name,
                              price: String(p.price),
                              description: p.description || "",
                              photoUrl: p.photoUrl || "",
                              categoryId: p.categoryId,
                              branchId: p.branchId || null,
                            });
                          }}
                          className="bg-blue-50 hover:bg-blue-100 text-[#0B2E8C] text-[11px] font-bold py-1.5 rounded-xl transition flex items-center justify-center gap-1"
                          title="تعديل المنتج"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>تعديل</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            const res = await toggleShopStoreProductActive(p.id, shop.id, !isVisible);
                            if (res.ok) router.refresh();
                            else alert(res.error || "فشل تغيير حالة المنتج");
                          }}
                          className={`text-[11px] font-bold py-1.5 rounded-xl transition flex items-center justify-center gap-1 ${
                            isVisible
                              ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                          }`}
                          title={isVisible ? "إخفاء عن الزبائن" : "إظهار للزبائن"}
                        >
                          {isVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          <span>{isVisible ? "إخفاء" : "إظهار"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm(`هل أنت متأكد من حذف منتج "${p.name}"؟`)) {
                              await deleteShopStoreProduct(p.id, shop.id);
                              router.refresh();
                            }
                          }}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-bold py-1.5 rounded-xl transition flex items-center justify-center gap-1"
                          title="حذف المنتج"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>حذف</span>
                        </button>
                      </div>
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
          {/* إضافة قسم رئيسي جديد فقط (تمت إزالة بلوك إضافة فرع العلوي بناء على طلبك) */}
          <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/90 shadow-sm">
            <div className="border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-blue-600" />
                <span>إضافة قسم رئيسي جديد</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                أضف أقسام متجرك الرئيسية مثل: مياه وعصائر، منظفات، حلويات، معلبات...
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
                  alert("تمت إضافة القسم بنجاح");
                } else {
                  alert(res.error || "فشل إضافة القسم");
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
            >
              <div className="sm:col-span-5">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم القسم *</label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="مثال: مشروبات وعصائر"
                  className="w-full text-xs sm:text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-right focus:bg-white focus:border-[#0B2E8C] outline-none transition"
                  required
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">صورة القسم (اختياري)</label>
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                    {newCatPhoto ? (
                      <img src={newCatPhoto} alt="Category" className="w-full h-full object-cover" />
                    ) : (
                      <FolderPlus className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer transition">
                    <Camera className="w-3.5 h-3.5 text-[#0B2E8C]" />
                    <span>{newCatPhoto ? "تغيير الصورة" : "رفع صورة"}</span>
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
                    <span className="text-[11px] text-blue-600 font-bold animate-pulse">جاري الرفع...</span>
                  )}
                </div>
              </div>

              <div className="sm:col-span-3">
                <button
                  type="submit"
                  className="w-full bg-[#0B2E8C] hover:bg-[#082269] text-white font-black text-xs sm:text-sm py-2.5 rounded-xl shadow-md shadow-blue-950/15 transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>حفظ وإضافة القسم</span>
                </button>
              </div>
            </form>
          </div>

          {/* قائمة الأقسام التفاعلية (النقر على القسم يفتحه ويفتح فروعه ومنتجاته) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  الأقسام المعروضة في متجرك ({categories.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  اضغط على أي قسم لفتح تفاصيله وإدارة فروعه ومنتجاته
                </p>
              </div>
            </div>

            {categories.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 border border-slate-200/90 text-center text-slate-400 space-y-2">
                <FolderPlus className="w-12 h-12 mx-auto text-slate-300 stroke-[1.5]" />
                <p className="text-sm font-bold">لا توجد أقسام في متجرك بعد</p>
                <p className="text-xs">أضف قسماً من النموذج أعلاه لبدء تنظيم المتجر</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {categories.map((cat) => {
                  const isExpanded = selectedCategoryId === cat.id;
                  const catBranches = branches.filter((b) => b.categoryId === cat.id);
                  const catProducts = products.filter((p) => p.categoryId === cat.id);
                  const isCatVisible = cat.active !== false;

                  return (
                    <div
                      key={cat.id}
                      className={`bg-white rounded-2xl md:rounded-3xl border transition-all overflow-hidden ${
                        isExpanded
                          ? "border-[#0B2E8C]/40 shadow-md ring-2 ring-blue-50"
                          : "border-slate-200/90 hover:border-slate-300 shadow-xs"
                      }`}
                    >
                      {/* رأس بطاقة القسم (قابل للنقر لفتح وإغلاق القسم) */}
                      <div
                        onClick={() => setSelectedCategoryId(isExpanded ? null : cat.id)}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 cursor-pointer select-none bg-white hover:bg-slate-50/50 transition"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* صورة القسم */}
                          <div className="w-13 h-13 rounded-2xl bg-slate-50 border border-slate-200/80 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
                            {cat.photoUrl ? (
                              <img src={cat.photoUrl} alt={cat.name} className="w-full h-full object-cover" />
                            ) : (
                              <FolderPlus className="w-6 h-6 text-blue-600" />
                            )}
                          </div>

                          {/* معلومات القسم */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-black text-base text-slate-900 truncate">{cat.name}</h4>
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                  isCatVisible
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                    : "bg-slate-100 text-slate-600 border border-slate-200"
                                }`}
                              >
                                {isCatVisible ? "معروض في المتجر" : "مخفي عن الزبائن"}
                              </span>
                            </div>

                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                              {catBranches.length} فرع • {catProducts.length} منتج
                            </p>
                          </div>
                        </div>

                        {/* أزرار التحكم بالقسم وأيقونة الفتح */}
                        <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 w-full sm:w-auto justify-between sm:justify-end">
                          {/* زر تعديل القسم */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCategory({ id: cat.id, name: cat.name, photoUrl: cat.photoUrl || "" });
                            }}
                            className="bg-blue-50 hover:bg-blue-100 text-[#0B2E8C] px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1"
                            title="تعديل اسم وصورة القسم"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>تعديل</span>
                          </button>

                          {/* زر إخفاء وإظهار القسم */}
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const res = await toggleShopStoreCategoryActive(cat.id, shop.id, !isCatVisible);
                              if (res.ok) router.refresh();
                              else alert(res.error || "فشل تغيير حالة القسم");
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                              isCatVisible
                                ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                            }`}
                            title={isCatVisible ? "إخفاء القسم عن الزبائن" : "إظهار القسم للزبائن"}
                          >
                            {isCatVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            <span>{isCatVisible ? "إخفاء" : "إظهار"}</span>
                          </button>

                          {/* زر حذف القسم */}
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm(`هل أنت متأكد من حذف قسم "${cat.name}" وجميع فروعه ومنتجاته؟`)) {
                                await deleteShopStoreCategory(cat.id, shop.id);
                                router.refresh();
                              }
                            }}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-2 rounded-xl transition"
                            title="حذف القسم"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          {/* مؤشر الفتح والإغلاق */}
                          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 mr-1">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>
                      </div>

                      {/* المحتوى الداخلي المنسدل للقسم (فروعه ومنتجاته) */}
                      {isExpanded && (
                        <div className="border-t border-slate-200/80 bg-slate-50/60 p-4 md:p-6 space-y-6">
                          {/* 1. فروع القسم */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div>
                                <h5 className="font-black text-sm text-slate-900 flex items-center gap-2">
                                  <Layers className="w-4 h-4 text-indigo-600" />
                                  <span>فروع قسم {cat.name} ({catBranches.length})</span>
                                </h5>
                                <p className="text-[11px] text-slate-500">
                                  الفروع الداخلية لتصنيف المنتجات داخل هذا القسم
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  if (addingBranchForCatId === cat.id) {
                                    setAddingBranchForCatId(null);
                                  } else {
                                    setAddingBranchForCatId(cat.id);
                                    setInlineBranchName("");
                                    setInlineBranchPhoto("");
                                  }
                                }}
                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 active:scale-95 shadow-2xs"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>{addingBranchForCatId === cat.id ? "إغلاق النموذج" : "إضافة فرع داخل هذا القسم"}</span>
                              </button>
                            </div>

                            {/* نموذج إضافة فرع جديد مدمج داخل القسم */}
                            {addingBranchForCatId === cat.id && (
                              <div className="bg-white rounded-2xl p-4 border border-indigo-200/80 shadow-xs space-y-3">
                                <h6 className="font-black text-xs text-indigo-900">
                                  إضافة فرع جديد يتبع قسم: {cat.name}
                                </h6>
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                                  <div className="sm:col-span-5">
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم الفرع *</label>
                                    <input
                                      type="text"
                                      value={inlineBranchName}
                                      onChange={(e) => setInlineBranchName(e.target.value)}
                                      placeholder="مثال: مياه معدنية، مشروبات طاقة..."
                                      className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right focus:bg-white focus:border-indigo-600 outline-none transition"
                                    />
                                  </div>

                                  <div className="sm:col-span-4">
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">صورة الفرع (اختياري)</label>
                                    <div className="flex items-center gap-2">
                                      <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                        {inlineBranchPhoto ? (
                                          <img src={inlineBranchPhoto} alt="Branch" className="w-full h-full object-cover" />
                                        ) : (
                                          <Layers className="w-4 h-4 text-slate-400" />
                                        )}
                                      </div>
                                      <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer transition">
                                        <Camera className="w-3.5 h-3.5 text-indigo-600" />
                                        <span>{inlineBranchPhoto ? "تغيير" : "صورة"}</span>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            if (f) handleFileUpload(f, "inline_branch", (url) => setInlineBranchPhoto(url));
                                          }}
                                          className="hidden"
                                        />
                                      </label>
                                    </div>
                                  </div>

                                  <div className="sm:col-span-3 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (!inlineBranchName.trim()) return alert("يرجى كتابة اسم الفرع");
                                        const fd = new FormData();
                                        fd.append("categoryId", cat.id);
                                        fd.append("name", inlineBranchName);
                                        fd.append("photoUrl", inlineBranchPhoto);
                                        const res = await addShopStoreBranch(shop.id, fd);
                                        if (res.ok) {
                                          setInlineBranchName("");
                                          setInlineBranchPhoto("");
                                          setAddingBranchForCatId(null);
                                          router.refresh();
                                          alert("تمت إضافة الفرع بنجاح");
                                        } else {
                                          alert(res.error || "فشل إضافة الفرع");
                                        }
                                      }}
                                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs py-2 rounded-xl transition shadow-xs"
                                    >
                                      حفظ الفرع
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setAddingBranchForCatId(null)}
                                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl"
                                    >
                                      إلغاء
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* بطاقات الفروع الخاصة بالقسم */}
                            {catBranches.length === 0 ? (
                              <p className="text-xs text-slate-400 py-3 text-center bg-white/60 rounded-xl border border-slate-200/60">
                                لا توجد فروع داخل هذا القسم بعد. يمكنك إضافة فروع لتصنيف المنتجات أو نشر المنتجات في القسم مباشرة.
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                {catBranches.map((b) => {
                                  const isBranchVisible = b.active !== false;
                                  const branchProducts = products.filter((p) => p.branchId === b.id);
                                  return (
                                    <div
                                      key={b.id}
                                      className={`p-3 rounded-2xl bg-white border transition-all flex items-center justify-between gap-2.5 shadow-2xs ${
                                        isBranchVisible ? "border-slate-200" : "border-amber-200 bg-amber-50/20 opacity-80"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                          {b.photoUrl ? (
                                            <img src={b.photoUrl} alt={b.name} className="w-full h-full object-cover" />
                                          ) : (
                                            <Layers className="w-4 h-4 text-indigo-500" />
                                          )}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="font-black text-xs text-slate-900 truncate">{b.name}</div>
                                          <div className="text-[10px] text-slate-500">
                                            {branchProducts.length} منتج •{" "}
                                            <span className={isBranchVisible ? "text-emerald-600 font-bold" : "text-slate-500"}>
                                              {isBranchVisible ? "ظاهر" : "مخفي"}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* أزرار الفرع: تعديل، إخفاء/إظهار، مسح */}
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => setEditingBranch({ id: b.id, name: b.name, photoUrl: b.photoUrl || "", categoryId: b.categoryId })}
                                          className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#0B2E8C] transition"
                                          title="تعديل الفرع"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={async () => {
                                            const res = await toggleShopStoreBranchActive(b.id, shop.id, !isBranchVisible);
                                            if (res.ok) router.refresh();
                                            else alert(res.error || "فشل تغيير حالة الفرع");
                                          }}
                                          className={`p-1.5 rounded-lg transition ${
                                            isBranchVisible
                                              ? "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                                          }`}
                                          title={isBranchVisible ? "إخفاء الفرع عن الزبائن" : "إظهار الفرع للزبائن"}
                                        >
                                          {isBranchVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                        </button>

                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (confirm(`هل أنت متأكد من حذف فرع "${b.name}"؟`)) {
                                              await deleteShopStoreBranch(b.id, shop.id);
                                              router.refresh();
                                            }
                                          }}
                                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition"
                                          title="حذف الفرع"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* 2. منتجات هذا القسم */}
                          <div className="space-y-3 pt-3 border-t border-slate-200/80">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div>
                                <h5 className="font-black text-sm text-slate-900 flex items-center gap-2">
                                  <Package className="w-4 h-4 text-emerald-600" />
                                  <span>منتجات قسم {cat.name} ({catProducts.length})</span>
                                </h5>
                                <p className="text-[11px] text-slate-500">
                                  المنتجات المعروضة التابعة لهذا القسم وأفرعه
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setProdCatId(cat.id);
                                  setActiveTab("products");
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 active:scale-95 shadow-2xs"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>إضافة منتج لهذا القسم</span>
                              </button>
                            </div>

                            {catProducts.length === 0 ? (
                              <p className="text-xs text-slate-400 py-4 text-center bg-white/60 rounded-xl border border-slate-200/60">
                                لا توجد منتجات منشورة داخل هذا القسم بعد. اضغط على "إضافة منتج لهذا القسم" لإضافة أول منتج.
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {catProducts.map((p) => {
                                  const isProductVisible = p.active !== false;
                                  const branchName = branches.find((b) => b.id === p.branchId)?.name;
                                  return (
                                    <div
                                      key={p.id}
                                      className={`p-3 rounded-2xl bg-white border transition-all flex flex-col justify-between shadow-xs ${
                                        isProductVisible ? "border-slate-200" : "border-amber-200 bg-amber-50/20 opacity-80"
                                      }`}
                                    >
                                      <div>
                                        <div className="w-full aspect-square rounded-xl bg-slate-50 overflow-hidden mb-2 relative flex items-center justify-center border border-slate-100">
                                          {p.photoUrl ? (
                                            <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />
                                          ) : (
                                            <Package className="w-7 h-7 text-slate-300" />
                                          )}
                                          <span
                                            className={`absolute top-2 right-2 text-[10px] font-black px-2 py-0.5 rounded-md ${
                                              isProductVisible ? "bg-emerald-600 text-white" : "bg-slate-700 text-white"
                                            }`}
                                          >
                                            {isProductVisible ? "معروض" : "مخفي"}
                                          </span>
                                        </div>

                                        <h6 className="font-black text-xs text-slate-900 line-clamp-1">{p.name}</h6>
                                        <div className="text-emerald-700 font-black text-xs mt-0.5">
                                          {Number(p.price).toLocaleString()} د.ع
                                        </div>
                                        {branchName && (
                                          <div className="text-[10px] text-slate-500 font-bold truncate mt-0.5">
                                            فرع: {branchName}
                                          </div>
                                        )}
                                      </div>

                                      {/* أزرار المنتج: تعديل، إخفاء/إظهار، مسح */}
                                      <div className="mt-3 pt-2 border-t border-slate-100 grid grid-cols-3 gap-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingProduct({
                                              id: p.id,
                                              name: p.name,
                                              price: String(p.price),
                                              description: p.description || "",
                                              photoUrl: p.photoUrl || "",
                                              categoryId: p.categoryId,
                                              branchId: p.branchId || null,
                                            });
                                          }}
                                          className="bg-blue-50 hover:bg-blue-100 text-[#0B2E8C] text-[11px] font-bold py-1.5 rounded-xl transition flex items-center justify-center gap-1"
                                          title="تعديل المنتج"
                                        >
                                          <Pencil className="w-3 h-3" />
                                          <span>تعديل</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={async () => {
                                            const res = await toggleShopStoreProductActive(p.id, shop.id, !isProductVisible);
                                            if (res.ok) router.refresh();
                                            else alert(res.error || "فشل تغيير حالة المنتج");
                                          }}
                                          className={`text-[11px] font-bold py-1.5 rounded-xl transition flex items-center justify-center gap-1 ${
                                            isProductVisible
                                              ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                                              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                                          }`}
                                          title={isProductVisible ? "إخفاء عن الزبائن" : "إظهار للزبائن"}
                                        >
                                          {isProductVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                          <span>{isProductVisible ? "إخفاء" : "إظهار"}</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (confirm(`هل أنت متأكد من حذف منتج "${p.name}"؟`)) {
                                              await deleteShopStoreProduct(p.id, shop.id);
                                              router.refresh();
                                            }
                                          }}
                                          className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-bold py-1.5 rounded-xl transition flex items-center justify-center gap-1"
                                          title="حذف المنتج"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                          <span>حذف</span>
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
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
                  alert("تمت إضافة إعلان البانر بنجاح");
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
                      حذف
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
                alert("تم حفظ إعدادات وهوية المتجر بنجاح");
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

      {/* ===================== نافذة منبثقة: تعديل القسم ===================== */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-black text-base text-slate-900 flex items-center gap-2">
                <Pencil className="w-4 h-4 text-[#0B2E8C]" />
                <span>تعديل بيانات القسم</span>
              </h4>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editingCategory.name.trim()) return alert("اسم القسم مطلوب");
                const fd = new FormData();
                fd.append("name", editingCategory.name);
                fd.append("photoUrl", editingCategory.photoUrl);
                const res = await updateShopStoreCategory(editingCategory.id, shop.id, fd);
                if (res.ok) {
                  setEditingCategory(null);
                  router.refresh();
                  alert("تم تحديث القسم بنجاح");
                } else {
                  alert(res.error || "فشل تحديث القسم");
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم القسم *</label>
                <input
                  type="text"
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  className="w-full text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-right focus:bg-white focus:border-[#0B2E8C] outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">صورة القسم</label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                    {editingCategory.photoUrl ? (
                      <img src={editingCategory.photoUrl} alt="Category" className="w-full h-full object-cover" />
                    ) : (
                      <FolderPlus className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer transition">
                      <Camera className="w-4 h-4 text-[#0B2E8C]" />
                      <span>{editingCategory.photoUrl ? "تغيير الصورة" : "رفع صورة"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFileUpload(f, "edit_cat", (url) => setEditingCategory({ ...editingCategory, photoUrl: url }));
                        }}
                        className="hidden"
                      />
                    </label>
                    {uploading === "edit_cat" && (
                      <p className="text-xs text-blue-600 font-bold mt-1 animate-pulse">جاري الرفع والضغط...</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#0B2E8C] hover:bg-[#082269] text-white font-black text-sm py-2.5 rounded-xl transition shadow-xs active:scale-95"
                >
                  حفظ التعديلات
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== نافذة منبثقة: تعديل الفرع ===================== */}
      {editingBranch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-black text-base text-slate-900 flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-600" />
                <span>تعديل بيانات الفرع</span>
              </h4>
              <button
                type="button"
                onClick={() => setEditingBranch(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editingBranch.name.trim()) return alert("اسم الفرع مطلوب");
                const fd = new FormData();
                fd.append("name", editingBranch.name);
                fd.append("categoryId", editingBranch.categoryId);
                fd.append("photoUrl", editingBranch.photoUrl);
                const res = await updateShopStoreBranch(editingBranch.id, shop.id, fd);
                if (res.ok) {
                  setEditingBranch(null);
                  router.refresh();
                  alert("تم تحديث الفرع بنجاح");
                } else {
                  alert(res.error || "فشل تحديث الفرع");
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">القسم التابع له *</label>
                <select
                  value={editingBranch.categoryId}
                  onChange={(e) => setEditingBranch({ ...editingBranch, categoryId: e.target.value })}
                  className="w-full text-xs sm:text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-right focus:bg-white focus:border-[#0B2E8C] outline-none transition cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      قسم: {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم الفرع *</label>
                <input
                  type="text"
                  value={editingBranch.name}
                  onChange={(e) => setEditingBranch({ ...editingBranch, name: e.target.value })}
                  className="w-full text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-right focus:bg-white focus:border-indigo-600 outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">صورة الفرع</label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                    {editingBranch.photoUrl ? (
                      <img src={editingBranch.photoUrl} alt="Branch" className="w-full h-full object-cover" />
                    ) : (
                      <Layers className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer transition">
                      <Camera className="w-4 h-4 text-indigo-600" />
                      <span>{editingBranch.photoUrl ? "تغيير الصورة" : "رفع صورة"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFileUpload(f, "edit_branch", (url) => setEditingBranch({ ...editingBranch, photoUrl: url }));
                        }}
                        className="hidden"
                      />
                    </label>
                    {uploading === "edit_branch" && (
                      <p className="text-xs text-blue-600 font-bold mt-1 animate-pulse">جاري الرفع والضغط...</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm py-2.5 rounded-xl transition shadow-xs active:scale-95"
                >
                  حفظ التعديلات
                </button>
                <button
                  type="button"
                  onClick={() => setEditingBranch(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== نافذة منبثقة: تعديل المنتج ===================== */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-black text-base text-slate-900 flex items-center gap-2">
                <Pencil className="w-4 h-4 text-emerald-600" />
                <span>تعديل بيانات المنتج</span>
              </h4>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editingProduct.name.trim()) return alert("اسم المنتج مطلوب");
                if (!editingProduct.price || isNaN(Number(editingProduct.price))) return alert("السعر غير صحيح");
                const fd = new FormData();
                fd.append("name", editingProduct.name);
                fd.append("price", editingProduct.price);
                fd.append("description", editingProduct.description);
                fd.append("photoUrl", editingProduct.photoUrl);
                fd.append("categoryId", editingProduct.categoryId);
                if (editingProduct.branchId) fd.append("branchId", editingProduct.branchId);
                const res = await updateShopStoreProduct(editingProduct.id, shop.id, fd);
                if (res.ok) {
                  setEditingProduct(null);
                  router.refresh();
                  alert("تم تحديث المنتج بنجاح");
                } else {
                  alert(res.error || "فشل تحديث المنتج");
                }
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المنتج *</label>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-right focus:bg-white focus:border-emerald-600 outline-none transition"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">السعر بالدينار العراقي *</label>
                  <input
                    type="number"
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })}
                    className="w-full text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-right focus:bg-white focus:border-emerald-600 outline-none transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">القسم *</label>
                  <select
                    value={editingProduct.categoryId}
                    onChange={(e) => setEditingProduct({ ...editingProduct, categoryId: e.target.value, branchId: null })}
                    className="w-full text-xs sm:text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-right focus:bg-white focus:border-emerald-600 outline-none transition cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        قسم: {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* اختيار الفرع التابع للقسم */}
              {branches.filter((b) => b.categoryId === editingProduct.categoryId).length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الفرع داخل القسم (اختياري)</label>
                  <select
                    value={editingProduct.branchId || ""}
                    onChange={(e) => setEditingProduct({ ...editingProduct, branchId: e.target.value || null })}
                    className="w-full text-xs sm:text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-right focus:bg-white focus:border-emerald-600 outline-none transition cursor-pointer"
                  >
                    <option value="">بدون فرع (يتبع القسم مباشرة)</option>
                    {branches
                      .filter((b) => b.categoryId === editingProduct.categoryId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          فرع: {b.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">وصف المنتج (اختياري)</label>
                <textarea
                  value={editingProduct.description}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  rows={2}
                  className="w-full text-xs sm:text-sm font-medium bg-slate-50 border border-slate-200 rounded-xl p-3 text-right focus:bg-white focus:border-emerald-600 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">صورة المنتج</label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                    {editingProduct.photoUrl ? (
                      <img src={editingProduct.photoUrl} alt="Product" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer transition">
                      <Camera className="w-4 h-4 text-emerald-600" />
                      <span>{editingProduct.photoUrl ? "تغيير الصورة" : "رفع صورة"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFileUpload(f, "edit_prod", (url) => setEditingProduct({ ...editingProduct, photoUrl: url }));
                        }}
                        className="hidden"
                      />
                    </label>
                    {uploading === "edit_prod" && (
                      <p className="text-xs text-blue-600 font-bold mt-1 animate-pulse">جاري الرفع والضغط...</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm py-2.5 rounded-xl transition shadow-xs active:scale-95"
                >
                  حفظ التعديلات
                </button>
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
