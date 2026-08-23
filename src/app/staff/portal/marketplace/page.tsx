"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { compressImageFile } from "@/lib/image-compressor";

function getImageUrl(rawUrl: string): string {
  if (!rawUrl || !rawUrl.trim()) return "";
  let url = rawUrl.trim();
  if (url.includes(".r2.dev/")) {
    const parts = url.split(".r2.dev/");
    if (parts.length > 1) {
      return `/uploads/${parts[1]}`;
    }
  }
  return url;
}

export default function StaffMarketplacePortal() {
  const searchParams = useSearchParams();
  const se = searchParams.get("se") || "";
  const exp = searchParams.get("exp") || "";
  const s = searchParams.get("s") || "";
  const authQ = `se=${se}&exp=${exp}&s=${s}`;

  const [activeTab, setActiveTab] = useState<"items" | "inquiries" | "categories">("items");
  const [stats, setStats] = useState<any>({ totalItems: 0, totalViews: 0, totalInquiries: 0, totalCategories: 0 });
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals Visibility State
  const [showAddItemModal, setShowAddItemModal] = useState<boolean>(false);
  const [showAddCatModal, setShowAddCatModal] = useState<boolean>(false);

  // Add/Edit Item Form State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingItemImg, setUploadingItemImg] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState("");

  // Category Management Form State
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState("");
  const [catImageUrl, setCatImageUrl] = useState("");
  const [catSortOrder, setCatSortOrder] = useState<number>(0);
  const [uploadingCatImg, setUploadingCatImg] = useState(false);
  const [catSubmitting, setCatSubmitting] = useState(false);
  const [catMsg, setCatMsg] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/marketplace?${authQ}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setCategories(data.categories || []);
        setItems(data.items || []);
        setInquiries(data.inquiries || []);
      }
    } catch (e) {
      console.error("Error fetching staff marketplace data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadImage = async (file: File, isCategory: boolean) => {
    if (isCategory) setUploadingCatImg(true);
    else setUploadingItemImg(true);

    try {
      const compressedBlob = await compressImageFile(file, 800, 800, 0.6);
      const compressedFile = new File([compressedBlob], file.name, { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("file", compressedFile);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (data.success && data.url) {
        if (isCategory) {
          setCatImageUrl(data.url);
          setCatMsg(`تم رفع وضغط صورة القسم بنجاح (${data.compressedSizeKb} KB) ⚡`);
        } else {
          setImageUrl(data.url);
          setFormMsg(`تم رفع وضغط صورة السلعة بنجاح (${data.compressedSizeKb} KB) ⚡`);
        }
      } else {
        alert(data.error || "فشل رفع الصورة");
      }
    } catch (err) {
      alert("خطأ أثناء رفع الصورة");
    } finally {
      if (isCategory) setUploadingCatImg(false);
      else setUploadingItemImg(false);
    }
  };

  const handleCreateOrUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || (!selectedCategory && !newCategoryName) || !sellerPhone) {
      setFormMsg("الرجاء ملء الأقسام المطلوبة: اسم السلعة، القسم، ورقم البائع");
      return;
    }

    setSubmitting(true);
    setFormMsg("");

    try {
      const res = await fetch(`/api/staff/marketplace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editingItemId ? "update_item" : "create_item",
          id: editingItemId || undefined,
          title,
          categoryId: selectedCategory !== "new" ? selectedCategory : undefined,
          categoryName: selectedCategory === "new" ? newCategoryName : undefined,
          price,
          location,
          sellerPhone,
          imageUrl,
          staffEmployeeId: se
        })
      });

      const data = await res.json();
      if (data.success) {
        setFormMsg(editingItemId ? "تم تحديث كافة تفاصيل السلعة بنجاح! ✨" : "تم نشر السلعة في المعرض بنجاح! 🎉");
        fetchData();
        setTimeout(() => {
          setShowAddItemModal(false);
          setEditingItemId(null);
          setTitle("");
          setPrice("");
          setLocation("");
          setSellerPhone("");
          setImageUrl("");
          setNewCategoryName("");
          setSelectedCategory("");
          setFormMsg("");
        }, 1000);
      } else {
        setFormMsg(data.error || "فشل حفظ السلعة");
      }
    } catch (err) {
      setFormMsg("حدث خطأ في الاتصال");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditItem = (item: any) => {
    setEditingItemId(item.id);
    setTitle(item.title);
    setSelectedCategory(item.categoryId || "");
    setPrice(item.price || "");
    setLocation(item.location || "");
    setSellerPhone(item.sellerPhone || "");
    setImageUrl(item.imageUrl || "");
    setFormMsg("");
    setShowAddItemModal(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      setCatMsg("الرجاء تحديد اسم القسم");
      return;
    }

    setCatSubmitting(true);
    setCatMsg("");

    try {
      const res = await fetch(`/api/staff/marketplace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editingCatId ? "update_category" : "create_category",
          id: editingCatId || undefined,
          name: catName.trim(),
          imageUrl: catImageUrl.trim(),
          sortOrder: catSortOrder
        })
      });

      const data = await res.json();
      if (data.success) {
        setCatMsg(editingCatId ? "تم تحديث بيانات القسم بنجاح! ✨" : "تمت إضافة القسم الجديد بنجاح! 🎉");
        fetchData();
        setTimeout(() => {
          setShowAddCatModal(false);
          setEditingCatId(null);
          setCatName("");
          setCatImageUrl("");
          setCatSortOrder(0);
          setCatMsg("");
        }, 1000);
      } else {
        setCatMsg(data.error || "فشل حفظ القسم");
      }
    } catch (err) {
      setCatMsg("خطأ في الاتصال بالسيرفر");
    } finally {
      setCatSubmitting(false);
    }
  };

  const handleEditCategory = (cat: any) => {
    setEditingCatId(cat.id);
    setCatName(cat.name);
    setCatImageUrl(cat.imageUrl || "");
    setCatSortOrder(cat.sortOrder || 0);
    setCatMsg("");
    setShowAddCatModal(true);
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!confirm("هل أنت تأكد من حذف هذا القسم؟ قد يؤدي هذا لحذف السلع التابعة له.")) return;
    try {
      const res = await fetch(`/api/staff/marketplace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_category",
          categoryId: catId
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error || "فشل الحذف");
      }
    } catch (e) {
      alert("فشل الحذف");
    }
  };

  const handleToggleSold = async (itemId: string, currentIsSold: boolean) => {
    try {
      const res = await fetch(`/api/staff/marketplace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_sold",
          itemId,
          isSold: !currentIsSold
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (e) {
      alert("فشل تغيير حالة السلعة");
    }
  };

  const handleNotifySeller = async (inquiryId: string) => {
    try {
      const res = await fetch(`/api/staff/marketplace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "notify_seller",
          inquiryId
        })
      });
      const data = await res.json();
      if (data.success && data.whatsappUrl) {
        window.open(data.whatsappUrl, "_blank");
        fetchData();
      }
    } catch (e) {
      alert("فشل التبليغ");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("هل أنت تأكد من حذف هذه السلعة من المعرض؟")) return;
    try {
      const res = await fetch(`/api/staff/marketplace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_item",
          itemId
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (e) {
      alert("فشل الحذف");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-3 sm:p-6 dir-rtl" style={{ direction: "rtl" }}>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Top Header - Light Theme */}
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <Link
              href={`/staff/portal?${authQ}`}
              className="w-10 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center text-lg font-bold border border-slate-300 transition"
            >
              ➔
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-800">إدارة سوق المبيعات والمستعمل 🏷️</h1>
              <p className="text-xs text-slate-500 font-medium">تعديل كافة تفاصيل السلع والأقسام ومتابعة طلبات الشراية</p>
            </div>
          </div>
          <Link
            href="/sell"
            target="_blank"
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-sm transition"
          >
            مشاهدة المعرض العام 🌐
          </Link>
        </div>

        {/* Action Buttons Bar - Light */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingItemId(null);
                setTitle("");
                setPrice("");
                setLocation("");
                setSellerPhone("");
                setImageUrl("");
                setSelectedCategory("");
                setFormMsg("");
                setShowAddItemModal(true);
              }}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 transition active:scale-95"
            >
              <span>➕</span>
              <span>إضافة منشور سلعة جديدة</span>
            </button>

            <button
              onClick={() => {
                setEditingCatId(null);
                setCatName("");
                setCatImageUrl("");
                setCatSortOrder(0);
                setCatMsg("");
                setShowAddCatModal(true);
              }}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md shadow-purple-600/20 flex items-center gap-2 transition active:scale-95"
            >
              <span>🏷️</span>
              <span>إضافة قسم جديد</span>
            </button>
          </div>

          <span className="text-xs text-slate-500 font-bold">
            الأقسام: <span className="text-purple-600 font-black">{stats.totalCategories}</span> | السلع: <span className="text-emerald-600 font-black">{stats.totalItems}</span>
          </span>
        </div>

        {/* Stats Section - Light Theme */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-sm">
            <span className="text-2xl">📦</span>
            <div className="text-xl font-black text-slate-800 mt-1">{stats.totalItems}</div>
            <div className="text-xs text-slate-500 font-semibold">السلع المعروضة</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-sm">
            <span className="text-2xl">👁️</span>
            <div className="text-xl font-black text-cyan-600 mt-1">{stats.totalViews}</div>
            <div className="text-xs text-slate-500 font-semibold">مشاهدات المعرض</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-sm">
            <span className="text-2xl">💬</span>
            <div className="text-xl font-black text-emerald-600 mt-1">{stats.totalInquiries}</div>
            <div className="text-xs text-slate-500 font-semibold">طلبات المراسلة (الشراية)</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-sm">
            <span className="text-2xl">🏷️</span>
            <div className="text-xl font-black text-purple-600 mt-1">{stats.totalCategories}</div>
            <div className="text-xs text-slate-500 font-semibold">الأقسام المتاحة</div>
          </div>
        </div>

        {/* Tabs Navigation - Light Theme */}
        <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          <button
            onClick={() => setActiveTab("items")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === "items" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            📋 قائمة السلع ({items.length})
          </button>
          <button
            onClick={() => setActiveTab("categories")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === "categories" ? "bg-purple-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            🏷️ الأقسام والتسلسل ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab("inquiries")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === "inquiries" ? "bg-cyan-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            👥 الشراية وطلبات المراسلة ({inquiries.length})
          </button>
        </div>

        {/* Tab 1: Items List - Light Theme */}
        {activeTab === "items" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800">السلع المنشورة بالمعرض:</h3>
              <button
                onClick={() => {
                  setEditingItemId(null);
                  setTitle("");
                  setPrice("");
                  setLocation("");
                  setSellerPhone("");
                  setImageUrl("");
                  setSelectedCategory("");
                  setFormMsg("");
                  setShowAddItemModal(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-sm"
              >
                <span>➕</span>
                <span>إضافة سلعة جديدة</span>
              </button>
            </div>
            {loading ? (
              <div className="text-center py-8 text-slate-500 text-xs font-semibold">جاري التحميل...</div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs font-semibold">لا توجد سلع مضافة حتى الآن</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((item) => (
                  <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex gap-3 shadow-sm hover:border-slate-300 transition">
                    <div className="w-20 h-20 bg-slate-200 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-slate-300">
                      {item.imageUrl ? (
                        <img src={getImageUrl(item.imageUrl)} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">📦</span>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-sm text-slate-800 line-clamp-1">{item.title}</h4>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold border border-emerald-200">
                            {item.category?.name}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-600 font-bold mt-1">{item.price || "غير محدد"}</p>
                        <p className="text-xs text-slate-500 font-semibold mt-0.5">📞 البائع: {item.sellerPhone}</p>
                        {item.location && <p className="text-xs text-slate-500 font-medium">📍 المكان: {item.location}</p>}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-200 pt-2 mt-2">
                        <span className="font-semibold">👁️ {item.viewsCount} | 💬 {item.inquiriesCount} طلب</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditItem(item)}
                            className="bg-white hover:bg-slate-100 text-cyan-700 border border-slate-300 px-2 py-1 rounded-lg text-[11px] font-bold shadow-sm"
                          >
                            ✏️ تعديل
                          </button>
                          <button
                            onClick={() => handleToggleSold(item.id, item.isSold)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition shadow-sm ${
                              item.isSold
                                ? "bg-slate-200 text-slate-700 hover:bg-slate-300 border border-slate-300"
                                : "bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200"
                            }`}
                          >
                            {item.isSold ? "إعادة كـ متاح 🔄" : "تأشير كمبيوع 🏷️"}
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="text-red-600 hover:text-red-500 font-bold"
                          >
                            🗑️ حذف
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Categories Management List - Light Theme */}
        {activeTab === "categories" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800">الأقسام المتاحة (حسب التسلسل):</h3>
              <button
                onClick={() => {
                  setEditingCatId(null);
                  setCatName("");
                  setCatImageUrl("");
                  setCatSortOrder(0);
                  setCatMsg("");
                  setShowAddCatModal(true);
                }}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-sm"
              >
                <span>➕</span>
                <span>إضافة قسم جديد</span>
              </button>
            </div>

            {categories.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs font-semibold">لا توجد أقسام مضافة بعد</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white rounded-xl overflow-hidden flex items-center justify-center border border-slate-200 shadow-sm">
                        {cat.imageUrl ? (
                          <img src={getImageUrl(cat.imageUrl)} alt={cat.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl">🏷️</span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-800">{cat.name}</h4>
                          <span className="bg-purple-100 text-purple-800 border border-purple-200 text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                            تسلسل: {cat.sortOrder}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-medium">تاريخ الإنشاء: {new Date(cat.createdAt).toLocaleDateString("ar-EG")}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditCategory(cat)}
                        className="bg-white hover:bg-slate-100 text-cyan-700 border border-slate-300 text-xs px-3 py-1.5 rounded-xl font-bold shadow-sm"
                      >
                        ✏️ تعديل
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="bg-white hover:bg-slate-100 text-red-600 border border-slate-300 text-xs px-3 py-1.5 rounded-xl font-bold shadow-sm"
                      >
                        🗑️ حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Inquiries & Buyers - Beautiful Mobile Cards Layout */}
        {activeTab === "inquiries" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <span>👥</span>
                <span>سجل طلبات المراسلة والشراية:</span>
              </h3>
              <span className="text-xs text-slate-500 font-bold bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                {inquiries.length} طلب
              </span>
            </div>

            {inquiries.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs font-semibold">لا توجد طلبات شراية مسجلة بعد</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inquiries.map((inq) => (
                  <div
                    key={inq.id}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm hover:border-emerald-300 transition"
                  >
                    {/* Header: Buyer Name & Status Badge */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2.5">
                      <div>
                        <h4 className="font-black text-sm text-slate-800 flex items-center gap-1.5">
                          <span>👤</span>
                          <span>{inq.buyerName}</span>
                        </h4>
                        <p className="text-xs font-mono font-bold text-cyan-700 mt-0.5">📞 {inq.buyerPhone}</p>
                      </div>

                      {inq.notifiedSeller ? (
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-xl text-[10px] font-bold shadow-sm">
                          تم التبليغ ✅
                        </span>
                      ) : (
                        <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-xl text-[10px] font-bold shadow-sm animate-pulse">
                          لم يُبلغ بعد ⏳
                        </span>
                      )}
                    </div>

                    {/* Details: Item & Address */}
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold">السلعة المطلوبة:</span>
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                          {inq.item?.title}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold">العنوان / المنطقة:</span>
                        <span className="text-slate-700 font-bold">{inq.buyerAddress || "غير محدد"}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                        <span>وقت الطلب:</span>
                        <span>{new Date(inq.createdAt).toLocaleDateString("ar-EG")} - {new Date(inq.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>

                    {/* Action Button: Notify Seller via WhatsApp */}
                    <button
                      onClick={() => handleNotifySeller(inq.id)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 mt-1"
                    >
                      <span>📲</span>
                      <span>تبليغ البائع بالواتساب الآن</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 🟢 Modal 1: Add / Edit Item Modal - Light Theme */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto text-slate-800">
            <button
              onClick={() => setShowAddItemModal(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 text-xl p-1"
            >
              ✕
            </button>

            <h3 className="font-bold text-base text-slate-800 mb-4 flex items-center gap-2">
              <span>{editingItemId ? "✏️" : "🚀"}</span>
              <span>{editingItemId ? "تعديل تفاصيل السلعة المنشورة" : "إضافة منشور سلعة جديدة للمعرض"}</span>
            </h3>

            {formMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-bold text-center mb-4 ${
                  formMsg.includes("بنجاح")
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {formMsg}
              </div>
            )}

            <form onSubmit={handleCreateOrUpdateItem} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم / عنوان السلعة *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: طابعة ليتر ملونة / بايسكل جبلي 26"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اختر القسم *</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  >
                    <option value="">اختر قسماً من القائمة</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (تسلسل: {c.sortOrder})
                      </option>
                    ))}
                    <option value="new">➕ إضافة قسم جديد...</option>
                  </select>
                </div>

                {selectedCategory === "new" && (
                  <div>
                    <label className="block font-bold text-emerald-700 mb-1">اسم القسم الجديد *</label>
                    <input
                      type="text"
                      placeholder="مثال: أجهزة رياضية"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="w-full bg-slate-50 border border-emerald-500 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:bg-white"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">سعر السلعة</label>
                  <input
                    type="text"
                    placeholder="مثال: 50,000 دينار / 100$"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">المنطقة / المكان</label>
                  <input
                    type="text"
                    placeholder="مثال: بغداد - حي الجامعة"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم هاتف البائع *</label>
                <input
                  type="tel"
                  required
                  placeholder="077xxxxxxxx"
                  value={sellerPhone}
                  onChange={(e) => setSellerPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">صورة السلعة (رفع مباشر من الهاتف مع ضغط R2)</label>
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer bg-slate-50 border border-emerald-300 hover:border-emerald-500 rounded-xl p-3 text-center transition flex items-center justify-center gap-2">
                    <span className="text-base">📸</span>
                    <span className="font-bold text-emerald-700">
                      {uploadingItemImg ? "جاري تقليل حجم الصورة ورفعها لـ R2..." : "اختر أو استبدل صورة السلعة..."}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingItemImg}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadImage(file, false);
                      }}
                    />
                  </label>

                  {imageUrl && (
                    <div className="relative w-full h-32 bg-slate-100 rounded-xl overflow-hidden border border-slate-300 flex items-center justify-center">
                      <img src={getImageUrl(imageUrl)} alt="معاينة السلعة" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImageUrl("")}
                        className="absolute top-2 left-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting || uploadingItemImg}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition shadow-md shadow-emerald-600/20 text-sm"
                >
                  {submitting ? "جاري الحفظ..." : editingItemId ? "حفظ التعديلات" : "🚀 نشر السلعة الآن"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-4 py-3 rounded-xl text-sm"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🟣 Modal 2: Add / Edit Category Modal - Light Theme */}
      {showAddCatModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-md shadow-2xl relative text-slate-800">
            <button
              onClick={() => setShowAddCatModal(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 text-xl p-1"
            >
              ✕
            </button>

            <h3 className="font-bold text-base text-purple-700 mb-4 flex items-center gap-2">
              <span>🏷️</span>
              <span>{editingCatId ? "تعديل بيانات القسم" : "إضافة قسم جديد للمعرض"}</span>
            </h3>

            {catMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-bold text-center mb-4 ${
                  catMsg.includes("بنجاح")
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {catMsg}
              </div>
            )}

            <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم القسم *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: طابعات / بايسكلات / بيوت"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">صورة القسم (رفع من الهاتف لـ R2)</label>
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer bg-slate-50 border border-purple-300 hover:border-purple-500 rounded-xl p-3 text-center transition flex items-center justify-center gap-2">
                    <span className="text-base">📱</span>
                    <span className="font-bold text-purple-700">
                      {uploadingCatImg ? "جاري ضغط الصورة ورفعها لـ R2..." : "اختر صورة القسم من الهاتف..."}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingCatImg}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadImage(file, true);
                      }}
                    />
                  </label>

                  {catImageUrl && (
                    <div className="relative w-full h-24 bg-slate-100 rounded-xl overflow-hidden border border-slate-300 flex items-center justify-center">
                      <img src={getImageUrl(catImageUrl)} alt="معاينة القسم" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setCatImageUrl("")}
                        className="absolute top-1 left-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">تسلسل / ترتيب الظهور (رقم)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={catSortOrder}
                  onChange={(e) => setCatSortOrder(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white"
                />
                <span className="text-[10px] text-slate-500 font-semibold mt-1 block">الأرقام الأصغر تصدر أولاً (مثال: 1 ثم 2 ثم 3)</span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={catSubmitting || uploadingCatImg}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition shadow-md shadow-purple-600/20 text-sm"
                >
                  {catSubmitting ? "جاري الحفظ..." : editingCatId ? "حفظ التعديلات" : "إضافة القسم الآن"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCatModal(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-sm"
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
