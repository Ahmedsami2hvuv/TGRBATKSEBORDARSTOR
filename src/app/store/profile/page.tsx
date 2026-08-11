"use client";

import { useEffect, useState } from "react";

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // جلب بيانات الملف الشخصي من المتصفح (والتي تم تخزينها عند إتمام أول طلبية)
    const storedProfile = localStorage.getItem("kse_user_profile");
    if (storedProfile) {
      setProfile(JSON.parse(storedProfile));
    }
  }, []);

  if (!mounted) return <div className="p-8 text-center text-slate-500">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-slate-800">الملف الشخصي</h1>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 text-center">
        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 border-4 border-white shadow-md">
          👤
        </div>
        <h2 className="text-xl font-black text-slate-800 mb-1">
          {profile ? "زبوننا المميز" : "زائر جديد"}
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          {profile ? "تم حفظ بياناتك محلياً لسهولة الطلب في المرات القادمة" : "قم بإجراء أول طلبية لك ليتم حفظ بياناتك تلقائياً هنا"}
        </p>
      </div>

      {profile && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-400 mb-1">رقم الهاتف</h3>
            <p className="text-lg font-black text-slate-800">{profile.phone}</p>
          </div>
          <div className="h-px bg-slate-50 w-full"></div>
          <div>
            <h3 className="text-sm font-bold text-slate-400 mb-1">المنطقة الرئيسية</h3>
            <p className="text-lg font-black text-slate-800">{profile.regionName}</p>
          </div>
          <div className="h-px bg-slate-50 w-full"></div>
          <div>
            <h3 className="text-sm font-bold text-slate-400 mb-1">أقرب نقطة دالة (العنوان التفصيلي)</h3>
            <p className="text-lg font-black text-slate-800">{profile.landmark || "لم يتم تحديد نقطة دالة"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
