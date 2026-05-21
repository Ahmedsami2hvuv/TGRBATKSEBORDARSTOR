"use client";

import { useState } from "react";
import { createSlide } from "../actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function SlideForm() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      const result = await createSlide(formData);
      if (result.success) {
        toast.success("تمت إضافة السلايد بنجاح");
        (document.getElementById("slide-form") as HTMLFormElement)?.reset();
        router.refresh();
      } else {
        toast.error(result.error || "حدث خطأ ما");
      }
    } catch (error: any) {
      toast.error(error.message || "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
      <h2 className="text-xl font-black mb-6 flex items-center gap-2">
        <span>➕</span> إضافة سلايد جديد
      </h2>
      <form
        id="slide-form"
        action={handleSubmit}
        encType="multipart/form-data"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 mr-2">تحميل صورة</label>
          <input
            name="imageFile"
            type="file"
            accept="image/*"
            className="p-2 rounded-xl bg-slate-50 border-none font-bold text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 mr-2">أو رابط URL</label>
          <input
            name="imageUrl"
            placeholder="رابط الصورة"
            className="p-3 rounded-xl bg-slate-50 border-none font-bold text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 mr-2">رابط التوجيه (اختياري)</label>
          <input
            name="linkUrl"
            placeholder="https://..."
            className="p-3 rounded-xl bg-slate-50 border-none font-bold text-sm"
          />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1 w-20">
            <label className="text-[10px] font-bold text-slate-400 mr-2">الترتيب</label>
            <input
              name="sequence"
              type="number"
              placeholder="0"
              className="p-3 rounded-xl bg-slate-50 border-none font-bold text-sm"
            />
          </div>
          <button
            disabled={loading}
            className="flex-1 h-[46px] bg-violet-600 text-white rounded-xl font-black hover:bg-violet-700 transition disabled:opacity-50"
          >
            {loading ? "جاري الحفظ..." : "حفظ السلايد"}
          </button>
        </div>
      </form>
      <p className="text-[10px] text-slate-400 mt-2 font-bold">
        * إذا كانت الصورة كبيرة جداً وفشل الرفع، جرب استخدام رابط مباشر أو تقليل حجم الصورة.
      </p>
    </div>
  );
}
