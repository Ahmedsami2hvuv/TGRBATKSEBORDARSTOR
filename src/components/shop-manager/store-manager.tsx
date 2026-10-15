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
  ArrowRight,
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

  // حالات نوافذ الإضافة المنبثقة (أزرار بدلاً من بلوكات كاملة في الشاشة)
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isAddSlideOpen, setIsAddSlideOpen] = useState(false);
  const [addBranchTarget, setAddBranchTarget] = useState<{ categoryId: string; categoryName: string } | null>(null);
  const [newModalBranchName, setNewModalBranchName] = useState("");
  const [newModalBranchPhoto, setNewModalBranchPhoto] = useState("");

  // حالة القسم المفتوح لعرض صفحته المستقلة
  const [selectedCategoryDetailId, setSelectedCategoryDetailId] = useState<string | null>(null);

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
      if (selectedCategoryDetailId && !categories.some((c) => c.id === selectedCategoryDetailId)) {
        setSelectedCategoryDetailId(null);
      }
    }
  }, [categories, prodCatId, newBranchCatId, selectedCategoryDetailId]);

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
        if (type === "modal_branch_photo") setNewModalBranchPhoto(data.url);
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

      {/* شريط التبويبات الرئيسي المنظم */}
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
          {/* قائمة المنتجات الحالية */}
          <div className="bg-white rounded-3xl p-6 md:p-7 border border-slate-200/90 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5 gap-3 flex-wrap">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  قائمة المنتجات الحالية في متجرك ({products.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تصفح المنتجات المنشورة أو عدل أو احذف أي منتج
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddProductOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md shadow-emerald-950/15 transition active:scale-95 flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة منتج جديد</span>
              </button>
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
          {!selectedCategoryDetailId ? (
            /* 1. صفحة استعراض الأقسام الرئيسية فقط بدون أي تداخل */
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    أقسام المتجر الرئيسية ({categories.length})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    اضغط على أي قسم للدخول إلى صفحته وإدارة فروعه ومنتجاته
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setNewCatName("");
                    setNewCatPhoto("");
                    setIsAddCategoryOpen(true);
                  }}
                  className="bg-[#0B2E8C] hover:bg-[#082269] text-white px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-blue-950/15 transition active:scale-95 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة قسم جديد</span>
                </button>
              </div>

              {categories.length === 0 ? (
                <div className="bg-white rounded-3xl p-10 border border-slate-200/90 text-center text-slate-400 space-y-2">
                  <FolderPlus className="w-12 h-12 mx-auto text-slate-300 stroke-[1.5]" />
                  <p className="text-sm font-bold">لا توجد أقسام في متجرك بعد</p>
                  <p className="text-xs">اضغط على "إضافة قسم جديد" بالأعلى لإنشاء أول قسم</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.map((cat) => {
                    const catBranches = branches.filter((b) => b.categoryId === cat.id);
                    const catProducts = products.filter((p) => p.categoryId === cat.id);
                    const isCatVisible = cat.active !== false;

                    return (
                      <div
                        key={cat.id}
                        className="bg-white rounded-3xl border border-slate-200/90 hover:border-blue-400 hover:shadow-md transition p-5 flex flex-col justify-between space-y-4"
                      >
                        {/* معلومات القسم الرئيسية */}
                        <div className="flex items-center gap-3.5">
                          <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200/80 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
                            {cat.photoUrl ? (
                              <img src={cat.photoUrl} alt={cat.name} className="w-full h-full object-cover" />
                            ) : (
                              <FolderPlus className="w-6 h-6 text-blue-600" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-black text-base text-slate-900 truncate">{cat.name}</h4>
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                  isCatVisible
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                    : "bg-slate-100 text-slate-600 border border-slate-200"
                                }`}
                              >
                                {isCatVisible ? "معروض" : "مخفي"}
                              </span>
                            </div>

                            <p className="text-xs text-slate-500 font-medium mt-1">
                              {catBranches.length} فرع • {catProducts.length} منتج
                            </p>
                          </div>
                        </div>

                        {/* زر الدخول لصفحة القسم وفروعه المستقلة */}
                        <button
                          type="button"
                          onClick={() => setSelectedCategoryDetailId(cat.id)}
                          className="w-full bg-blue-50/80 hover:bg-[#0B2E8C] text-[#0B2E8C] hover:text-white py-2.5 px-4 rounded-xl font-black text-xs sm:text-sm transition flex items-center justify-between group active:scale-98"
                        >
                          <span>فتح صفحة القسم وإدارة تفاصيله</span>
                          <ChevronLeft className="w-4 h-4 text-blue-600 group-hover:text-white transition-transform group-hover:-translate-x-1" />
                        </button>

                        {/* أزرار إدارة القسم: تعديل، إخفاء/إظهار، حذف */}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingCategory({ id: cat.id, name: cat.name, photoUrl: cat.photoUrl || "" })}
                            className="flex-1 bg-slate-50 hover:bg-blue-50 text-[#0B2E8C] py-1.5 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                            title="تعديل اسم وصورة القسم"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>تعديل</span>
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              const res = await toggleShopStoreCategoryActive(cat.id, shop.id, !isCatVisible);
                              if (res.ok) router.refresh();
                              else alert(res.error || "فشل تغيير حالة القسم");
                            }}
                            className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                              isCatVisible
                                ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                            }`}
                            title={isCatVisible ? "إخفاء القسم عن الزبائن" : "إظهار القسم للزبائن"}
                          >
                            {isCatVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            <span>{isCatVisible ? "إخفاء" : "إظهار"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
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
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* 2. صفحة القسم المستقلة المخصصة للفروع والمنتجات بدون أي هوسة */
            (() => {
              const currentCat = categories.find((c) => c.id === selectedCategoryDetailId);
              if (!currentCat) {
                return (
                  <div className="bg-white rounded-3xl p-8 text-center space-y-3">
                    <p className="text-sm font-bold text-slate-600">القسم غير موجود أو تم حذفه</p>
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryDetailId(null)}
                      className="bg-[#0B2E8C] text-white px-4 py-2 rounded-xl font-bold text-xs"
                    >
                      العودة للأقسام
                    </button>
                  </div>
                );
              }

              const catBranches = branches.filter((b) => b.categoryId === currentCat.id);
              const catProducts = products.filter((p) => p.categoryId === currentCat.id);
              const isCatVisible = currentCat.active !== false;

              return (
                <div className="space-y-6">
                  {/* شريط التنقل العلوي وزر العودة لجميع الأقسام */}
                  <div className="flex items-center justify-between gap-3 flex-wrap bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryDetailId(null)}
                      className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-xl font-black text-xs sm:text-sm transition active:scale-95"
                    >
                      <ArrowRight className="w-4 h-4 text-[#0B2E8C]" />
                      <span>العودة لجميع الأقسام</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-bold">صفحة إدارة قسم:</span>
                      <span className="text-sm font-black text-[#0B2E8C] bg-blue-50 px-3 py-1 rounded-xl border border-blue-100">
                        {currentCat.name}
                      </span>
                    </div>
                  </div>

                  {/* بطاقة معلومات القسم مع أزرار التحكم */}
                  <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                        {currentCat.photoUrl ? (
                          <img src={currentCat.photoUrl} alt={currentCat.name} className="w-full h-full object-cover" />
                        ) : (
                          <FolderPlus className="w-8 h-8 text-blue-600" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h2 className="text-lg md:text-xl font-black text-slate-900">{currentCat.name}</h2>
                          <span
                            className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                              isCatVisible
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {isCatVisible ? "معروض في متجرك" : "مخفي عن الزبائن"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                          يحتوي هذا القسم على {catBranches.length} فرع و {catProducts.length} منتج
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setEditingCategory({ id: currentCat.id, name: currentCat.name, photoUrl: currentCat.photoUrl || "" })}
                        className="bg-blue-50 hover:bg-blue-100 text-[#0B2E8C] px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>تعديل القسم</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const res = await toggleShopStoreCategoryActive(currentCat.id, shop.id, !isCatVisible);
                          if (res.ok) router.refresh();
                          else alert(res.error || "فشل تغيير حالة القسم");
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                          isCatVisible
                            ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                            : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {isCatVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{isCatVisible ? "إخفاء القسم" : "إظهار القسم"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm(`هل أنت متأكد من حذف قسم "${currentCat.name}"؟`)) {
                            await deleteShopStoreCategory(currentCat.id, shop.id);
                            setSelectedCategoryDetailId(null);
                            router.refresh();
                          }
                        }}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-2.5 rounded-xl transition"
                        title="حذف القسم"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 1. فروع القسم المستقلة */}
                  <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/90 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3 flex-wrap">
                      <div>
                        <h4 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2">
                          <Layers className="w-4 h-4 text-indigo-600" />
                          <span>فروع قسم {currentCat.name} ({catBranches.length})</span>
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          الفروع لتصنيف وترتيب المنتجات داخل هذا القسم
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setNewModalBranchName("");
                          setNewModalBranchPhoto("");
                          setAddBranchTarget({ categoryId: currentCat.id, categoryName: currentCat.name });
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 active:scale-95 shadow-xs shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة فرع جديد</span>
                      </button>
                    </div>

                    {catBranches.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 bg-slate-50/60 rounded-2xl border border-slate-200/60 space-y-1">
                        <Layers className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
                        <p className="text-xs font-bold text-slate-600">لا توجد فروع داخل هذا القسم بعد</p>
                        <p className="text-[11px] text-slate-400">يمكنك إضافة فروع أو نشر المنتجات في القسم مباشرة</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {catBranches.map((b) => {
                          const isBranchVisible = b.active !== false;
                          const branchProducts = products.filter((p) => p.branchId === b.id);
                          return (
                            <div
                              key={b.id}
                              className={`p-3.5 rounded-2xl bg-white border transition-all flex items-center justify-between gap-2.5 shadow-2xs ${
                                isBranchVisible ? "border-slate-200" : "border-amber-200 bg-amber-50/20 opacity-80"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                  {b.photoUrl ? (
                                    <img src={b.photoUrl} alt={b.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <Layers className="w-4 h-4 text-indigo-500" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-black text-xs sm:text-sm text-slate-900 truncate">{b.name}</div>
                                  <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                                    {branchProducts.length} منتج •{" "}
                                    <span className={isBranchVisible ? "text-emerald-600 font-bold" : "text-slate-500"}>
                                      {isBranchVisible ? "معروض" : "مخفي"}
                                    </span>
                                  </div>
                                </div>
                              </div>

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
                                  title={isBranchVisible ? "إخفاء الفرع" : "إظهار الفرع"}
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

                  {/* 2. منتجات القسم المستقلة */}
                  <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/90 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3 flex-wrap">
                      <div>
                        <h4 className="font-black text-sm sm:text-base text-slate-900 flex items-center gap-2">
                          <Package className="w-4 h-4 text-emerald-600" />
                          <span>منتجات قسم {currentCat.name} ({catProducts.length})</span>
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          المنتجات المعروضة التابعة لهذا القسم
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setProdCatId(currentCat.id);
                          setProdBranchId("");
                          setIsAddProductOpen(true);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 active:scale-95 shadow-xs shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة منتج لهذا القسم</span>
                      </button>
                    </div>

                    {catProducts.length === 0 ? (
                      <div className="py-10 text-center text-slate-400 bg-slate-50/60 rounded-2xl border border-slate-200/60 space-y-2">
                        <Package className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5]" />
                        <p className="text-sm font-bold text-slate-700">لا توجد منتجات منشورة في هذا القسم بعد</p>
                        <button
                          type="button"
                          onClick={() => {
                            setProdCatId(currentCat.id);
                            setProdBranchId("");
                            setIsAddProductOpen(true);
                          }}
                          className="bg-emerald-600 text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-emerald-700 transition"
                        >
                          إضافة أول منتج لهذا القسم
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
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

                                <h6 className="font-black text-xs sm:text-sm text-slate-900 line-clamp-1">{p.name}</h6>
                                <div className="text-emerald-700 font-black text-xs mt-1">
                                  {Number(p.price).toLocaleString()} د.ع
                                </div>
                                {branchName && (
                                  <div className="text-[10px] text-slate-500 font-bold truncate mt-0.5">
                                    فرع: {branchName}
                                  </div>
                                )}
                              </div>

                              {/* أزرار المنتج: تعديل، إخفاء/إظهار، حذف */}
                              <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-3 gap-1">
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
                                  title={isProductVisible ? "إخفاء المنتج" : "إظهار المنتج"}
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
              );
            })()
          )}
        </div>
      )}

      {/* ===================== محتوى التبويب 3: إعلانات البانر ===================== */}
      {activeTab === "banners" && (
        <div className="space-y-6">
          {/* البانرات الحالية */}
          <div className="bg-white rounded-3xl p-6 md:p-7 border border-slate-200/90 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5 gap-3 flex-wrap">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  إعلانات البانر المعروضة حالياً ({slides.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تظهر إعلانات البانر الترويجية في أعلى متجرك لتسليط الضوء على العروض
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSlideImage("");
                  setSlideTitle("");
                  setIsAddSlideOpen(true);
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white font-black text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md shadow-purple-950/15 transition active:scale-95 flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة إعلان بانر جديد</span>
              </button>
            </div>
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

      {/* ===================== نافذة منبثقة: إضافة منتج جديد ===================== */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-black text-base text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>إضافة منتج جديد لمتجرك</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsAddProductOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {categories.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center space-y-3">
                <p className="text-sm font-bold text-amber-800">
                  لا يمكنك إضافة منتج حالياً لأنه لا توجد أقسام في متجرك بعد.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddProductOpen(false);
                    setActiveTab("categories");
                  }}
                  className="bg-amber-600 text-white font-bold text-xs px-5 py-2.5 rounded-xl hover:bg-amber-700 transition"
                >
                  الذهاب لإضافة قسم الآن
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
                      setIsAddProductOpen(false);
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم المنتج *</label>
                    <input
                      type="text"
                      value={prodName}
                      onChange={(e) => setProdName(e.target.value)}
                      placeholder="مثال: بطل ماء، حليب، شاي..."
                      className="w-full text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-right focus:bg-white focus:border-emerald-600 outline-none transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">السعر (دينار عراقي) *</label>
                    <input
                      type="number"
                      value={prodPrice}
                      onChange={(e) => setProdPrice(e.target.value)}
                      placeholder="مثال: 5000"
                      className="w-full text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-right focus:bg-white focus:border-emerald-600 outline-none transition"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">القسم *</label>
                    <select
                      value={prodCatId || categories[0]?.id || ""}
                      onChange={(e) => {
                        setProdCatId(e.target.value);
                        setProdBranchId("");
                      }}
                      className="w-full text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-right focus:bg-white focus:border-emerald-600 outline-none transition cursor-pointer"
                      required
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">الفرع (اختياري)</label>
                    <select
                      value={prodBranchId}
                      onChange={(e) => setProdBranchId(e.target.value)}
                      className="w-full text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-right focus:bg-white focus:border-emerald-600 outline-none transition cursor-pointer"
                    >
                      <option value="">بدون فرع (داخل القسم مباشرة)</option>
                      {branches
                        .filter((b) => b.categoryId === (prodCatId || categories[0]?.id))
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">وصف أو تفاصيل إضافية (اختياري)</label>
                  <textarea
                    value={prodDesc}
                    onChange={(e) => setProdDesc(e.target.value)}
                    placeholder="مواصفات، وزن، أو تفاصيل خاصة..."
                    rows={2}
                    className="w-full text-sm font-medium bg-slate-50 border border-slate-200 rounded-xl p-3 text-right focus:bg-white focus:border-emerald-600 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">صورة المنتج (اختياري)</label>
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                      {prodPhoto ? (
                        <img src={prodPhoto} alt="Product" className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer transition">
                        <Camera className="w-4 h-4 text-emerald-600" />
                        <span>{prodPhoto ? "تغيير الصورة" : "رفع صورة"}</span>
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
                        <p className="text-xs text-blue-600 font-bold mt-1 animate-pulse">جاري الرفع والضغط...</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm py-2.5 rounded-xl transition shadow-xs active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    <span>نشر المنتج الآن</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddProductOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ===================== نافذة منبثقة: إضافة قسم جديد ===================== */}
      {isAddCategoryOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-black text-base text-slate-900 flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-[#0B2E8C]" />
                <span>إضافة قسم رئيسي جديد</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsAddCategoryOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
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
                  setIsAddCategoryOpen(false);
                  router.refresh();
                  alert("تمت إضافة القسم بنجاح");
                } else {
                  alert(res.error || "فشل إضافة القسم");
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم القسم *</label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="مثال: مشروبات وعصائر، حلويات، منظفات..."
                  className="w-full text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-right focus:bg-white focus:border-[#0B2E8C] outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">صورة القسم (اختياري)</label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                    {newCatPhoto ? (
                      <img src={newCatPhoto} alt="Category" className="w-full h-full object-cover" />
                    ) : (
                      <FolderPlus className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer transition">
                      <Camera className="w-4 h-4 text-[#0B2E8C]" />
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
                      <p className="text-xs text-blue-600 font-bold mt-1 animate-pulse">جاري الرفع...</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#0B2E8C] hover:bg-[#082269] text-white font-black text-sm py-2.5 rounded-xl transition shadow-xs active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة القسم</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddCategoryOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== نافذة منبثقة: إضافة فرع جديد ===================== */}
      {addBranchTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>إضافة فرع جديد</span>
                </h4>
                <p className="text-xs text-indigo-600 font-bold mt-0.5">
                  يتبع قسم: {addBranchTarget.categoryName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddBranchTarget(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newModalBranchName.trim()) return alert("يرجى كتابة اسم الفرع");
                const fd = new FormData();
                fd.append("categoryId", addBranchTarget.categoryId);
                fd.append("name", newModalBranchName);
                fd.append("photoUrl", newModalBranchPhoto);
                const res = await addShopStoreBranch(shop.id, fd);
                if (res.ok) {
                  setNewModalBranchName("");
                  setNewModalBranchPhoto("");
                  setAddBranchTarget(null);
                  router.refresh();
                  alert("تمت إضافة الفرع بنجاح");
                } else {
                  alert(res.error || "فشل إضافة الفرع");
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم الفرع *</label>
                <input
                  type="text"
                  value={newModalBranchName}
                  onChange={(e) => setNewModalBranchName(e.target.value)}
                  placeholder="مثال: مياه معدنية، عصائر طبيعية..."
                  className="w-full text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-right focus:bg-white focus:border-indigo-600 outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">صورة الفرع (اختياري)</label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                    {newModalBranchPhoto ? (
                      <img src={newModalBranchPhoto} alt="Branch" className="w-full h-full object-cover" />
                    ) : (
                      <Layers className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer transition">
                      <Camera className="w-4 h-4 text-indigo-600" />
                      <span>{newModalBranchPhoto ? "تغيير الصورة" : "رفع صورة"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFileUpload(f, "modal_branch_photo");
                        }}
                        className="hidden"
                      />
                    </label>
                    {uploading === "modal_branch_photo" && (
                      <p className="text-xs text-blue-600 font-bold mt-1 animate-pulse">جاري الرفع...</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm py-2.5 rounded-xl transition shadow-xs active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة الفرع</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAddBranchTarget(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== نافذة منبثقة: إضافة إعلان بانر جديد ===================== */}
      {isAddSlideOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-black text-base text-slate-900 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-purple-600" />
                <span>إضافة إعلان بانر ترويجي</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsAddSlideOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
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
                  setIsAddSlideOpen(false);
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
                <div className="flex items-center gap-3">
                  <div className="w-20 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                    {slideImage ? (
                      <img src={slideImage} alt="Banner" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer transition">
                      <Camera className="w-4 h-4 text-purple-600" />
                      <span>{slideImage ? "تغيير الصورة" : "اختيار صورة الإعلان"}</span>
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
                      <p className="text-xs text-blue-600 font-bold mt-1 animate-pulse">جاري الرفع والضغط...</p>
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
                  placeholder="مثال: خصم 20% على جميع العصائر..."
                  className="w-full text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-right focus:bg-white focus:border-purple-600 outline-none transition"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-black text-sm py-2.5 rounded-xl transition shadow-xs active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة الإعلان</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddSlideOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* فوتر منصة وصلي مع رابط الواتساب */}
      <footer className="mt-12 pt-8 pb-12 border-t border-slate-200/80 text-center space-y-2.5">
        <p className="text-xs font-black text-slate-700">
          صنع بواسطة وصلي
        </p>
        <a
          href="https://wa.me/9647733921468"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition active:scale-95"
        >
          <span>راسلنا واتس اب: 07733921468</span>
        </a>
      </footer>
    </div>
  );
}
