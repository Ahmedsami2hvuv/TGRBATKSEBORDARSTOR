"use client";

import { useState } from "react";
import { cleanupLargeCustomerPhotos } from "../customers/profiles/actions";
import { toast } from "sonner";

export function PhotoCleanupButton() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ processed: 0, compressed: 0, total: 0 });

  const handleCleanup = async () => {
    if (!confirm("هل تريد فحص كل صور الزبائن وتقليص الصور الكبيرة (أكبر من 1 ميجا)؟\nسيتم العمل على دفعات لتجنب توقف الموقع.")) return;

    setLoading(true);
    let currentSkip = 0;
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

        totalProcessed += res.processed;
        totalCompressed += res.compressed;
        hasMore = res.hasMore;

        // إذا لم يتم تقليص أي صورة في هذه الدفعة (كانت كلها صغيرة)، ننتقل للدفعة التالية
        // أما إذا تم تقليص صور، فالـ skip يبقى كما هو لأن الصور القديمة حذفت والجديدة أضيفت (أو تغير ترتيبها)
        // لكن لضمان عدم الدخول في حلقة مفرغة، سنزيد الـ skip دائماً بالقدر الذي تم فحصه
        currentSkip += batchSize;

        setStats({
          processed: totalProcessed,
          compressed: totalCompressed,
          total: res.totalCount || 0
        });

        if (!hasMore) break;
      }

      toast.success(`اكتملت العملية!\nتم فحص: ${totalProcessed} صورة\nتم تقليص: ${totalCompressed} صورة كبيرة.`);
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ غير متوقع أثناء التنظيف");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleCleanup}
        disabled={loading}
        className="bg-rose-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-rose-600 disabled:opacity-50 transition-all flex items-center gap-2"
      >
        {loading ? (
          <>
            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            جاري المعالجة ({stats.processed} / {stats.total})...
          </>
        ) : (
          "🧹 تقليص الصور الكبيرة (>1MB)"
        )}
      </button>
      {loading && stats.total > 0 && (
        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1 overflow-hidden">
          <div
            className="bg-rose-500 h-1.5 transition-all duration-300"
            style={{ width: `${(stats.processed / stats.total) * 100}%` }}
          ></div>
        </div>
      )}
      {loading && (
        <span className="text-[10px] font-bold text-rose-600 animate-pulse">
          تم تقليص {stats.compressed} صورة حتى الآن...
        </span>
      )}
    </div>
  );
}
