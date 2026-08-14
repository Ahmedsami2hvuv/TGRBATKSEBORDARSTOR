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
    <div className="space-y-4 pb-20 px-2">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-black text-slate-800">الملف الشخصي</h1>
      </div>

      <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 flex items-center gap-4">
        <div className="w-16 h-16 shrink-0 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl border-2 border-white shadow-sm">
          👤
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-800 mb-0.5">
            {profile ? "زبوننا المميز" : "زائر جديد"}
          </h2>
          <p className="text-xs text-slate-500 leading-tight">
            {profile ? "تم حفظ بياناتك محلياً لسهولة الطلب" : "قم بإجراء طلبية لحفظ بياناتك هنا"}
          </p>
        </div>
      </div>

      {profile && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
          <div className="p-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-500">رقم الهاتف</h3>
            <p className="text-base font-black text-slate-900" dir="ltr">{profile.phone}</p>
          </div>
          
          <div className="p-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-500">المنطقة</h3>
            <p className="text-base font-black text-slate-900 text-end truncate max-w-[60%]">{profile.regionName}</p>
          </div>
          
          <div className="p-4 flex flex-col gap-1.5 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-500">أقرب نقطة دالة (العنوان التفصيلي)</h3>
            <p className="text-sm font-black text-slate-900 leading-relaxed">{profile.landmark || "لم يتم تحديد نقطة دالة"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
