"use client";

import { useState } from "react";
import Link from "next/link";
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
} from "./actions";

interface StoreManagerProps {
  shop: any;
  categories: any[];
  branches: any[];
  products: any[];
  slides: any[];
}

export function StoreManager({
  shop,
  categories,
  branches,
  products,
  slides,
}: StoreManagerProps) {
  const [activeTab, setActiveTab] = useState<"info" | "categories" | "products" | "banners">("info");
  const [uploading, setUploading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // حقول معلومات المتجر
  const [photoUrl, setPhotoUrl] = useState(shop.photoUrl || "");
  const [bannerUrl, setBannerUrl] = useState(shop.storeBannerUrl || "");
  const [phone, setPhone] = useState(shop.phone || "");
  const [bio, setBio] = useState(shop.storeBio || "");

  // حقول إضافة قسم جديد
  const [newCatName, setNewCatName] = useState("");
  const [newCatPhoto, setNewCatPhoto] = useState("");

  // حقول إضافة فرع داخل قسم
  const [newBranchCatId, setNewBranchCatId] = useState(categories[0]?.id || "");
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchPhoto, setNewBranchPhoto] = useState("");

  // حقول إضافة منتج
  const [prodName, setProdName] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodPhoto, setProdPhoto] = useState("");
  const [prodCatId, setProdCatId] = useState(categories[0]?.id || "");
  const [prodBranchId, setProdBranchId] = useState("");

  // حقول إضافة بانر
  const [slideImage, setSlideImage] = useState("");
  const [slideTitle, setSlideTitle] = useState("");

  const storeUrl = typeof window !== "undefined"
    ? `${window.location.origin}/store/shop/${shop.id}`
    : `https://aboakbr.com/store/shop/${shop.id}`;

  const shareText = `مرحبا الي سالوني عن متجرنه هذا الرابط مالتنه:\n${storeUrl}`;

  // دالة رفع الصور مع الضغط التلقائي بنسبة 90% بصيغة WebP لحفظ مساحة R2
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
        if (type === "shop_photo") setPhotoUrl(data.url);
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

  // مشاركة المتجر
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
    <div className="space-y-6 pb-20">
      {/* الشريط العلوي للوحة تحكم المتجر */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white rounded-2xl p-5 md:p-7 shadow-lg relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-blue-200 text-xs font-bold mb-1">
              <Link href="/abo1stor3hlaa2kbr8-47/shops" className="hover:underline">
                ← العودة لقائمة المحلات
              </Link>
            </div>
            <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2">
              🏪 إعدادات متجر {shop.name}
            </h1>
            <p className="text-blue-100 text-sm mt-1">
              إدارة الأقسام والمنتجات والإعلانات الخاصة بمتجر المحل
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/store/shop/${shop.id}`}
              target="_blank"
              className="bg-white text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-xl text-sm font-black shadow transition flex items-center gap-1.5"
            >
              <span>🌐</span>
              معاينة المتجر للزبائن
            </Link>

            <button
              onClick={shareOnWhatsApp}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-black shadow transition flex items-center gap-1.5"
            >
              <span>📲</span>
              مشاركة عبر واتساب
            </button>
          </div>
        </div>

        {/* زر ورسالة المشاركة السريعة */}
        <div className="mt-5 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20 flex flex-wrap items-center justify-between gap-3 text-xs md:text-sm">
          <div className="flex-1 min-w-[200px]">
            <span className="font-bold text-blue-200">نص المشاركة: </span>
            <span className="text-white font-medium select-all">
              &quot;مرحبا الي سالوني عن متجرنه هذا الرابط مالتنه {storeUrl}&quot;
            </span>
          </div>
          <button
            onClick={copyShareMessage}
            className="bg-white text-slate-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg font-bold shadow-sm flex items-center gap-1 transition"
          >
            <span>📋</span>
            {copied ? "تم النسخ بنجاح! ✔️" : "مشاركة متجرك"}
          </button>
        </div>
      </div>

      {/* شريط التبويبات */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveTab("info")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === "info"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <span>⚙️</span>
          بيانات وصورة المتجر
        </button>

        <button
          onClick={() => setActiveTab("categories")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === "categories"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <span>📁</span>
          الأقسام والفروع ({categories.length})
        </button>

        <button
          onClick={() => setActiveTab("products")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === "products"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <span>📦</span>
          المنتجات ({products.length})
        </button>

        <button
          onClick={() => setActiveTab("banners")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === "banners"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <span>🖼️</span>
          إعلانات بانر ({slides.length})
        </button>
      </div>

      {/* ===================== التبويب 1: بيانات وصورة المتجر ===================== */}
      {activeTab === "info" && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm max-w-2xl space-y-5">
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <span>🏪</span>
            إعدادات متجر خاص باسم {shop.name}
          </h2>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData();
              fd.append("photoUrl", photoUrl);
              fd.append("storeBannerUrl", bannerUrl);
              fd.append("phone", phone);
              fd.append("bio", bio);
              const res = await updateShopStoreProfile(shop.id, fd);
              if (res.ok) alert("تم حفظ إعدادات المتجر بنجاح! ✅");
              else alert(res.error || "حدث خطأ");
            }}
            className="space-y-4"
          >
            {/* صورة المتجر / الشعار */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                صورة المتجر (الشعار / اللوغو)
              </label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Store Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl">🏪</span>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f, "shop_photo");
                    }}
                    className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    يتم ضغط الصورة تلقائياً بنسبة 90% بصيغة WebP لتوفير المساحة وسرعة التصفح.
                  </p>
                  {uploading === "shop_photo" && (
                    <p className="text-xs text-blue-600 font-bold mt-1">جاري الرفع والضغط...</p>
                  )}
                </div>
              </div>
            </div>

            {/* صورة الغلاف / البانر العلوي للمتجر */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                صورة غلاف المتجر (بانر علوي اختياري)
              </label>
              <div className="flex items-center gap-4">
                <div className="w-32 h-16 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  {bannerUrl ? (
                    <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-slate-400">لا يوجد غلاف</span>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f, "shop_banner");
                    }}
                    className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                  {uploading === "shop_banner" && (
                    <p className="text-xs text-blue-600 font-bold mt-1">جاري الرفع والضغط...</p>
                  )}
                </div>
              </div>
            </div>

            {/* رقم هاتف الواتساب */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رقم هاتف الواتساب لتلقي طلبات المتجر
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="مثال: 07733921468"
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                الطلبات المرسلة من الزبائن ستصل مباشرة إلى هذا الرقم على الواتساب.
              </p>
            </div>

            {/* نبذة عن المتجر */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                نبذة أو وصف قصير للمتجر
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="أهلاً بكم في متجرنا! تجدون لدينا أفضل المنتجات والأسعار..."
                rows={3}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-2.5 rounded-xl shadow-md transition"
            >
              حفظ إعدادات المتجر
            </button>
          </form>
        </div>
      )}

      {/* ===================== التبويب 2: الأقسام والفروع ===================== */}
      {activeTab === "categories" && (
        <div className="space-y-6">
          {/* قسم إضافة قسم جديد */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm max-w-xl">
            <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
              <span>➕</span>
              إضافة قسم جديد
            </h3>
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
                  alert("تمت إضافة القسم بنجاح! ✅");
                } else {
                  alert(res.error || "فشل إضافة القسم");
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم القسم
                </label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="مثال: مشروبات، ألبان، معلبات، مجمدات..."
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 text-right"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  صورة القسم
                </label>
                <div className="flex items-center gap-3">
                  {newCatPhoto && (
                    <img src={newCatPhoto} alt="Cat" className="w-12 h-12 rounded-xl object-cover border" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f, "cat_photo");
                    }}
                    className="text-xs text-slate-500 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-700 font-bold"
                  />
                </div>
                {uploading === "cat_photo" && (
                  <p className="text-xs text-blue-600 font-bold mt-1">جاري الرفع والضغط...</p>
                )}
              </div>

              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl text-sm transition"
              >
                حفظ وإضافة القسم
              </button>
            </form>
          </div>

          {/* إضافة فرع داخل قسم */}
          {categories.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm max-w-xl">
              <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
                <span>🌿</span>
                إضافة فرع (قسم فرعي) داخل القسم
              </h3>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newBranchName.trim()) return alert("يرجى كتابة اسم الفرع");
                  const fd = new FormData();
                  fd.append("categoryId", newBranchCatId);
                  fd.append("name", newBranchName);
                  fd.append("photoUrl", newBranchPhoto);
                  const res = await addShopStoreBranch(shop.id, fd);
                  if (res.ok) {
                    setNewBranchName("");
                    setNewBranchPhoto("");
                    alert("تمت إضافة الفرع بنجاح! ✅");
                  } else {
                    alert(res.error || "فشل إضافة الفرع");
                  }
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    اختر القسم الرئيسي
                  </label>
                  <select
                    value={newBranchCatId}
                    onChange={(e) => setNewBranchCatId(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 text-right"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    اسم الفرع
                  </label>
                  <input
                    type="text"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder="مثال: مياه وعصائر، مشروبات غازية..."
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 text-right"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    صورة الفرع (اختياري)
                  </label>
                  <div className="flex items-center gap-3">
                    {newBranchPhoto && (
                      <img src={newBranchPhoto} alt="Branch" className="w-12 h-12 rounded-xl object-cover border" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f, "branch_photo");
                      }}
                      className="text-xs text-slate-500 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-700 font-bold"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 py-2 rounded-xl text-sm transition"
                >
                  إضافة الفرع داخل القسم
                </button>
              </form>
            </div>
          )}

          {/* قائمة الأقسام والفروع الحالية */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-base font-black text-slate-800 mb-4">
              الأقسام والفروع الحالية ({categories.length})
            </h3>
            {categories.length === 0 ? (
              <p className="text-sm text-slate-400">لا توجد أقسام بعد. قم بإضافة أول قسم أعلاه.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((cat) => {
                  const catBranches = branches.filter((b) => b.categoryId === cat.id);
                  const catProducts = products.filter((p) => p.categoryId === cat.id);
                  return (
                    <div key={cat.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {cat.photoUrl ? (
                            <img src={cat.photoUrl} alt={cat.name} className="w-12 h-12 rounded-xl object-cover border" />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                              📁
                            </div>
                          )}
                          <div>
                            <h4 className="font-black text-slate-800 text-sm">{cat.name}</h4>
                            <p className="text-[11px] text-slate-500">
                              {catProducts.length} منتج | {catBranches.length} فرع
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={async () => {
                            if (confirm(`هل أنت متأكد من حذف قسم "${cat.name}" وجميع منتجاته؟`)) {
                              await deleteShopStoreCategory(cat.id, shop.id);
                            }
                          }}
                          className="text-xs text-red-600 hover:text-red-700 font-bold p-1"
                        >
                          حذف 🗑️
                        </button>
                      </div>

                      {/* فروع القسم */}
                      {catBranches.length > 0 && (
                        <div className="border-t border-slate-200 pt-2 space-y-1">
                          <p className="text-[11px] font-bold text-slate-600">الفروع التابعة:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {catBranches.map((b) => (
                              <span
                                key={b.id}
                                className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-lg text-xs font-bold text-slate-700"
                              >
                                {b.name}
                                <button
                                  onClick={async () => {
                                    if (confirm(`حذف فرع "${b.name}"؟`)) {
                                      await deleteShopStoreBranch(b.id, shop.id);
                                    }
                                  }}
                                  className="text-red-500 hover:text-red-700 text-[10px]"
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

      {/* ===================== التبويب 3: المنتجات ===================== */}
      {activeTab === "products" && (
        <div className="space-y-6">
          {/* إضافة منتج جديد */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm max-w-2xl">
            <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
              <span>➕</span>
              نشر منتج جديد في المتجر
            </h3>
            {categories.length === 0 ? (
              <p className="text-sm text-amber-600 font-bold bg-amber-50 p-3 rounded-xl border border-amber-200">
                يرجى إضافة قسم أولاً من تبويب &quot;الأقسام والفروع&quot; لتتمكن من نشر المنتجات داخلها.
              </p>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!prodName.trim()) return alert("اسم المنتج مطلوب");
                  if (!prodPrice.trim()) return alert("سعر المنتج مطلوب");

                  const fd = new FormData();
                  fd.append("name", prodName);
                  fd.append("price", prodPrice);
                  fd.append("description", prodDesc);
                  fd.append("photoUrl", prodPhoto);
                  fd.append("categoryId", prodCatId);
                  fd.append("branchId", prodBranchId);

                  const res = await addShopStoreProduct(shop.id, fd);
                  if (res.ok) {
                    setProdName("");
                    setProdPrice("");
                    setProdDesc("");
                    setProdPhoto("");
                    alert("تم نشر المنتج في المتجر بنجاح! ✅");
                  } else {
                    alert(res.error || "فشل نشر المنتج");
                  }
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      اسم المنتج
                    </label>
                    <input
                      type="text"
                      value={prodName}
                      onChange={(e) => setProdName(e.target.value)}
                      placeholder="مثال: شاي الوزة 400 غرام"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 text-right"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      السعر (بالدينار العراقي)
                    </label>
                    <input
                      type="number"
                      value={prodPrice}
                      onChange={(e) => setProdPrice(e.target.value)}
                      placeholder="مثال: 3500"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 text-right"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      القسم التابع له المنتج
                    </label>
                    <select
                      value={prodCatId}
                      onChange={(e) => {
                        setProdCatId(e.target.value);
                        setProdBranchId(""); // تصفير الفرع عند تغيير القسم
                      }}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 text-right"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      الفرع التابع له (اختياري - يمكنك النشر بالقسم مباشرة)
                    </label>
                    <select
                      value={prodBranchId}
                      onChange={(e) => setProdBranchId(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 text-right"
                    >
                      <option value="">بدون فرع (داخل القسم مباشرة)</option>
                      {branches
                        .filter((b) => b.categoryId === prodCatId)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            فرع: {b.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    صورة المنتج
                  </label>
                  <div className="flex items-center gap-3">
                    {prodPhoto ? (
                      <img src={prodPhoto} alt="Product" className="w-14 h-14 rounded-xl object-cover border" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center text-xl">
                        📦
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f, "prod_photo");
                      }}
                      className="text-xs text-slate-500 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-700 font-bold"
                    />
                  </div>
                  {uploading === "prod_photo" && (
                    <p className="text-xs text-blue-600 font-bold mt-1">جاري الرفع والضغط...</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    وصف المنتج (اختياري)
                  </label>
                  <textarea
                    value={prodDesc}
                    onChange={(e) => setProdDesc(e.target.value)}
                    placeholder="مواصفات، وزن، أو تفاصيل المنتج..."
                    rows={2}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 text-right"
                  />
                </div>

                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-2.5 rounded-xl text-sm shadow transition"
                >
                  نشر المنتج الآن
                </button>
              </form>
            )}
          </div>

          {/* قائمة المنتجات المنشورة */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-base font-black text-slate-800 mb-4">
              المنتجات المعروضة في المتجر ({products.length})
            </h3>
            {products.length === 0 ? (
              <p className="text-sm text-slate-400">لا توجد منتجات منشورة بعد.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {products.map((p) => (
                  <div key={p.id} className="border border-slate-200 rounded-2xl p-3 bg-white hover:shadow-md transition flex flex-col justify-between">
                    <div>
                      <div className="w-full aspect-square rounded-xl bg-slate-100 overflow-hidden mb-2 relative">
                        {p.photoUrl ? (
                          <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl">
                            📦
                          </div>
                        )}
                      </div>
                      <h4 className="font-black text-slate-800 text-xs line-clamp-2">{p.name}</h4>
                      <p className="text-blue-600 font-black text-xs mt-1">
                        {Number(p.price).toLocaleString()} د.ع
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {categories.find((c) => c.id === p.categoryId)?.name || "قسم"}
                      </p>
                    </div>

                    <button
                      onClick={async () => {
                        if (confirm(`حذف منتج "${p.name}"؟`)) {
                          await deleteShopStoreProduct(p.id, shop.id);
                        }
                      }}
                      className="mt-3 w-full bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold py-1 rounded-lg transition"
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

      {/* ===================== التبويب 4: إعلانات بانر ===================== */}
      {activeTab === "banners" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm max-w-xl">
            <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
              <span>🖼️</span>
              إعلانات بانر (سلايدر العروض)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              يمكنك إضافة صور إعلانات وعروض ترويجية تظهر أعلى المتجر للزبائن بشكل سلايدر متحرك.
            </p>

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
                  alert("تمت إضافة إعلان البانر بنجاح! ✅");
                } else {
                  alert(res.error || "فشل إضافة الإعلان");
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  صورة الإعلان
                </label>
                <div className="flex items-center gap-3">
                  {slideImage && (
                    <img src={slideImage} alt="Banner" className="w-24 h-14 rounded-xl object-cover border" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f, "slide_image");
                    }}
                    className="text-xs text-slate-500 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-700 font-bold"
                  />
                </div>
                {uploading === "slide_image" && (
                  <p className="text-xs text-blue-600 font-bold mt-1">جاري الرفع والضغط...</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  عنوان الإعلان (اختياري)
                </label>
                <input
                  type="text"
                  value={slideTitle}
                  onChange={(e) => setSlideTitle(e.target.value)}
                  placeholder="مثال: خصم 20% على جميع المنظفات بمناسبة العيد"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 text-right"
                />
              </div>

              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-700 text-white font-black px-5 py-2.5 rounded-xl text-sm shadow transition"
              >
                إضافة إعلان البانر
              </button>
            </form>
          </div>

          {/* البانرات الحالية */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-base font-black text-slate-800 mb-4">
              إعلانات البانر المعروضة ({slides.length})
            </h3>
            {slides.length === 0 ? (
              <p className="text-sm text-slate-400">لا توجد إعلانات بانر مضافة بعد.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {slides.map((slide) => (
                  <div key={slide.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 relative group">
                    <img src={slide.imageUrl} alt="Banner" className="w-full h-36 object-cover" />
                    {slide.title && (
                      <div className="p-2 text-xs font-bold text-slate-800 text-center bg-white border-t">
                        {slide.title}
                      </div>
                    )}
                    <button
                      onClick={async () => {
                        if (confirm("حذف هذا الإعلان؟")) {
                          await deleteShopStoreSlide(slide.id, shop.id);
                        }
                      }}
                      className="absolute top-2 left-2 bg-red-600 text-white px-2.5 py-1 rounded-lg text-xs font-bold shadow hover:bg-red-700 transition"
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
    </div>
  );
}
