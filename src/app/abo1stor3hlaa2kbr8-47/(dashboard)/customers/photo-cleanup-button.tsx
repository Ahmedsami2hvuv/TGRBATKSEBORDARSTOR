"use client";

import { useState, useEffect } from "react";
import { cleanupLargeCustomerPhotos } from "../customers/profiles/actions";
import { toast } from "sonner";

export function PhotoCleanupButton() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ processed: 0, compressed: 0, total: 0 });
  const [startFrom, setStartFrom] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("photo_cleanup_last_index");
    if (saved) setStartFrom(parseInt(saved));
  }, []);

  const handleCleanup = async () => {
    if (!confirm(`سيتم فحص الصور بدءاً من (${startFrom}). في حال حدوث خطأ، سيحاول النظام الاستمرار تلقائياً.`)) return;

    setLoading(true);
    let currentSkip = startFrom;
    const batchSize = 10; // تقليل الحجم لضمان الاستقرار
    let totalCompressed = 0;
    let hasMore = true;
    let retryCount = 0;

    try {
      while (hasMore) {
        try {
          const res = await cleanupLargeCustomerPhotos(currentSkip, batchSize);

          if (!res.ok) {
            throw new Error(res.error || "خطأ غير معروف");
          }

          // نجاح الدفعة
          totalCompressed += res.compressed;
          hasMore = res.hasMore;
          currentSkip += batchSize;
          retryCount = 0; // تصفير المحاولات عند النجاح

          // حفظ التقدم
          localStorage.setItem("photo_cleanup_last_index", currentSkip.toString());
          setStartFrom(currentSkip);

          setStats({
            processed: currentSkip,
            compressed: totalCompressed,
            total: res.totalCount || 0
          });

          if (!hasMore) {
            localStorage.removeItem("photo_cleanup_last_index");
            break;
          }
        } catch (err) {
          console.error("Batch error, retrying...", err);
          retryCount++;
          setErrorCount(prev => prev + 1);

          if (retryCount > 2) {
            // إذا فشل 3 مرات في نفس المجموعة، نتجاوزها لكي لا نتوقف للأبد
            currentSkip += batchSize;
            retryCount = 0;
            toast.error(`تم تجاوز مجموعة صور بسبب خطأ فني في الرقم ${currentSkip}`);
          } else {
            // انتظار ثانية قبل المحاولة مرة أخرى
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      toast.success(`اكتملت العملية بنجاح! تم فحص كل الصور.`);
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      toast.error("حدث خطأ حرج توقفت بسببه العملية.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (confirm("هل تريد تصغير العداد والبدء من الصفر؟")) {
      setStartFrom(0);
      setStats({ processed: 0, compressed: 0, total: 0 });
      localStorage.removeItem("photo_cleanup_last_index");
    }
  };

  return (
    <div className="flex flex-col items-end gap-2 bg-rose-50 p-4 rounded-2xl border border-rose-100 shadow-sm w-full max-w-xs ml-auto">
      <div className="flex flex-col w-full gap-2">
        <button
          onClick={handleCleanup}
          disabled={loading}
          className="bg-rose-600 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-md hover:bg-rose-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 w-full"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              جاري التنظيف ({stats.processed} / {stats.total})
            </>
          ) : (
            startFrom > 0 ? `استئناف من ${startFrom}` : "🧹 تقليص الصور الكبيرة"
          )}
        </button>

        {!loading && startFrom > 0 && (
          <button
            onClick={handleReset}
            className="text-[11px] text-gray-500 hover:text-rose-600 font-medium underline decoration-dotted"
          >
            إعادة الفحص من الصفر
          </button>
        )}
      </div>

      {loading && stats.total > 0 && (
        <div className="w-full mt-2">
          <div className="flex justify-between mb-1">
            <span className="text-[10px] font-bold text-rose-600">التقدم: {Math.round((stats.processed / stats.total) * 100)}%</span>
            <span className="text-[10px] font-bold text-rose-600">{stats.processed} / {stats.total}</span>
          </div>
          <div className="w-full bg-rose-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-rose-600 h-2 transition-all duration-500 ease-out"
              style={{ width: `${(stats.processed / stats.total) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-end mt-1">
          <span className="text-[11px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
             تم تقليص {stats.compressed} صورة ضخمة ✅
          </span>
          {errorCount > 0 && (
            <span className="text-[9px] text-amber-600 mt-1">
              ⚠️ حدث {errorCount} تنبيهات (تم تجاوزها تلقائياً)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
