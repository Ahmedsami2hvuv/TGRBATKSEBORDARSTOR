"use client";

import { useState, useEffect } from "react";
import { cleanupLargeCustomerPhotos } from "../customers/profiles/actions";
import { toast } from "sonner";

export function PhotoCleanupButton() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ processed: 0, compressed: 0, total: 0 });
  const [startFrom, setStartFrom] = useState(0);

  // استرجاع آخر نقطة توقف من المتصفح لكي لا تبدأ من الصفر
  useEffect(() => {
    const saved = localStorage.getItem("photo_cleanup_last_index");
    if (saved) setStartFrom(parseInt(saved));
  }, []);

  const handleCleanup = async () => {
    if (!confirm(`سيتم فحص الصور بدءاً من الرقم (${startFrom}). هل تريد الاستمرار؟`)) return;

    setLoading(true);
    let currentSkip = startFrom;
    const batchSize = 15;
    let totalProcessed = 0;
    let totalCompressed = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        const res = await cleanupLargeCustomerPhotos(currentSkip, batchSize);
        if (!res.ok) {
          toast.error("فشل في إحدى الدفعات: " + res.error);
          break;
        }

        totalProcessed = currentSkip + res.processed;
        totalCompressed += res.compressed;
        hasMore = res.hasMore;

        currentSkip += batchSize;

        // حفظ التقدم لكي إذا انقطع الإنترنت تبدأ من هنا
        localStorage.setItem("photo_cleanup_last_index", currentSkip.toString());

        setStats({
          processed: totalProcessed,
          compressed: totalCompressed,
          total: res.totalCount || 0
        });

        if (!hasMore) {
          localStorage.removeItem("photo_cleanup_last_index");
          break;
        }
      }

      toast.success(`اكتملت العملية!\nتم فحص الصور بالكامل.`);
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ غير متوقع أثناء التنظيف");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (confirm("هل تريد تصغير العداد والبدء من الصفر؟")) {
      setStartFrom(0);
      localStorage.removeItem("photo_cleanup_last_index");
    }
  };

  return (
    <div className="flex flex-col items-end gap-2 bg-rose-50 p-3 rounded-2xl border border-rose-100 shadow-sm">
      <div className="flex items-center gap-2">
        {startFrom > 0 && !loading && (
          <button
            onClick={handleReset}
            className="text-[10px] bg-slate-200 px-2 py-1 rounded-md font-bold hover:bg-slate-300"
          >
            إعادة للصفر
          </button>
        )}
        <button
          onClick={handleCleanup}
          disabled={loading}
          className="bg-rose-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-rose-600 disabled:opacity-50 transition-all flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              جاري الفحص ({stats.processed} / {stats.total})
            </>
          ) : (
            startFrom > 0 ? `استئناف التنظيف من (${startFrom})` : "🧹 تقليص الصور الكبيرة (>1MB)"
          )}
        </button>
      </div>

      {loading && stats.total > 0 && (
        <div className="w-full bg-rose-200 rounded-full h-1.5 mt-1 overflow-hidden">
          <div
            className="bg-rose-600 h-1.5 transition-all duration-300"
            style={{ width: `${(stats.processed / stats.total) * 100}%` }}
          ></div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold text-rose-700">
            تم تقليص {stats.compressed} صورة ضخمة حتى الآن
          </span>
          <span className="text-[9px] text-rose-500">
            يتم فحص كل الصور، التقليص فقط للصور التي حجمها أكثر من 1MB
          </span>
        </div>
      )}
    </div>
  );
}
