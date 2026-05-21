"use client";

import { useState } from "react";
import { deleteSlide, toggleSlideStatus, bulkDeleteSlides, updateSlidesOrder } from "../actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Slide {
  id: string;
  imageUrl: string;
  linkUrl: string;
  active: boolean;
  sequence: number;
}

export function SlideManager({ initialSlides }: { initialSlides: Slide[] }) {
  const [slides, setSlides] = useState(initialSlides);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const router = useRouter();

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
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
            <div className="absolute top-4 right-4 z-10">
                <input
                    type="checkbox"
                    checked={selectedIds.includes(slide.id)}
                    onChange={() => toggleSelect(slide.id)}
                    className="w-5 h-5 rounded-lg border-2 border-white/50 bg-black/20 accent-violet-600 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                />
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
              <p className="text-[10px] font-bold text-slate-400 truncate">{slide.linkUrl || "لا يوجد رابط"}</p>
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
