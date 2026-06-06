"use client";

import { useState } from "react";
import { cleanupLargeCustomerPhotos } from "../customers/profiles/actions";
import { toast } from "sonner";

export function PhotoCleanupButton() {
  const [loading, setLoading] = useState(false);

  const handleCleanup = async () => {
    if (!confirm("هل تريد فحص كل صور الزبائن وتقليص الصور الكبيرة (أكبر من 1 ميجا)؟\nهذه العملية قد تستغرق وقتاً حسب عدد الصور.")) return;

    setLoading(true);
    try {
      const res = await cleanupLargeCustomerPhotos();
      if (res.ok) {
        toast.success(`تمت العملية بنجاح!\nفحص: ${res.processed} صورة\nتم تقليص: ${res.compressed} صورة كبيرة\nالأخطاء: ${res.errors}`);
        window.location.reload();
      } else {
        toast.error("فشل في تشغيل عملية التنظيف: " + res.error);
      }
    } catch (err) {
      toast.error("حدث خطأ غير متوقع أثناء التنظيف");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCleanup}
      disabled={loading}
      className="bg-rose-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-rose-600 disabled:opacity-50 transition-all flex items-center gap-2"
    >
      {loading ? "جاري التقليص..." : "🧹 تقليص الصور الكبيرة (>1MB)"}
    </button>
  );
}
