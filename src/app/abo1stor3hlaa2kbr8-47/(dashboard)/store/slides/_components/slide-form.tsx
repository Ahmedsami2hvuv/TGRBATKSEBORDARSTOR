"use client";

import { useState } from "react";
import { createSlide } from "../actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface SlideFormProps {
  categories?: { id: string; name: string }[];
  branches?: { id: string; name: string }[];
}

export function SlideForm({ categories = [], branches = [] }: SlideFormProps) {
  const [loading, setLoading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      formData.set("linkUrl", linkUrl);
      const result = await createSlide(formData);
      if (result.success) {
        toast.success("تمت إضافة السلايد بنجاح");
        (document.getElementById("slide-form") as HTMLFormElement)?.reset();
        setLinkUrl("");
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
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 mr-2">عنوان السلايد (اختياري)</label>
          <input
            name="title"
            placeholder="مثال: عرض الصيف"
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 mr-2">تحميل صورة</label>
          <input
            name="imageFile"
            type="file"
            accept="image/*"
            className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 mr-2">أو رابط URL للصورة</label>
          <input
            name="imageUrl"
            placeholder="رابط الصورة المباشر"
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-400 mr-2">رابط التوجيه عند الضغط</label>
            <select
              onChange={(e) => {
                if (e.target.value) setLinkUrl(e.target.value);
              }}
              className="text-[9px] font-bold text-violet-600 bg-violet-50 dark:bg-violet-900/30 px-2 py-0.5 rounded-lg border border-violet-200 dark:border-violet-800 outline-none"
            >
              <option value="">اختر قسم أو فرع...</option>
              {categories.length > 0 && (
                <optgroup label="الأقسام">
                  {categories.map(c => (
                    <option key={c.id} value={`/store/c/${c.id}`}>قسم: {c.name}</option>
                  ))}
                </optgroup>
              )}
              {branches.length > 0 && (
                <optgroup label="الفروع">
                  {branches.map(b => (
                    <option key={b.id} value={`/store/b/${b.id}`}>فرع: {b.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <input
            name="linkUrl"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://... أو اختر قسم/فرع"
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold text-sm"
          />
        </div>

        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1 w-20">
            <label className="text-[10px] font-bold text-slate-400 mr-2">الترتيب</label>
            <input
              name="sequence"
              type="number"
              placeholder="0"
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold text-sm"
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
        * يمكن اختيار قسم أو فرع من القائمة ليتم توجيه الزبون إليه تلقائياً عند الضغط على السلايد.
      </p>
    </div>
  );
}
