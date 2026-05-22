"use client";

import { useState } from "react";
import { deleteSlide, toggleSlideStatus, bulkDeleteSlides, updateSlidesOrder, updateSlide } from "../actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Slide {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  active: boolean;
  sequence: number;
}

export function SlideManager({ initialSlides }: { initialSlides: Slide[] }) {
  const [slides, setSlides] = useState(initialSlides);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [editingSlide, setEditingSlide] = useState<Slide | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const router = useRouter();

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingSlide) return;
    setIsUpdating(true);
    try {
      const formData = new FormData(e.currentTarget);
      const res = await updateSlide(editingSlide.id, formData);
      if (res.success) {
        toast.success("تم التحديث بنجاح");
        setEditingSlide(null);
        router.refresh();
      } else {
        toast.error(res.error || "فشل التحديث");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`هل أنت متأكد من حذف ${selectedIds.length} سلايد؟`)) return;
    try {
      await bulkDeleteSlides(selectedIds);
      toast.success("تم الحذف بنجاح");
      setSelectedIds([]);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("index", index.toString());
    setIsDragging(true);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    setIsDragging(false);
    const dragIndex = parseInt(e.dataTransfer.getData("index"));
    if (dragIndex === dropIndex) return;

    const newSlides = [...slides];
    const [movedSlide] = newSlides.splice(dragIndex, 1);
    newSlides.splice(dropIndex, 0, movedSlide);

    setSlides(newSlides);

    try {
      await updateSlidesOrder(newSlides.map(s => s.id));
      toast.success("تم تحديث الترتيب");
    } catch (error: any) {
      toast.error(error.message);
      setSlides(initialSlides);
    }
  };

  return (
    <div className="space-y-6">
      {editingSlide && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">تعديل السلايد</h3>
              <button onClick={() => setEditingSlide(null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-500 transition">✕</button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 mr-2">عنوان السلايد</label>
                <input name="title" defaultValue={editingSlide.title} placeholder="مثال: عرض الصيف" className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold text-sm" />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-slate-500">الصورة الحالية</label>
                <img src={editingSlide.imageUrl} className="w-full h-32 object-cover rounded-2xl border" alt="" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 mr-2">تغيير الصورة (ملف)</label>
                  <input name="imageFile" type="file" accept="image/*" className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold text-xs" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 mr-2">أو رابط URL جديد</label>
                  <input name="imageUrl" defaultValue={editingSlide.imageUrl} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold text-sm" />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 mr-2">رابط التوجيه</label>
                <input name="linkUrl" defaultValue={editingSlide.linkUrl} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold text-sm" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 mr-2">التسلسل (الترتيب)</label>
                <input name="sequence" type="number" defaultValue={editingSlide.sequence} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold text-sm" />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 h-14 bg-violet-600 text-white rounded-2xl font-black hover:bg-violet-700 transition disabled:opacity-50"
                >
                  {isUpdating ? "جاري الحفظ..." : "حفظ التغييرات"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingSlide(null)}
                  className="flex-1 h-14 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black hover:bg-slate-200 transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedIds(selectedIds.length === slides.length ? [] : slides.map(s => s.id))}
            className="text-xs font-bold text-violet-600"
          >
            {selectedIds.length === slides.length ? "إلغاء تحديد الكل" : "تحديد الكل"}
          </button>
          {selectedIds.length > 0 && (
            <span className="text-xs font-bold text-slate-500">
              تم تحديد {selectedIds.length}
            </span>
          )}
        </div>
        {selectedIds.length > 0 && (
          <button
            onClick={handleBulkDelete}
            className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl font-black text-xs hover:bg-rose-100 transition"
          >
            حذف المحدد
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, index)}
            className={`bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden border transition-all ${
              selectedIds.includes(slide.id) ? 'border-violet-500 ring-2 ring-violet-500/20' : 'border-slate-100 dark:border-slate-800'
            } shadow-sm group relative cursor-move ${isDragging ? 'opacity-50' : ''}`}
          >
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                <input
                    type="checkbox"
                    checked={selectedIds.includes(slide.id)}
                    onChange={() => toggleSelect(slide.id)}
                    className="w-5 h-5 rounded-lg border-2 border-white/50 bg-black/20 accent-violet-600 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingSlide(slide);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/90 dark:bg-slate-800/90 shadow-lg text-violet-600 hover:scale-110 transition"
                  title="تعديل السلايد"
                >
                  ✏️
                </button>
            </div>

            <div className="aspect-[21/9] relative bg-slate-100">
              <img src={slide.imageUrl} alt="" className="w-full h-full object-cover" />
              <div className="absolute top-2 left-2 flex gap-2">
                <span className="px-3 py-1 bg-black/50 backdrop-blur-md text-white text-[10px] font-black rounded-full">
                  #{index + 1}
                </span>
                {!slide.active && (
                  <span className="px-3 py-1 bg-rose-500 text-white text-[10px] font-black rounded-full">
                    متوقف
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex flex-col">
                <p className="text-sm font-black text-slate-800 dark:text-white truncate">{slide.title || "بدون عنوان"}</p>
                <p className="text-[10px] font-bold text-slate-400 truncate">الرابط: {slide.linkUrl || "لا يوجد"}</p>
                <p className="text-[10px] font-bold text-slate-400">التسلسل: {slide.sequence}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (confirm("هل أنت متأكد من الحذف؟")) {
                        await deleteSlide(slide.id);
                        router.refresh();
                    }
                  }}
                  className="flex-1 py-2 bg-rose-50 text-rose-600 rounded-xl font-black text-xs hover:bg-rose-100 transition"
                >
                  حذف
                </button>
                <button
                  onClick={async () => {
                    await toggleSlideStatus(slide.id, slide.active);
                    router.refresh();
                  }}
                  className={`flex-1 py-2 rounded-xl font-black text-xs transition ${slide.active ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}
                >
                  {slide.active ? 'إيقاف' : 'تفعيل'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {slides.length === 0 && (
        <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
            <p className="text-slate-400 font-bold">لا يوجد أي سلايدات حالياً</p>
        </div>
      )}
    </div>
  );
}
