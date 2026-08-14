"use client";

import { useEffect, useState, useRef } from "react";

type RegionHit = { id: string; name: string; deliveryPrice?: string };

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Edit states
  const [phone, setPhone] = useState("");
  const [landmark, setLandmark] = useState("");
  const [regionQuery, setRegionQuery] = useState("");
  const [regionHits, setRegionHits] = useState<RegionHit[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<RegionHit | null>(null);
  const [deliveryPrice, setDeliveryPrice] = useState<number>(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const regionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    // جلب بيانات الملف الشخصي من المتصفح (والتي تم تخزينها عند إتمام أول طلبية)
    const storedProfile = localStorage.getItem("kse_user_profile");
    if (storedProfile) {
      setProfile(JSON.parse(storedProfile));
    }
  }, []);

  const handleEditClick = () => {
    if (profile) {
      setPhone(profile.phone || "");
      setLandmark(profile.landmark || "");
      setRegionQuery(profile.regionName || "");
      if (profile.regionId) {
        setSelectedRegion({
          id: profile.regionId,
          name: profile.regionName,
          deliveryPrice: String(profile.deliveryPrice || 0)
        });
        setDeliveryPrice(Number(profile.deliveryPrice || 0));
      }
    }
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSave = () => {
    if (!selectedRegion) {
      alert("الرجاء اختيار منطقة صحيحة من القائمة.");
      return;
    }
    if (!phone) {
      alert("الرجاء إدخال رقم الهاتف.");
      return;
    }

    const updatedProfile = {
      ...profile,
      phone,
      landmark,
      regionName: selectedRegion.name,
      regionId: selectedRegion.id,
      deliveryPrice: deliveryPrice
    };

    localStorage.setItem("kse_user_profile", JSON.stringify(updatedProfile));
    setProfile(updatedProfile);
    setIsEditing(false);
  };

  // Autocomplete logic
  useEffect(() => {
    const q = regionQuery.trim();
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (q.length < 2 || selectedRegion) {
      setRegionHits([]);
      return;
    }

    searchTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const r = await fetch(`/api/regions/search?q=${encodeURIComponent(q)}`);
          const j = (await r.json()) as { regions?: RegionHit[] };
          setRegionHits(j.regions ?? []);
        } catch {
          setRegionHits([]);
        }
      })();
    }, 280);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [regionQuery, selectedRegion]);

  if (!mounted) return <div className="p-8 text-center text-slate-500">جاري التحميل...</div>;

  return (
    <div className="space-y-4 pb-20 px-2">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-black text-slate-800">الملف الشخصي</h1>
        {!isEditing && profile && (
          <button 
            onClick={handleEditClick}
            className="text-xs font-bold bg-green-50 text-green-700 px-3 py-1.5 rounded-xl hover:bg-green-100 transition active:scale-95"
          >
            تعديل البيانات
          </button>
        )}
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

      {profile && !isEditing && (
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

      {isEditing && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden p-5 space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">رقم الهاتف</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-green-100 focus:border-green-400 transition"
              dir="ltr"
            />
          </div>

          <div className="relative">
            <label className="block text-sm font-bold text-slate-700 mb-2">المنطقة</label>
            {selectedRegion ? (
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
                <span className="text-base font-black text-green-900">{selectedRegion.name}</span>
                <button 
                  type="button"
                  onClick={() => {
                    setSelectedRegion(null);
                    setRegionQuery("");
                    setDeliveryPrice(0);
                    setTimeout(() => regionInputRef.current?.focus(), 100);
                  }}
                  className="text-xs font-bold text-green-700 underline bg-white px-3 py-1 rounded-full shadow-sm"
                >
                  تغيير
                </button>
              </div>
            ) : (
              <>
                <input
                  ref={regionInputRef}
                  type="text"
                  value={regionQuery}
                  onChange={(e) => setRegionQuery(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-green-100 focus:border-green-400 transition"
                  placeholder="ابحث عن منطقتك..."
                />
                {regionHits.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 rounded-xl border border-green-200 bg-white shadow-xl p-2 max-h-40 overflow-auto">
                    <ul className="space-y-1">
                      {regionHits.map((h) => (
                        <li key={h.id}>
                          <button
                            type="button"
                            className="w-full rounded-lg px-3 py-2 text-end text-sm font-bold text-slate-800 hover:bg-green-50 transition"
                            onClick={() => {
                              setSelectedRegion(h);
                              setDeliveryPrice(Number(h.deliveryPrice || 0));
                              setRegionQuery(h.name);
                              setRegionHits([]);
                            }}
                          >
                            {h.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">أقرب نقطة دالة</label>
            <textarea
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-green-100 focus:border-green-400 transition"
              rows={2}
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              onClick={handleSave}
              className="flex-1 bg-green-600 text-white font-black py-3 rounded-xl hover:bg-green-700 transition active:scale-95"
            >
              حفظ التعديلات
            </button>
            <button 
              onClick={handleCancel}
              className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-xl hover:bg-slate-200 transition active:scale-95"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
