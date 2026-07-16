"use client";

import { useState, useEffect } from "react";
import { ad } from "@/lib/admin-ui";
import { getBackgroundsAction, addBackgroundAction, deleteBackgroundAction } from "./background-actions";

export function AdminBackgroundsSettings() {
  const [backgrounds, setBackgrounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [bgName, setBgName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeBgUrl, setActiveBgUrl] = useState<string | null>(null);

  // جلب الخلفيات ومعرفة الخلفية المفعلة حالياً للجهاز
  const fetchBackgrounds = async () => {
    setLoading(true);
    const res = await getBackgroundsAction();
    if (res.ok && res.backgrounds) {
      setBackgrounds(res.backgrounds);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBackgrounds();
    setActiveBgUrl(localStorage.getItem("kse_user_background_url"));
  }, []);

  // تفعيل الخلفية للجهاز الحالي
  const handleSelectBackground = (url: string) => {
    localStorage.setItem("kse_user_background_url", url);
    setActiveBgUrl(url);
    // إرسال حدث لتنبيه المكون StaticBackground بالتحديث الفوري
    window.dispatchEvent(new CustomEvent("kse_background_changed"));
  };

  // إلغاء تفعيل الخلفية
  const handleClearBackground = () => {
    localStorage.removeItem("kse_user_background_url");
    setActiveBgUrl(null);
    window.dispatchEvent(new CustomEvent("kse_background_changed"));
  };

  // رفع خلفية جديدة
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bgName || !selectedFile) {
      alert("الرجاء إدخال اسم الخلفية واختيار ملف الصورة");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("name", bgName);
    formData.append("file", selectedFile);

    const res = await addBackgroundAction(formData);
    setUploading(false);

    if (res.error) {
      alert(res.error);
    } else {
      alert("تم رفع الخلفية بنجاح");
      setBgName("");
      setSelectedFile(null);
      // إعادة تعيين حقل الملف في الواجهة
      const fileInput = document.getElementById("bg-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      fetchBackgrounds();
    }
  };

  // حذف خلفية
  const handleDelete = async (id: string, url: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الخلفية نهائياً؟")) return;

    const res = await deleteBackgroundAction(id);
    if (res.error) {
      alert(res.error);
    } else {
      alert("تم الحذف بنجاح");
      // إذا كانت هي المفعلة حالياً نقوم بإزالتها
      if (activeBgUrl === url) {
        handleClearBackground();
      }
      fetchBackgrounds();
    }
  };

  return (
    <div className="space-y-6">
      {/* قسم الرفع */}
      <form onSubmit={handleUpload} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
        <h3 className="text-xs font-black text-slate-800">رفع خلفية جديدة</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase">اسم الخلفية (مثال: سماء، جبال، هادئة)</label>
            <input
              type="text"
              value={bgName}
              onChange={(e) => setBgName(e.target.value)}
              placeholder="اسم الخلفية"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none transition"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase">ملف الصورة</label>
            <input
              id="bg-file-input"
              type="file"
              accept="image/*"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 cursor-pointer"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 text-sm shadow-md"
        >
          {uploading ? "جاري الرفع وضغط الصورة..." : "رفع الخلفية وحفظها"}
        </button>
      </form>

      {/* قسم التحكم بالخلفية المفعلة حالياً للجهاز */}
      <div className="flex items-center justify-between p-3.5 bg-sky-50 border border-sky-100 rounded-2xl">
        <div>
          <h4 className="text-xs font-black text-sky-900">التحكم بالخلفية الحالية لجهازك</h4>
          <p className="text-[10px] text-sky-700 mt-0.5">
            {activeBgUrl ? "لديك خلفية مخصصة مفعلة حالياً على هذا الجهاز." : "تستخدم حالياً الخلفية البيضاء الافتراضية للنظام."}
          </p>
        </div>
        {activeBgUrl && (
          <button
            onClick={handleClearBackground}
            className="px-3 py-1.5 bg-white text-xs font-black text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-xl transition"
          >
            إلغاء التفعيل والعودة للون الأبيض
          </button>
        )}
      </div>

      {/* معرض الخلفيات */}
      <div className="space-y-2">
        <h3 className="text-xs font-black text-slate-500 px-1">الخلفيات المتوفرة بالنظام</h3>
        
        {loading ? (
          <p className="text-xs font-bold text-center text-slate-400 py-6 animate-pulse">جاري تحميل المعرض...</p>
        ) : backgrounds.length === 0 ? (
          <p className="text-xs font-bold text-center text-slate-400 py-6">لا توجد خلفيات مرفوعة حالياً. ابدأ برفع أول خلفية أعلاه.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {backgrounds.map((bg) => {
              const isSelected = activeBgUrl === bg.imageUrl;
              return (
                <div
                  key={bg.id}
                  className={`relative rounded-2xl overflow-hidden border-2 transition-all duration-300 flex flex-col group ${
                    isSelected ? "border-amber-500 shadow-md ring-2 ring-amber-100" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {/* معاينة الصورة */}
                  <div className="aspect-video w-full relative bg-slate-100 overflow-hidden">
                    <img
                      src={bg.imageUrl}
                      alt={bg.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {isSelected && (
                      <span className="absolute top-2 right-2 bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm">
                        مفعلة لحسابك ✓
                      </span>
                    )}
                  </div>

                  {/* اسم وأزرار التحكم */}
                  <div className="p-3 bg-white flex-1 flex flex-col justify-between gap-2">
                    <span className="text-xs font-black text-slate-800 truncate block">{bg.name}</span>
                    
                    <div className="flex gap-1.5 mt-1">
                      <button
                        onClick={() => handleSelectBackground(bg.imageUrl)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                          isSelected
                            ? "bg-slate-100 text-slate-500 border border-slate-200 cursor-default"
                            : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                        }`}
                        disabled={isSelected}
                      >
                        تفعيل
                      </button>
                      <button
                        onClick={() => handleDelete(bg.id, bg.imageUrl)}
                        className="p-1.5 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 rounded-lg transition"
                        title="حذف الخلفية نهائياً"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
