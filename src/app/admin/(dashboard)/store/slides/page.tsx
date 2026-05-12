import { prisma } from "@/lib/prisma";
import { createSlide, deleteSlide, updateSlide } from "./actions";
import Link from "next/link";

export default async function AdminSlidesPage() {
  const slides = await prisma.storeSlide.findMany({
    orderBy: { sequence: "asc" },
  });

  return (
    <div className="space-y-8" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">إدارة السلايدر</h1>
          <p className="text-slate-500 font-bold">إضافة وتعديل صور السلايدر في واجهة المتجر</p>
        </div>
        <Link href="/admin/store" className="px-4 py-2 bg-slate-100 rounded-xl font-bold text-sm">
          عودة
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
        <h2 className="text-xl font-black mb-6 flex items-center gap-2">
          <span>➕</span> إضافة سلايد جديد
        </h2>
        <form action={createSlide} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <button className="flex-1 h-[46px] bg-violet-600 text-white rounded-xl font-black hover:bg-violet-700 transition">
              حفظ السلايد
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {slides.map((slide) => (
          <div key={slide.id} className="bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm group">
            <div className="aspect-[21/9] relative bg-slate-100">
              <img src={slide.imageUrl} alt="" className="w-full h-full object-cover" />
              <div className="absolute top-2 right-2 flex gap-2">
                <span className="px-3 py-1 bg-black/50 backdrop-blur-md text-white text-[10px] font-black rounded-full">
                  ترتيب: {slide.sequence}
                </span>
                {!slide.active && (
                  <span className="px-3 py-1 bg-rose-500 text-white text-[10px] font-black rounded-full">
                    متوقف
                  </span>
                )}
              </div>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-[10px] font-bold text-slate-400 truncate">{slide.linkUrl || "لا يوجد رابط"}</p>
              <div className="flex gap-2">
                <form action={async (fd) => { "use server"; await deleteSlide(slide.id); }} className="flex-1">
                  <button className="w-full py-2 bg-rose-50 text-rose-600 rounded-xl font-black text-xs hover:bg-rose-100 transition">
                    حذف
                  </button>
                </form>
                <form action={async (fd) => {
                    "use server";
                    const newStatus = !slide.active;
                    const data = new FormData();
                    data.append("imageUrl", slide.imageUrl);
                    data.append("linkUrl", slide.linkUrl);
                    data.append("sequence", slide.sequence.toString());
                    data.append("active", newStatus.toString());
                    await updateSlide(slide.id, data);
                }} className="flex-1">
                  <button className={`w-full py-2 rounded-xl font-black text-xs transition ${slide.active ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {slide.active ? 'إيقاف' : 'تفعيل'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
