"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { compressImageFile } from "@/lib/image-compressor";

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

  // Add Item Form State
  const [title, setTitle] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [sellerName, setSellerName] = useState("");
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

  const handleCreateItem = async (e: React.FormEvent) => {
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
          action: "create_item",
          title,
          categoryId: selectedCategory !== "new" ? selectedCategory : undefined,
          categoryName: selectedCategory === "new" ? newCategoryName : undefined,
          price,
          location,
          sellerPhone,
          sellerName,
          imageUrl,
          staffEmployeeId: se
        })
      });

      const data = await res.json();
      if (data.success) {
        setFormMsg("تم نشر السلعة في المعرض بنجاح! 🎉");
        setTitle("");
        setPrice("");
        setLocation("");
        setSellerPhone("");
        setSellerName("");
        setImageUrl("");
        setNewCategoryName("");
        setSelectedCategory("");
        fetchData();
        setTimeout(() => {
          setShowAddItemModal(false);
          setFormMsg("");
        }, 1200);
      } else {
        setFormMsg(data.error || "فشل نشر السلعة");
      }
    } catch (err) {
      setFormMsg("حدث خطأ في الاتصال");
    } finally {
      setSubmitting(false);
    }
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
        }, 1200);
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
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 dir-rtl" style={{ direction: "rtl" }}>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between bg-slate-800 p-4 rounded-2xl border border-slate-700">
          <div className="flex items-center gap-3">
            <Link
              href={`/staff/portal?${authQ}`}
              className="w-10 h-10 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center justify-center text-lg font-bold"
            >
              ➔
            </Link>
            <div>
              <h1 className="text-xl font-bold">إدارة سوق المبيعات والمستعمل 🏷️</h1>
              <p className="text-xs text-slate-400">متابعة المنتجات، إضافة سلع وأقسام، وإدارة طلبات الشراية</p>
            </div>
          </div>
          <Link
            href="/sell"
            target="_blank"
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-xl"
          >
            مشاهدة المعرض العام 🌐
          </Link>
        </div>

        {/* Action Buttons Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800 p-3 rounded-2xl border border-slate-700">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setFormMsg("");
                setShowAddItemModal(true);
              }}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-purple-600/30 flex items-center gap-2 transition active:scale-95"
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
              className="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-pink-600/30 flex items-center gap-2 transition active:scale-95"
            >
              <span>🏷️</span>
              <span>إضافة قسم جديد</span>
            </button>
          </div>

          <span className="text-xs text-slate-400 font-semibold">
            الأقسام: <span className="text-purple-400">{stats.totalCategories}</span> | السلع: <span className="text-cyan-400">{stats.totalItems}</span>
          </span>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 text-center">
            <span className="text-2xl">📦</span>
            <div className="text-xl font-black text-white mt-1">{stats.totalItems}</div>
            <div className="text-xs text-slate-400">السلع المعروضة</div>
          </div>
          <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 text-center">
            <span className="text-2xl">👁️</span>
            <div className="text-xl font-black text-cyan-400 mt-1">{stats.totalViews}</div>
            <div className="text-xs text-slate-400">مشاهدات المعرض</div>
          </div>
          <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 text-center">
            <span className="text-2xl">💬</span>
            <div className="text-xl font-black text-emerald-400 mt-1">{stats.totalInquiries}</div>
            <div className="text-xs text-slate-400">طلبات المراسلة (الشراية)</div>
          </div>
          <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 text-center">
            <span className="text-2xl">🏷️</span>
            <div className="text-xl font-black text-purple-400 mt-1">{stats.totalCategories}</div>
            <div className="text-xs text-slate-400">الأقسام المتاحة</div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex gap-2 bg-slate-800 p-1.5 rounded-2xl border border-slate-700 overflow-x-auto">
          <button
            onClick={() => setActiveTab("items")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === "items" ? "bg-cyan-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            📋 قائمة السلع ({items.length})
          </button>
          <button
            onClick={() => setActiveTab("categories")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === "categories" ? "bg-purple-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            🏷️ الأقسام والتسلسل ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab("inquiries")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === "inquiries" ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            👥 الشراية وطلبات المراسلة ({inquiries.length})
          </button>
        </div>

        {/* Tab 1: Items List */}
        {activeTab === "items" && (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-300">السلع المنشورة بالمعرض:</h3>
              <button
                onClick={() => {
                  setFormMsg("");
                  setShowAddItemModal(true);
                }}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
              >
                <span>➕</span>
                <span>إضافة سلعة</span>
              </button>
            </div>
            {loading ? (
              <div className="text-center py-8 text-slate-400 text-xs">جاري التحميل...</div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">لا توجد سلع مضافة حتى الآن</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((item) => (
                  <div key={item.id} className="bg-slate-900 border border-slate-700/80 rounded-xl p-3 flex gap-3">
                    <div className="w-20 h-20 bg-slate-800 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">📦</span>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-white line-clamp-1">{item.title}</h4>
                          <span className="text-[10px] bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded border border-cyan-800">
                            {item.category?.name}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-400 font-semibold mt-1">{item.price || "غير محدد"}</p>
                        <p className="text-xs text-slate-400 mt-0.5">📞 البائع: {item.sellerPhone}</p>
                        {item.location && <p className="text-xs text-slate-400">📍 المكان: {item.location}</p>}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800 pt-2 mt-2">
                        <span>👁️ {item.viewsCount} | 💬 {item.inquiriesCount} طلب</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleSold(item.id, item.isSold)}
                            className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                              item.isSold
                                ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                : "bg-amber-950 text-amber-400 border border-amber-800 hover:bg-amber-900"
                            }`}
                          >
                            {item.isSold ? "إعادة كـ متاح 🔄" : "تأشير كمبيوع 🏷️"}
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="text-red-400 hover:text-red-300 font-bold"
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

        {/* Tab 2: Categories Management List */}
        {activeTab === "categories" && (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-300">الأقسام المتاحة (حسب التسلسل):</h3>
              <button
                onClick={() => {
                  setEditingCatId(null);
                  setCatName("");
                  setCatImageUrl("");
                  setCatSortOrder(0);
                  setCatMsg("");
                  setShowAddCatModal(true);
                }}
                className="bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
              >
                <span>➕</span>
                <span>إضافة قسم جديد</span>
              </button>
            </div>

            {categories.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">لا توجد أقسام مضافة بعد</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="bg-slate-900 border border-slate-700/80 rounded-xl p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center border border-slate-700">
                        {cat.imageUrl ? (
                          <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl">🏷️</span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-white">{cat.name}</h4>
                          <span className="bg-purple-950 text-purple-400 border border-purple-800 text-[10px] px-2 py-0.5 rounded font-mono">
                            تسلسل: {cat.sortOrder}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500">تاريخ الإنشاء: {new Date(cat.createdAt).toLocaleDateString("ar-EG")}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditCategory(cat)}
                        className="bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-xs px-3 py-1.5 rounded-lg font-semibold"
                      >
                        ✏️ تعديل
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="bg-slate-800 hover:bg-slate-700 text-red-400 border border-slate-700 text-xs px-3 py-1.5 rounded-lg font-semibold"
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

        {/* Tab 3: Inquiries & Buyers */}
        {activeTab === "inquiries" && (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 space-y-4">
            <h3 className="font-bold text-sm text-slate-300">سجل طلبات المراسلة والشراية:</h3>
            {inquiries.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">لا توجد طلبات شراية مسجلة بعد</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right text-slate-300">
                  <thead className="bg-slate-900 text-slate-400">
                    <tr>
                      <th className="p-3">اسم المشتري</th>
                      <th className="p-3">رقم الهاتف</th>
                      <th className="p-3">العنوان</th>
                      <th className="p-3">السلعة المطلوبة</th>
                      <th className="p-3">حالة التبليغ</th>
                      <th className="p-3 text-center">إجراء التبليغ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {inquiries.map((inq) => (
                      <tr key={inq.id} className="hover:bg-slate-700/30">
                        <td className="p-3 font-bold text-white">{inq.buyerName}</td>
                        <td className="p-3 font-mono text-cyan-400">{inq.buyerPhone}</td>
                        <td className="p-3 text-slate-400">{inq.buyerAddress || "غير محدد"}</td>
                        <td className="p-3 text-emerald-400 font-semibold">{inq.item?.title}</td>
                        <td className="p-3">
                          {inq.notifiedSeller ? (
                            <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded text-[10px]">
                              تم التبليغ ✅
                            </span>
                          ) : (
                            <span className="bg-amber-950 text-amber-400 border border-amber-800 px-2 py-0.5 rounded text-[10px]">
                              لم يُبلغ بعد ⏳
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleNotifySeller(inq.id)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1 mx-auto"
                          >
                            <span>📲</span>
                            <span>تبليغ البائع</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 🟢 Modal 1: Add Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAddItemModal(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-white text-xl p-1"
            >
              ✕
            </button>

            <h3 className="font-bold text-base text-white mb-4 flex items-center gap-2">
              <span>🚀</span>
              <span>إضافة منشور سلعة جديدة للمعرض</span>
            </h3>

            {formMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold text-center mb-4 ${
                  formMsg.includes("بنجاح")
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                    : "bg-red-950 text-red-300 border border-red-800"
                }`}
              >
                {formMsg}
              </div>
            )}

            <form onSubmit={handleCreateItem} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">اسم / عنوان السلعة *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: طابعة ليتر ملونة / بايسكل جبلي 26"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">اختر القسم *</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
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
                    <label className="block font-semibold text-cyan-400 mb-1">اسم القسم الجديد *</label>
                    <input
                      type="text"
                      placeholder="مثال: أجهزة رياضية"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="w-full bg-slate-900 border border-cyan-500 rounded-xl px-4 py-2.5 text-white focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">سعر السلعة</label>
                  <input
                    type="text"
                    placeholder="مثال: 50,000 دينار / 100$"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">المنطقة / المكان</label>
                  <input
                    type="text"
                    placeholder="مثال: بغداد - حي الجامعة"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">رقم هاتف البائع *</label>
                <input
                  type="tel"
                  required
                  placeholder="077xxxxxxxx"
                  value={sellerPhone}
                  onChange={(e) => setSellerPhone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">صورة السلعة (رفع مباشر من الهاتف مع ضغط R2)</label>
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer bg-slate-900 border border-cyan-500/50 hover:border-cyan-500 rounded-xl p-3 text-center transition flex items-center justify-center gap-2">
                    <span className="text-base">📸</span>
                    <span className="font-semibold text-cyan-300">
                      {uploadingItemImg ? "جاري تقليل حجم الصورة ورفعها لـ R2..." : "اختر صورة السلعة من الهاتف..."}
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
                    <div className="relative w-full h-32 bg-slate-900 rounded-xl overflow-hidden border border-slate-700 flex items-center justify-center">
                      <img src={imageUrl} alt="معاينة السلعة" className="w-full h-full object-cover" />
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
                  className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-purple-600/30 text-sm"
                >
                  {submitting ? "جاري النشر..." : "🚀 نشر السلعة الآن"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold px-4 py-3 rounded-xl text-sm"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🟣 Modal 2: Add / Edit Category Modal */}
      {showAddCatModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setShowAddCatModal(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-white text-xl p-1"
            >
              ✕
            </button>

            <h3 className="font-bold text-base text-pink-400 mb-4 flex items-center gap-2">
              <span>🏷️</span>
              <span>{editingCatId ? "تعديل بيانات القسم" : "إضافة قسم جديد للمعرض"}</span>
            </h3>

            {catMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold text-center mb-4 ${
                  catMsg.includes("بنجاح")
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                    : "bg-red-950 text-red-300 border border-red-800"
                }`}
              >
                {catMsg}
              </div>
            )}

            <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">اسم القسم *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: طابعات / بايسكلات / بيوت"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">صورة القسم (رفع من الهاتف لـ R2)</label>
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer bg-slate-900 border border-pink-500/50 hover:border-pink-500 rounded-xl p-3 text-center transition flex items-center justify-center gap-2">
                    <span className="text-base">📱</span>
                    <span className="font-semibold text-pink-300">
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
                    <div className="relative w-full h-24 bg-slate-900 rounded-xl overflow-hidden border border-slate-700 flex items-center justify-center">
                      <img src={catImageUrl} alt="معاينة القسم" className="w-full h-full object-cover" />
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
                <label className="block font-semibold text-slate-300 mb-1">تسلسل / ترتيب الظهور (رقم)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={catSortOrder}
                  onChange={(e) => setCatSortOrder(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-pink-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">الأرقام الأصغر تصدر أولاً (مثال: 1 ثم 2 ثم 3)</span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={catSubmitting || uploadingCatImg}
                  className="flex-1 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition shadow-lg shadow-pink-600/30 text-sm"
                >
                  {catSubmitting ? "جاري الحفظ..." : editingCatId ? "حفظ التعديلات" : "إضافة القسم الآن"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCatModal(false)}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-sm"
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
