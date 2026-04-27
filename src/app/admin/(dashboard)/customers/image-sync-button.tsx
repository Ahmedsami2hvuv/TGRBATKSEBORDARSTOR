"use client";

import { useState } from "react";
import { syncCustomerImages } from "./image-sync-actions";
import { ad } from "@/lib/admin-ui";

export function ImageSyncButton({ pendingCount }: { pendingCount: number }) {
  const [loading, setLoading] = useState(false);

  const handleSync = async () => {
    if (!confirm(`هل تريد نقل 50 صورة من القاعدة القديمة إلى سيرفرك الجديد؟\nبقي لديك ${pendingCount} صورة.`)) return;

    setLoading(true);
    try {
      const result = await syncCustomerImages();
      if (result.success) {
        alert(result.message);
        window.location.reload();
      } else {
        alert("فشل في المزامنة: " + result.message);
      }
    } catch (err) {
      alert("خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSync}
      disabled={loading}
      className={`px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-50 text-sm font-bold shadow-lg flex items-center gap-2`}
    >
      {loading ? "جاري التأمين..." : `🛡️ تأمين الصور (${pendingCount})`}
    </button>
  );
}
