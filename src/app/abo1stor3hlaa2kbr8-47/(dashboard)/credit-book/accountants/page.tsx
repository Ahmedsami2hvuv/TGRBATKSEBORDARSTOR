"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  getAccountants,
  createAccountantLink,
  revokeAccountantAccess
} from "../actions";

export default function CreditBookAccountantsPage() {
  const [accountants, setAccountants] = useState<any[]>([]);
  const [newAccName, setNewAccName] = useState("");
  const [newAccPhone, setNewAccPhone] = useState("");
  const [isCreatingAcc, setIsCreatingAcc] = useState(false);
  const [accError, setAccError] = useState("");
  const [isLoadingList, setIsLoadingList] = useState(true);

  const loadAccountantsList = async () => {
    setIsLoadingList(true);
    try {
      const list = await getAccountants();
      setAccountants(list);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    loadAccountantsList();
  }, []);

  const getLoginUrl = (token: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/abo1stor3hlaa2kbr8-47/credit-book/login?token=${token}`;
    }
    return `/abo1stor3hlaa2kbr8-47/credit-book/login?token=${token}`;
  };

  const handleSendWhatsAppAcc = (acc: any) => {
    const loginUrl = getLoginUrl(acc.token);
    const msg = `مرحباً ${acc.name}،\nلقد تم منحك صلاحية الوصول لدفتر الديون العام كمحاسب.\n\nرابط تسجيل الدخول الآمن الخاص بك (صالح لمدة 7 أيام):\n${loginUrl}\n\nيرجى عدم مشاركة هذا الرابط مع أي شخص آخر.`;
    
    let num = acc.phone.replace(/\D/g, "");
    if (num.startsWith("07")) {
      num = "964" + num.substring(1);
    } else if (num.startsWith("7") && num.length === 10) {
      num = "964" + num;
    }
    
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${num}&text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleCreateAccountant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim() || !newAccPhone.trim()) {
      setAccError("الرجاء إدخال الاسم ورقم الهاتف بالكامل");
      return;
    }
    setIsCreatingAcc(true);
    setAccError("");
    const res = await createAccountantLink(newAccName, newAccPhone);
    setIsCreatingAcc(false);
    if (res.success) {
      setNewAccName("");
      setNewAccPhone("");
      loadAccountantsList();
      alert("تمت إضافة المحاسب وتوليد رابط الوصول بنجاح!");
    } else {
      setAccError(res.error || "حدث خطأ ما");
    }
  };

  const handleRevokeAccountant = async (id: string) => {
    if (!confirm("هل أنت متأكد من إلغاء صلاحية هذا المحاسب؟ لن يتمكن من الدخول للنظام باستخدام هذا الرابط بعد الآن.")) {
      return;
    }
    const res = await revokeAccountantAccess(id);
    if (res.success) {
      loadAccountantsList();
      alert("تم إلغاء صلاحية الوصول بنجاح.");
    } else {
      alert(res.error || "فشل إلغاء صلاحية الوصول");
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8" dir="rtl">
      <div className="mb-6">
        <Link
          href="/abo1stor3hlaa2kbr8-47/credit-book"
          className="text-xs font-black text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1 mb-2"
        >
          🔀 العودة لدفتر الديون
        </Link>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          🔑 روابط وصول المحاسبين (إدارة حسابات الدخول)
        </h1>
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm p-6 space-y-6">
        {/* نموذج إضافة محاسب جديد */}
        <form onSubmit={handleCreateAccountant} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
          <h4 className="text-sm font-black text-slate-700">➕ إضافة محاسب جديد وتوليد رابط وصول مخصص</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">اسم المحاسب (يظهر عند إضافة/تعديل المعاملات)</label>
              <input
                type="text"
                required
                placeholder="مثال: علي محمد"
                value={newAccName}
                onChange={(e) => setNewAccName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-indigo-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">رقم الهاتف (لإرساله مباشرة عبر الواتساب)</label>
              <input
                type="text"
                required
                placeholder="مثال: 07701234567"
                value={newAccPhone}
                onChange={(e) => setNewAccPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-indigo-500 text-left bg-white"
              />
            </div>
          </div>

          {accError && <p className="text-xs font-bold text-rose-600">{accError}</p>}

          <button
            type="submit"
            disabled={isCreatingAcc}
            className="px-5 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50"
          >
            {isCreatingAcc ? "جاري التوليد..." : "توليد رابط الوصول وإرساله 🔑"}
          </button>
        </form>

        {/* جدول المحاسبين */}
        {isLoadingList ? (
          <div className="text-center py-20 text-slate-400 font-bold text-sm">جاري تحميل قائمة المحاسبين...</div>
        ) : accountants.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-bold text-xs">لا يوجد روابط وصول نشطة للمحاسبين حالياً.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-black border-b border-slate-100">
                  <th className="p-4">اسم المحاسب</th>
                  <th className="p-4">رقم الهاتف</th>
                  <th className="p-4">رابط تسجيل الدخول المباشر</th>
                  <th className="p-4">تاريخ الإنشاء</th>
                  <th className="p-4 text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accountants.map((acc: any) => {
                  const loginUrl = getLoginUrl(acc.token);
                  return (
                    <tr key={acc.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-4 font-bold text-slate-800 text-sm">{acc.name}</td>
                      <td className="p-4 text-slate-500 font-semibold text-sm">{acc.phone}</td>
                      <td className="p-4 font-mono text-slate-400 select-all truncate max-w-xs text-xs" title={loginUrl}>
                        {loginUrl}
                      </td>
                      <td className="p-4 text-slate-500 font-medium">
                        {new Date(acc.createdAt).toLocaleDateString("ar-EG")}
                      </td>
                      <td className="p-4 text-left flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(loginUrl);
                            alert("تم نسخ الرابط إلى الحافظة!");
                          }}
                          className="px-3 py-2 font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                          title="نسخ الرابط"
                        >
                          📋 نسخ
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendWhatsAppAcc(acc)}
                          className="px-3 py-2 font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition flex items-center gap-1 border border-emerald-100"
                          title="إرسال رابط الدخول عبر الواتساب"
                        >
                          💬 واتساب
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevokeAccountant(acc.id)}
                          className="px-3 py-2 font-black text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
                          title="إلغاء تفعيل رابط الوصول وحذفه"
                        >
                          🗑️ إلغاء
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
