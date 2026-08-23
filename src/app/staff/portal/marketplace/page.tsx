"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function StaffMarketplacePortal() {
  const searchParams = useSearchParams();
  const se = searchParams.get("se") || "";
  const exp = searchParams.get("exp") || "";
  const s = searchParams.get("s") || "";
  const authQ = `se=${se}&exp=${exp}&s=${s}`;

  const [activeTab, setActiveTab] = useState<"items" | "inquiries" | "add_item">("items");
  const [stats, setStats] = useState<any>({ totalItems: 0, totalViews: 0, totalInquiries: 0 });
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Add Item Form State
  const [title, setTitle] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState("");

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
        setActiveTab("items");
      } else {
        setFormMsg(data.error || "فشل نشر السلعة");
      }
    } catch (err) {
      setFormMsg("حدث خطأ في الاتصال");
    } finally {
      setSubmitting(false);
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
              <p className="text-xs text-slate-400">إضافة منشورات ومتابعة طلبات الشراية والتبليغ</p>
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

        {/* Tabs */}
        <div className="flex gap-2 bg-slate-800 p-1.5 rounded-2xl border border-slate-700">
          <button
            onClick={() => setActiveTab("items")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === "items" ? "bg-cyan-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            📋 قائمة السلع ({items.length})
          </button>
          <button
            onClick={() => setActiveTab("inquiries")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === "inquiries" ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            👥 الشراية وطلبات المراسلة ({inquiries.length})
          </button>
          <button
            onClick={() => setActiveTab("add_item")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === "add_item" ? "bg-purple-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            ➕ إضافة منشور سلعة
          </button>
        </div>

        {/* Tab 1: Items List */}
        {activeTab === "items" && (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 space-y-3">
            <h3 className="font-bold text-sm text-slate-300">السلع المنشورة بالمعرض:</h3>
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
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-red-400 hover:text-red-300 font-bold"
                        >
                          🗑️ حذف
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Inquiries & Buyers */}
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

        {/* Tab 3: Add Item Form */}
        {activeTab === "add_item" && (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-2xl mx-auto space-y-4">
            <h3 className="font-bold text-base text-white">إضافة منشور جديد للمعرض</h3>

            {formMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold text-center ${
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
                        {c.name}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <label className="block font-semibold text-slate-300 mb-1">اسم البائع / المجهز</label>
                  <input
                    type="text"
                    placeholder="اسم البائع الاصلي (اختياري)"
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">رابط صورة السلعة</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-purple-600/30 text-sm mt-4"
              >
                {submitting ? "جاري النشر..." : "🚀 نشر السلعة في المعرض الان"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
